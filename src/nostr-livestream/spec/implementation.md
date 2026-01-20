# Nostr Livestream Component - Technical Implementation

## Overview

This document contains the technical implementation details for the `nostr-livestream` component. For component usage and API specifications, see [spec.md](./spec.md).

## Architecture

### Base Class
- Extends: `NostrEventComponent` → `NostrBaseComponent`
- Inheritance:
  - `NostrBaseComponent`: Relay connection, theme handling, status management, event delegation
  - `NostrEventComponent`: Addressable event resolution (naddr), author profile loading
  - `NostrLivestream`: Livestream-specific functionality

### Status Management
Channel-based status channels:
- `eventStatus`: Livestream event loading (inherited)
- `authorStatus`: Author profile loading (inherited)
- `participantsStatus`: Participant profile resolution
- `videoStatus`: Video player/stream URL loading
- `connectionStatus`: Relay connection (inherited as `conn`)

### Rendering Architecture
- `nostr-livestream.ts`: Component logic and lifecycle
- `render.ts`: Rendering functions and HTML generation
- `style.ts`: CSS styles and theming
- `livestream-utils.ts`: Livestream parsing and utility functions

## Dependencies

### Internal Dependencies
- `NostrEventComponent`: Base class with addressable event resolution
- `NostrService`: Relay connection management
- `EventResolver`: Event resolution with naddr support
- `getBaseStyles()`: Base CSS injection utility
- `getBatchedProfileMetadata()`: Participant profile fetching (from zap-utils)

### External Dependencies
- `@nostr-dev-kit/ndk`: NDKEvent, NDKUser, NDKKind
- `nostr-tools`: `nip19` for bech32 decoding/encoding
- `hls-video-element`: Custom element for HLS video playback with cross-browser support

## Component Lifecycle

1. **Constructor**: Initialize status channels
2. **Connected Callback**: Validate `naddr`, connect to relays, fetch event, attach listeners, render
3. **Attribute Changed**: Handle `naddr`, `show-participants`, `show-participant-count`, `auto-play`, `data-theme`
4. **onEventReady**: Parse livestream event, load participant profiles, render
5. **Disconnected Callback**: Clean up listeners

## Livestream Event Parsing

Parses kind:30311 events into structured data:

```typescript
interface ParsedLivestreamEvent {
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
```

**Tag Parsing**: `d` (required), `title`, `summary`, `image`, `streaming`, `recording`, `starts`, `ends`, `status`, `current_participants`, `total_participants`, `p` (participants), `relays`, `t` (hashtags)

## Participant Profile Resolution

- Batch fetch all participant profiles using `getBatchedProfileMetadata()`
- Store profiles in `Map<string, any>` keyed by pubkey
- Fallback to npub format for missing profiles
- Role and proof extracted from `p` tag elements

## Video Player Implementation

Uses `<hls-video>` custom element from `hls-video-element` package for cross-browser HLS support.

- Renders video player when `status === 'live'` and `streamingUrl` exists
- Supports `auto-play` attribute
- Fallback to preview image if video fails to load
- Delegated error listener updates `videoStatus` on failure

## Status-Based Rendering

- **planned**: Preview image, scheduled time
- **live**: Video player (if URL exists), participant list
- **ended**: Recording link, final participant counts

Status is determined from the initially fetched event. Page refresh required to see status changes.

## Performance Considerations

- Batch fetch all participant profiles in a single query
- Cache parsed livestream event data
- Lazy load video player only when status is "live"
- Show skeleton loaders for participant profiles while loading

## File Structure

```
src/nostr-livestream/
├── nostr-livestream.ts          # Main component class
├── render.ts                    # Rendering functions and HTML generation
├── style.ts                     # Component-specific CSS styles
├── livestream-utils.ts          # Livestream parsing and utility functions
└── spec/
    ├── spec.md                  # Component specification
    ├── implementation.md        # This file
    └── testing.md               # Testing considerations
```

## Addressable Event Resolution

- Decode naddr using `nip19.decode()` from `nostr-tools`
- Extract `{ kind, pubkey, identifier (d tag), relays }`
- Query: `{ kinds: [kind], authors: [pubkey], '#d': [identifier] }`
- Returns latest event (highest `created_at`) if multiple exist

## Error Handling

- **Invalid naddr**: Validated before network calls, shows error message
- **Event not found**: Sets `eventStatus` to Error, renders error state
- **Missing `d` tag**: Treated as invalid event
- **Video load failure**: Delegated error listener, fallback to preview image
- **Profile fetch failure**: Graceful fallback to npub format, continue rendering
