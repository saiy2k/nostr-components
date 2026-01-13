# Nostr Stream Component - Technical Implementation

## Overview

This document contains the technical implementation details for the `nostr-stream` component. For component usage and API specifications, see [spec.md](./spec.md).

## Architecture

### Base Class
- Extends: `NostrEventComponent` → `NostrBaseComponent`
- Inheritance Chain:
  - `NostrBaseComponent`: Relay connection, theme handling (`data-theme`), status management, event delegation
  - `NostrEventComponent`: Event resolution (addressable events), author profile loading
  - `NostrStream`: Stream-specific functionality

### Status Management
- Channel-based: Separate status channels for different concerns
  - `streamStatus`: Stream event loading status (Idle, Loading, Ready, Error) - inherited as `eventStatus`
  - `authorStatus`: Author profile loading status (Idle, Loading, Ready, Error) - inherited
  - `participantsStatus`: Participant profile resolution status (Idle, Loading, Ready, Error)
  - `videoStatus`: Video player/stream URL loading status (Idle, Loading, Ready, Error)
  - `connectionStatus`: Relay connection status (inherited as `conn`)

### Event Handling
- Delegated Events: Uses `delegateEvent()` for efficient Shadow DOM event handling
- Video Player: `<hls-video>` custom element with standard controls
- Event Delegation: Prevents memory leaks and improves performance

### Rendering Architecture
- Separation of Concerns:
  - `nostr-stream.ts`: Component logic and lifecycle
  - `render.ts`: Rendering functions and HTML generation
  - `style.ts`: CSS styles and theming (component-specific)
  - `stream-utils.ts`: Stream parsing and utility functions

## Dependencies

### Internal Dependencies
- `NostrEventComponent`: Base class with event resolution (to be extended for addressable events)
- `NostrService`: Relay connection management
- `EventResolver`: Event resolution (to be extended for addressable events)
- `getBaseStyles()`: Utility for base CSS injection
- Common Utils: `formatEventDate()`, `decodeNip19Entity()` for naddr decoding
- Zap Utils: `getBatchedProfileMetadata()` (reused for participant profile fetching)

### External Dependencies
- `@nostr-dev-kit/ndk`: NDKEvent, NDKUser, NDKKind, NDKSubscription
- `nostr-tools`: `nip19` for bech32 decoding/encoding
- `hls-video-element`: Custom element for HLS video playback with cross-browser support

## Component Lifecycle

### Initialization Flow
1. Constructor: Initialize status channels
2. Connected Callback:
   - Validate inputs (`naddr` attribute)
   - Decode naddr to extract `kind`, `pubkey`, `identifier` (d tag)
   - Connect to relays (inherited)
   - Start addressable event subscription
   - Attach delegated listeners
   - Render initial state
3. Attribute Changed: Handle `naddr`, `show-participants`, `show-participant-count`, `auto-play`, `data-theme` updates
4. Status Change: React to status updates via `onStatusChange()`, `onEventReady()`
5. Disconnected Callback: Clean up subscriptions and listeners

### Addressable Event Resolution

#### EventResolver Extension
- Extend `EventResolver` to support addressable events
- Add `validateAddressableInputs({ naddr })` method:
  - Check naddr is provided and not empty
  - Validate format: must start with `naddr1` (bech32-encoded)
  - Attempt to decode using `nip19.decode(naddr)`
  - Verify decoded type is `'naddr'`
  - Return error message string if validation fails, `null` if valid

- Add `resolveAddressableEvent({ naddr })` method:
  - First call `validateAddressableInputs()` to ensure valid format
  - Decode naddr: `const { type, data } = nip19.decode(naddr)`
  - Verify `type === 'naddr'` (should be guaranteed by validation)
  - Extract: `{ kind, pubkey, identifier: dTag, relays }`
  - Query: `{ kinds: [kind], authors: [pubkey], '#d': [identifier] }`
  - Use `nostrService.getNDK().fetchEvents(filter)`
  - Return latest event (highest `created_at`) if multiple exist
  - Throw error if no events found

