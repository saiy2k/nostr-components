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
- Video Player: Native `<video>` element with standard controls
- Participant List: Scrollable list with role badges
- Status Badge: Visual indicator of stream status
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
- Add `resolveAddressableEvent({ naddr })` method
- Decode naddr using `decodeNip19Entity()` or `nip19.decode()`
- Extract: `{ kind, pubkey, identifier: dTag, relays }`
- Query: `{ kinds: [kind], authors: [pubkey], '#d': [dTag] }`
- Return latest event (highest `created_at`) if multiple exist

#### NostrEventComponent Extension
- Add `naddr` to `observedAttributes`
- Extend `validateInputs()` to accept `naddr`
- Extend `resolveEventAndLoad()` to handle addressable events
- Use `EventResolver.resolveAddressableEvent()` when `naddr` is provided

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
- Extract all unique pubkeys from `p` tags
- Use `getBatchedProfileMetadata()` from zap-utils
- Fetch profiles in single batched query
- Cache profiles within component lifecycle
- Handle missing profiles gracefully (show npub fallback)

### Profile Display
- Show avatar from profile metadata (fallback to default emoji)
- Show display name or name (fallback to npub short format)
- Show role badge (Host/Speaker/Participant)
- Show proof indicator (verified/unverified) - future enhancement

## Video Player Implementation

### Native HTML5 Video
```typescript
private renderVideoPlayer(streamingUrl: string | undefined, status: string): string {
  if (status !== 'live' || !streamingUrl) {
    return this.renderPreviewImage();
  }

  const autoplay = this.getAttribute('auto-play') === 'true' ? 'autoplay' : '';
  
  return `
    <video 
      src="${streamingUrl}" 
      controls 
      ${autoplay}
      preload="metadata"
      class="stream-video"
    >
      Your browser does not support the video tag.
    </video>
  `;
}
```

### Fallback Handling
- If status is not "live": Show preview image
- If streaming URL is missing: Show preview image
- If video fails to load: Show error message + preview image
- If status is "ended": Show recording link instead of video
- Browser compatibility: Rely on native HLS support (Safari, Chrome Android)

## Status Transitions and UI States

### Status-Based Rendering
- `planned`: Show countdown, preview image, disabled video
- `live`: Show active video player, live indicator, participant list
- `ended`: Show recording link, ended indicator, final participant counts

### Status Badge Styling
- Planned: Yellow/orange badge with "Planned" text
- Live: Red badge with "LIVE" text and pulsing animation
- Ended: Gray badge with "Ended" text

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
- Validate naddr format before decoding
- Show error message: "Invalid naddr format"
- Set `streamStatus` to Error

### Event Not Found
- If query returns no events, show "Stream not found"
- Set `streamStatus` to Error
- Provide helpful error message

### Missing Required Tags
- If `d` tag missing, treat as invalid event
- Warn about missing optional tags but continue rendering
- Fallback to defaults for missing optional data

### Video Load Failures
- Catch video `error` event
- Show fallback preview image
- Display error message: "Video unavailable"

### Profile Fetch Failures
- Handle individual profile fetch failures gracefully
- Show npub fallback for failed profiles
- Continue rendering other participants