#### NostrEventComponent Extension
- Add `naddr` to `observedAttributes`
- Extend `validateInputs()` method:
  - Check for `naddr` attribute
  - If naddr present: Call `eventResolver.validateAddressableInputs({ naddr })`
  - If validation returns error message: Set error status and return `false`
  - Return `true` if validation passes
  - Ensure only one identifier type is provided (naddr XOR hex/noteid/eventid)

- Extend `resolveEventAndLoad()` method:
  - Check if `naddr` attribute exists
  - If naddr: Call `eventResolver.resolveAddressableEvent({ naddr })`
  - Store decoded naddr data (kind, pubkey, dTag) for subscription use
  - Continue with existing flow for author profile loading

## Live Subscription Strategy

### Persistent Subscription
```typescript
private streamSubscription: NDKSubscription | null = null;

private subscribeToStreamUpdates(pubkey: string, dTag: string): void {
  if (this.streamSubscription) {
    this.streamSubscription.stop();
  }

  const filter = {
    kinds: [30311],
    authors: [pubkey],
    '#d': [dTag],
  };

  this.streamSubscription = this.nostrService.getNDK().subscribe([filter], {
    closeOnEose: false, // Keep subscription open
    groupable: false
  });

  this.streamSubscription.on('event', (event: NDKEvent) => {
    // Only update if this event is newer than current
    if (!this.event || event.created_at > this.event.created_at) {
      this.event = event;
      this.parseStreamEvent(event);
      this.render();
    }
  });
}
```

### Update Detection
- Compare `created_at` timestamps
- Only update if new event is newer than current event
- Parse and update all stream metadata (status, participants, counts, etc.)

### Staleness Detection
- Track last update timestamp
- If `status="live"` and no update received for 1 hour, consider ended
- Use `setInterval` to check staleness every 5 minutes
- Update UI to show ended state

## Stream Event Parsing

### Utility Functions (`src/nostr-stream/stream-utils.ts`)

```typescript
interface ParsedStreamEvent {
  dTag: string;
  title?: string;
  summary?: string;
  image?: string;
  streamingUrl?: string;
  recordingUrl?: string;
  starts?: number;
  ends?: number;
  status?: 'planned' | 'live' | 'ended';
  currentParticipants?: number;
  totalParticipants?: number;
  participants: Participant[];
  relays?: string[];
  hashtags: string[];
}

interface Participant {
  pubkey: string;
  relay?: string;
  role?: string; // "Host", "Speaker", "Participant"
  proof?: string; // Hex-encoded signature proof
}

parseStreamEvent(event: NDKEvent): ParsedStreamEvent {
  // Extract all tags from kind:30311 event
  // Parse d, title, summary, image, streaming, recording tags
  // Parse starts, ends, status, current_participants, total_participants
  // Parse all 'p' tags into Participant objects
  // Parse 'relays' and 't' (hashtag) tags
  // Return structured object
}
```

### Tag Parsing Logic
- `d` tag: Required, unique identifier
- `title` tag: First value is title
- `summary` tag: First value is summary
- `image` tag: First value is preview image URL
- `streaming` tag: First value is streaming URL (HLS/M3U8)
- `recording` tag: First value is recording URL
- `starts` tag: First value parsed as unix timestamp
- `ends` tag: First value parsed as unix timestamp
- `status` tag: First value must be "planned", "live", or "ended"
- `current_participants` tag: First value parsed as number
- `total_participants` tag: First value parsed as number
- `p` tags: Array of `[pubkey, relay?, role?, proof?]`
- `relays` tags: Array of relay URLs
- `t` tags: Array of hashtags

## Participant Profile Resolution

### Batch Profile Fetching
- Extract all unique pubkeys from `parsedStream.participants`
- Use `getBatchedProfileMetadata(pubkeys)` from zap-utils
- Fetch profiles in single batched query via NDK
- Store profiles in `Map<string, any>` for lookup by pubkey
- Cache profiles within component lifecycle
- Handle missing profiles: profile will be `null` in Map

### Profile Data Structure
- Avatar: `profile.image` or default fallback
- Name: `profile.displayName` or `profile.name` or npub short format
- Role: Extracted from `p` tag (3rd element)
- Proof: Extracted from `p` tag (4th element, hex-encoded signature)

## Video Player Implementation

### hls-video-element Custom Element
Uses `hls-video-element` npm package. Custom element `<hls-video>` provides HTMLMediaElement-compatible API with HLS.js support.

#### Installation and Setup
```typescript
// In nostr-stream.ts
import 'hls-video-element'; // Registers <hls-video> custom element globally
```

#### Video Player Rendering
```typescript
private renderVideoPlayer(streamingUrl: string | undefined, status: string): string {
  if (status !== 'live' || !streamingUrl) {
    return this.renderPreviewImage();
  }

  const autoplay = this.getAttribute('auto-play') === 'true' ? 'autoplay' : '';
  
  return `
    <hls-video 
      src="${streamingUrl}" 
      controls 
      ${autoplay}
      preload="metadata"
      class="stream-video"
    >
      Your browser does not support HLS video.
    </hls-video>
  `;
}
```

### Fallback Handling
- If status is not "live": Show preview image
- If streaming URL is missing: Show preview image
- If video fails to load: Show error message + preview image
- If status is "ended": Show recording link instead of video

## Status-Based Rendering Logic

### Rendering Conditions
- `planned`: Render preview image, hide video player
- `live`: Render video player if streaming URL exists, show participant list
- `ended`: Render recording link if available, show final participant counts

### Status Updates
- Update rendering when status changes
- Transition video player visibility based on status
- Update participant list visibility based on status

## Performance Considerations

### Subscription Management
- Single persistent subscription per component
- Clean up subscription on `disconnectedCallback`
- Avoid duplicate subscriptions when attributes change

### Profile Batching
- Fetch all participant profiles in single batched query
- Reduce relay round-trips
- Reuse `getBatchedProfileMetadata()` from zap-utils

### Debouncing Updates
- Debounce render calls when rapid event updates occur
- Throttle staleness checks to every 5 minutes
- Cache parsed event data to avoid re-parsing on every render

### Lazy Loading
- Only load video player when status becomes "live"
- Lazy load participant profiles (render skeleton first)
- Load preview image immediately, video only when needed

## File Structure

```
src/nostr-stream/
├── nostr-stream.ts          # Main component class
├── render.ts                # Rendering functions and HTML generation
├── style.ts                 # Component-specific CSS styles
├── stream-utils.ts          # Stream parsing and utility functions
└── spec/
    ├── spec.md              # Component specification
    ├── implementation.md     # This file
    └── testing.md           # Testing considerations
```

## Addressable Event Resolution Details

### NIP-19 Decoding
- Use `nip19.decode(naddr)` from `nostr-tools`
- Returns: `{ type: 'naddr', data: { kind, pubkey, identifier, relays } }`
- `identifier` is the `d` tag value
- `relays` array contains preferred relay hints

### Event Query
- Filter: `{ kinds: [kind], authors: [pubkey], '#d': [identifier] }`
- Query for latest event (highest `created_at`)
- If multiple events exist (shouldn't happen, but handle gracefully), take newest
- Cache decoded naddr data to avoid re-decoding

## Error Handling

### Invalid naddr
- Validation occurs in `EventResolver.validateAddressableInputs()`
- Possible validation failures:
  - Missing naddr attribute: "Provide naddr attribute"
  - Invalid format (doesn't start with `naddr1`): "Invalid naddr format"
  - Decode failure (malformed bech32): "Invalid naddr format: decoding failed"
  - Wrong type (not an naddr): "Invalid naddr: expected naddr type"
- Show error message from validator
- Set `streamStatus` to Error
- Validation happens before any network calls

### Event Not Found
- If query returns no events, throw error from `resolveAddressableEvent()`
- Set `streamStatus` to Error
- Set error message: "Stream not found"
- Render error state in UI

### Missing Required Tags
- If `d` tag missing, treat as invalid event
- Log warnings about missing optional tags but continue rendering
- Use default/fallback values for missing optional data

### Video Load Failures
- Catch `error` event on `.stream-video` element (delegated listener)
- Set `videoStatus` channel to Error
- Re-render to show fallback preview image
- Log error message for debugging

### Profile Fetch Failures
- Handle individual profile fetch failures gracefully
- Show npub fallback for failed profiles
- Continue rendering other participants
