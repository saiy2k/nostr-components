# Nostr Stream Component - Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for the `nostr-stream` component following the specifications in:
- `spec/spec.md` - Component specification and API
- `spec/implementation.md` - Technical implementation details
- `spec/nip-53.md` - Official NIP-53 Live Activities specification (reference)

## Prerequisites

- Existing codebase patterns (NostrBaseComponent, NostrEventComponent, EventResolver)
- Understanding of NIP-53 Live Activities specification (see `spec/nip-53.md`)
- Knowledge of addressable events and NIP-19 naddr encoding

## Implementation Phases

---

## Phase 1: Extend Event Resolution for Addressable Events

**Goal:** Add support for resolving addressable events via `naddr` attribute.

### Task 1.1: Extend EventResolver
**File:** `src/base/resolvers/event-resolver.ts`

- [ ] Add `validateNaddr({ naddr })` method
  - Check naddr is provided and not empty
  - Validate format: must start with `naddr1` (bech32-encoded)
  - Attempt to decode using `nip19.decode(naddr)`
  - Verify decoded type is `'naddr'`
  - Return specific error message strings if validation fails:
    - Missing naddr: `"Provide naddr attribute"`
    - Invalid format (doesn't start with `naddr1`): `"Invalid naddr format"`
    - Decode failure (malformed bech32): `"Invalid naddr format: decoding failed"`
    - Wrong type (not an naddr): `"Invalid naddr: expected naddr type"`
  - Return `null` if valid
  - Note: This validation happens before any network calls

- [ ] Add `resolveAddressableEvent({ naddr })` method
  - First call `validateNaddr()` to ensure valid format
  - If validation returns error message, throw error with that message
  - Decode naddr: `const { type, data } = nip19.decode(naddr)`
  - Verify `type === 'naddr'` (should be guaranteed by validation)
  - Extract: `{ kind, pubkey, identifier: dTag, relays }`
  - Query: `{ kinds: [kind], authors: [pubkey], '#d': [identifier] }`
  - Use `nostrService.getNDK().fetchEvents(filter)`
  - Return latest event (highest `created_at`) if multiple exist (shouldn't happen, but handle gracefully)
  - Throw error if no events found: "Addressable event not found"

### Task 1.2: Extend NostrEventComponent
**File:** `src/base/event-component/nostr-event-component.ts`

- [ ] Add `naddr` to `observedAttributes` array
- [ ] Extend `validateInputs()` method
  - Check for `naddr` attribute
  - If naddr present: Call `eventResolver.validateNaddr({ naddr })`
  - If validation returns error message: Set error status and return `false`
  - Ensure only one identifier type is provided (naddr XOR hex/noteid/eventid)
  - Return `true` if validation passes

- [ ] Extend `resolveEventAndLoad()` method
  - Check if `naddr` attribute exists
  - If naddr: Call `eventResolver.resolveAddressableEvent({ naddr })`
  - Store decoded naddr data (kind, pubkey, dTag) for subscription use
  - Continue with existing flow for author profile loading

**Dependencies:**
- `nip19` from `nostr-tools` (or `decodeNip19Entity` from `../common/utils`)
- Existing `EventResolver` class
- Existing `NostrService.getNDK()`
- `formatEventDate` from `../common/date-utils` (for date formatting in UI)

**Testing:**
- Test with valid naddr
- Test with invalid naddr format
- Test with naddr pointing to non-existent event
- Test with naddr decoding to wrong kind

---

## Phase 2: Create Stream Utilities

**Goal:** Build utility functions for parsing stream events (kind:30311).

### Task 2.1: Create stream-utils.ts
**File:** `src/nostr-stream/stream-utils.ts`

- [ ] Import dependencies:
  - `NDKEvent` from `@nostr-dev-kit/ndk`

- [ ] Define TypeScript interfaces:
  ```typescript
  interface ParsedStreamEvent {
    dTag: string;
    title?: string;
    summary?: string;
    image?: string;
    streamingUrl?: string;
    recordingUrl?: string;
    starts?: number; // Unix timestamp in seconds
    ends?: number; // Unix timestamp in seconds
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
    role?: string;
    proof?: string;
  }
  ```

- [ ] Implement `parseStreamEvent(event: NDKEvent): ParsedStreamEvent`
  - Extract `d` tag (required) - first value, throw error if missing
  - Extract `title` tag - first value (optional)
  - Extract `summary` tag - first value (optional)
  - Extract `image` tag - first value (optional)
  - Extract `streaming` tag - first value (optional, HLS/M3U8 URL)
  - Extract `recording` tag - first value (optional)
  - Parse `starts` tag - convert first value to number (unix timestamp)
  - Parse `ends` tag - convert first value to number (unix timestamp)
  - Extract `status` tag - validate first value is 'planned'|'live'|'ended' (optional, default to 'planned')
  - Parse `current_participants` tag - convert first value to number (optional)
  - Parse `total_participants` tag - convert first value to number (optional)
  - Extract all `p` tags - map to Participant objects:
    - `p[0]` = pubkey (required)
    - `p[1]` = relay (optional)
    - `p[2]` = role (optional: "Host", "Speaker", "Participant")
    - `p[3]` = proof (optional, hex-encoded signature)
  - Extract all `relays` tags - array of relay URLs (all values)
  - Extract all `t` tags - array of hashtags (all values)
  - Return structured ParsedStreamEvent object
  - Handle missing optional tags gracefully (use undefined)

- [ ] Implement helper functions:
  - `getTagValue(tags, tagName, index = 0): string | undefined`
  - `getTagValues(tags, tagName): string[]`
  - `parseTimestamp(value: string): number | undefined`
  - `parseNumber(value: string): number | undefined`

**Dependencies:**
- `NDKEvent` from `@nostr-dev-kit/ndk`

**Testing:**
- Test parsing event with all tags present
- Test parsing event with missing optional tags
- Test parsing participant tags (with/without relay, role, proof)
- Test parsing invalid status values
- Test parsing invalid timestamps/numbers

---

## Phase 3: Component Skeleton and Basic Rendering

**Goal:** Create component class and basic rendering structure.

### Task 3.1: Create component class
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Import dependencies:
  - `NostrEventComponent`, `NCStatus` from base
  - `NDKEvent`, `NDKSubscription` from `@nostr-dev-kit/ndk`
  - `parseStreamEvent`, `ParsedStreamEvent` from `./stream-utils`
  - `renderStream`, `RenderStreamOptions` from `./render`
  - `getStreamStyles` from `./style`
  - `formatEventDate` from `../common/date-utils` (for displaying start/end times)
  - `getBatchedProfileMetadata` from `../nostr-zap-button/zap-utils` (for Phase 5, but import early)

- [ ] Create `NostrStream` class extending `NostrEventComponent`
- [ ] Add protected properties:
  ```typescript
  protected parsedStream: ParsedStreamEvent | null = null;
  protected streamSubscription: NDKSubscription | null = null;
  protected participantProfiles: Map<string, any> = new Map();
  protected lastUpdateTime: number = 0;
  private stalenessCheckInterval: number | null = null;
  ```

- [ ] Add status channels:
  ```typescript
  protected participantsStatus = this.channel('participants');
  protected videoStatus = this.channel('video');
  ```
  - Note: `eventStatus` (stream loading) and `authorStatus` are inherited from `NostrEventComponent`
  - Note: `connectionStatus` (as `conn`) is inherited from `NostrBaseComponent`

- [ ] Implement `static get observedAttributes()`
  - Return: `['naddr', 'show-participants', 'show-participant-count', 'auto-play', ...super.observedAttributes]`

- [ ] Implement `connectedCallback()`
  - Call `super.connectedCallback()`
  - Attach delegated listeners
  - Initial render

- [ ] Implement `disconnectedCallback()`
  - Clean up subscription: `this.streamSubscription?.stop()`
  - Clear staleness interval
  - Call `super.disconnectedCallback()`

- [ ] Implement `attributeChangedCallback()`
  - Handle `naddr` changes (re-resolve event)
  - Handle `show-participants`, `show-participant-count`, `auto-play`
  - Call super for `data-theme`, `relays`

- [ ] Implement `protected onEventReady(event: NDKEvent)`
  - Parse stream event: `this.parsedStream = parseStreamEvent(event)`
  - Set `lastUpdateTime = Date.now()`
  - Extract pubkey and dTag from decoded naddr data (stored during event resolution)
  - Start live subscription: `subscribeToStreamUpdates(pubkey, dTag)`
  - Start staleness check: `startStalenessCheck()`
  - Load participant profiles: `loadParticipantProfiles()` (from Phase 5)
  - Render: `this.renderContent()`

- [ ] Implement `protected renderContent()`
  - Build render options from component state:
    - Author profile from `this.authorProfile`
    - Parsed stream from `this.parsedStream`
    - Show participants flag from `show-participants` attribute
    - Show participant count flag from `show-participant-count` attribute
    - Auto play flag from `auto-play` attribute
    - Participant profiles from `this.participantProfiles` Map
    - Theme from `data-theme` attribute
    - Status channels (eventStatus, authorStatus, participantsStatus, videoStatus)
  - Get styles: `getStreamStyles(this.theme)`
  - Render: `renderStream(options)`
  - Update `shadowRoot.innerHTML` with styles + rendered content

**Dependencies:**
- Phase 1 (EventResolver extension)
- Phase 2 (stream-utils)

### Task 3.2: Create basic render.ts
**File:** `src/nostr-stream/render.ts`

- [ ] Import dependencies:
  - `IRenderOptions` from base
  - `NDKUserProfile` from `@nostr-dev-kit/ndk`
  - `ParsedStreamEvent` from `./stream-utils`

- [ ] Define `RenderStreamOptions` interface:
  ```typescript
  export interface RenderStreamOptions extends IRenderOptions {
    author: NDKUserProfile | null;
    parsedStream: ParsedStreamEvent | null;
    showParticipants: boolean;
    showParticipantCount: boolean;
    autoPlay: boolean;
    participantProfiles: Map<string, any>;
  }
  ```

- [ ] Implement `renderStream(options: RenderStreamOptions): string`
  - Handle error state
  - Handle loading state (skeleton)
  - Handle ready state (full stream display)
  - Delegate to helper functions

- [ ] Implement helper functions:
  - `renderStreamHeader()` - Title, author, status badge (Planned/Live/Ended)
  - `renderStreamMedia()` - Video player (when live) or preview image (when planned/ended)
  - `renderStreamMetadata()` - Summary, hashtags, participant counts
  - `renderParticipants()` - Participant list with roles (Host, Speaker, Participant)
  - `renderError(message: string)` - Error display
  - `renderLoading()` - Skeleton loaders
  - `renderRecordingLink()` - Link to recording when stream has ended

**Dependencies:**
- Phase 2 (ParsedStreamEvent interface)

### Task 3.3: Create basic style.ts
**File:** `src/nostr-stream/style.ts`

- [ ] Import `getBaseStyles()` from common
- [ ] Implement `getStreamStyles(theme: Theme): string`
  - Call `getBaseStyles()`
  - Add component-specific CSS
  - Use CSS variables for theming
  - Style for: container, header, status badges, video player, participant list

- [ ] Define CSS for:
  - Status badges (planned/live/ended) - different colors, pulsing animation for "live"
  - Video player container - responsive aspect ratio, max-width constraints
  - Participant list items - avatar, name, role badge styling
  - Loading skeletons - shimmer animation
  - Error states - error message styling
  - Responsive design - mobile/desktop breakpoints
  - Hover states (CSS-only, no JavaScript) [[memory:8704254]]

**Dependencies:**
- Common base styles

**Testing:**
- Test component renders with valid naddr
- Test loading state display
- Test error state display
- Test attribute changes trigger re-render

---

## Phase 4: Live Subscription Implementation

**Goal:** Subscribe to stream event updates and handle real-time changes.

### Task 4.1: Implement live subscription
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add method `subscribeToStreamUpdates(pubkey: string, dTag: string)`
  - Stop existing subscription if present
  - Create filter: `{ kinds: [30311], authors: [pubkey], '#d': [dTag] }`
  - Subscribe with `closeOnEose: false` (persistent subscription) and `groupable: false`
  - Handle `event` events:
    - Check if new event is newer (`created_at > this.event.created_at`)
    - Update `this.event` and parse: `this.parsedStream = parseStreamEvent(event)`
    - Update `lastUpdateTime = Date.now()`
    - Re-load participant profiles if participant list changed
    - Re-render

- [ ] Call subscription in `onEventReady()` after initial load
- [ ] Extract pubkey and dTag from naddr decoded data (stored in Phase 1)

### Task 4.2: Implement staleness detection
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add method `startStalenessCheck()`
  - Clear existing interval
  - Set interval to check every 5 minutes (300000ms)
  - Check: if `parsedStream.status === 'live'` and `Date.now() - lastUpdateTime > 3600000` (1 hour)
  - If stale: Update `parsedStream.status` to 'ended' and re-render
  - Store interval ID in `stalenessCheckInterval` for cleanup

- [ ] Call `startStalenessCheck()` in `onEventReady()`
- [ ] Clear interval in `disconnectedCallback()`

**Dependencies:**
- Phase 1 (addressable event resolution)
- Phase 3 (component structure)

**Testing:**
- Test subscription receives updates
- Test only newer events trigger updates
- Test staleness detection works correctly
- Test subscription cleanup on disconnect

---

## Phase 5: Participant Profile Loading

**Goal:** Load and display participant profiles with roles.

### Task 5.1: Implement participant profile fetching
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Import `getBatchedProfileMetadata` from `../nostr-zap-button/zap-utils`
- [ ] Add method `async loadParticipantProfiles()`
  - Extract all participant pubkeys from `parsedStream.participants`
  - Set `participantsStatus` to Loading
  - Call `getBatchedProfileMetadata(pubkeys)`
  - Store profiles in `participantProfiles` Map
  - Set `participantsStatus` to Ready
  - Re-render

- [ ] Call `loadParticipantProfiles()` in `onEventReady()`
- [ ] Re-call when participant list changes (in subscription handler)

### Task 5.2: Update render to show participants
**File:** `src/nostr-stream/render.ts`

- [ ] Enhance `renderParticipants()` function
  - Check if `showParticipants` is true
  - Check `participantsStatus` - show skeleton loaders if Loading
  - Iterate over `parsedStream.participants` array
  - For each participant:
    - Get profile from `participantProfiles` Map by pubkey
    - Display avatar (profile.image or default fallback)
    - Display name (profile.displayName or profile.name or npub short format)
    - Display role badge (Host/Speaker/Participant) - extracted from `p` tag 3rd element
    - Display proof indicator (if proof exists) - extracted from `p` tag 4th element
    - Handle missing profiles: show npub fallback
  - Show skeleton loaders while `participantsStatus === Loading`
  - Handle empty participant list gracefully
  - Note: NIP-53 limits participant lists to 1000 users - handle large lists with scrolling

- [ ] Enhance `renderStreamMetadata()` to show participant counts
  - Check if `showParticipantCount` is true
  - Display current/total participants: `parsedStream.currentParticipants / parsedStream.totalParticipants`
  - Format as "Participants: X / Y" or similar
  - Handle missing counts gracefully

**Dependencies:**
- Phase 2 (ParsedStreamEvent with participants)
- Phase 3 (render structure)
- Existing `getBatchedProfileMetadata` from zap-utils

**Testing:**
- Test participant profiles load correctly
- Test participant list displays with roles
- Test participant count display
- Test with missing profiles (fallback to npub)
- Test with many participants (scrolling)

---

## Phase 6: Video Player Implementation

**Goal:** Add HLS video player using `hls-video-element` for cross-browser streaming support.

### Task 6.0: Install and import hls-video-element
**File:** `package.json` and `src/nostr-stream/nostr-stream.ts`

- [ ] Add dependency to `package.json`:
  ```json
  "dependencies": {
    "hls-video-element": "^1.5.10"
  }
  ```

- [ ] Import in component:
  ```typescript
  import 'hls-video-element'; // Registers <hls-video> custom element
  ```

### Task 6.1: Implement video player rendering
**File:** `src/nostr-stream/render.ts`

- [ ] Enhance `renderStreamMedia()` function
  - Check stream status:
    - If `status === 'live'` and `streamingUrl` exists: render video player
    - If `status === 'ended'` and `recordingUrl` exists: render recording link (via `renderRecordingLink()`)
    - If `status === 'planned'` or missing streaming URL: render preview image
    - Otherwise: render preview image
  - Pass `autoPlay` flag to video player renderer
  - Handle video load errors: fallback to preview image when video fails

- [ ] Add `renderVideoPlayer(url: string, autoPlay: boolean): string`
  - Return `<hls-video>` custom element (not `<video>`) with:
    - `src={url}` (HLS/M3U8 URL)
    - `controls` attribute
    - `autoplay` if autoPlay is true
    - `preload="metadata"`
    - Error handler class for fallback
    - CSS class `stream-video`
  - Note: `<hls-video>` provides HTMLMediaElement-compatible API

- [ ] Add `renderPreviewImage(imageUrl?: string): string`
  - Use `imageUrl` from parsedStream
  - Fallback to default placeholder if missing

- [ ] Add `renderRecordingLink(url: string): string`
  - Return link to recording with play icon

### Task 6.2: Implement video error handling
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add delegated event listeners in `connectedCallback()`:
  - Listen for `error` event on `.stream-video` element (works with `<hls-video>`)
  - On error: Set `videoStatus` to Error with error message
  - Re-render (will show fallback preview image)
  - Listen for `loadedmetadata` event (HTMLMediaElement event)
  - On loaded: Set `videoStatus` to Ready
  - Use `this.delegateEvent()` for efficient Shadow DOM event handling

**Dependencies:**
- Phase 3 (render structure)
- Phase 2 (ParsedStreamEvent with streamingUrl)
- `hls-video-element` npm package

**Testing:**
- Test video player renders when live
- Test `<hls-video>` element is used (not native `<video>`)
- Test hls-video-element is imported and registered correctly
- Test video player with valid HLS URL (M3U8)
- Test autoplay attribute works
- Test video error handling (fallback to image)
- Test preview image when not live
- Test recording link when ended
- Test cross-browser compatibility (Chrome, Firefox, Safari, Edge)

---

## Phase 7: Polish and Integration

**Goal:** Final touches, integration with build system, and documentation.

### Task 7.1: Register component
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add component registration:
  ```typescript
  if (!customElements.get('nostr-stream')) {
    customElements.define('nostr-stream', NostrStream);
  }
  ```

### Task 7.2: Export component
**File:** `src/index.ts`

- [ ] Import component: `import './nostr-stream/nostr-stream.ts'`
- [ ] Export class: `export { default as NostrStream } from './nostr-stream/nostr-stream.ts'`
- [ ] Add to default export object

### Task 7.3: Add to build config
**Files:** `vite.config.esm.ts`, `vite.config.umd.ts`

- [ ] Add entry point:
  ```typescript
  'nostr-stream': resolve(__dirname, 'src/nostr-stream/nostr-stream.ts')
  ```

### Task 7.4: Enhance styling
**File:** `src/nostr-stream/style.ts`

- [ ] Refine CSS for all states (loading, ready, error)
- [ ] Add responsive styles (mobile/desktop breakpoints)
- [ ] Add hover states (CSS-only, no JavaScript) [[memory:8704254]]
- [ ] Add animations for status badges (pulsing live indicator using CSS keyframes)
- [ ] Ensure theme variables work correctly (light/dark themes)
- [ ] Standardize common style variables (background color, border, skeleton color) [[memory:8640831]]
- [ ] Apply hover background style to host element (not individual containers) [[memory:8660864]]

### Task 7.5: Error handling improvements
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add try-catch blocks around async operations:
  - `resolveEventAndLoad()` - catch event resolution errors
  - `subscribeToStreamUpdates()` - catch subscription errors
  - `loadParticipantProfiles()` - catch profile fetch errors
  - Video event handlers - catch video load errors
- [ ] Set appropriate error statuses:
  - `eventStatus.set(NCStatus.Error, message)` for stream not found
  - `participantsStatus.set(NCStatus.Error, message)` for profile fetch failures
  - `videoStatus.set(NCStatus.Error, message)` for video load failures
- [ ] Display user-friendly error messages:
  - "Stream not found" - when naddr resolves to no events
  - "Invalid naddr format" - when validation fails (from EventResolver)
  - "Failed to load participants" - when profile fetching fails
  - "Video failed to load" - when video player errors
- [ ] Log errors to console for debugging (using `console.error()`)

### Task 7.6: Performance optimizations
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Debounce render calls (if rapid updates occur) - throttle to max once per 100ms
- [ ] Cache parsed stream data to avoid re-parsing on every render
- [ ] Optimize participant profile updates:
  - Only fetch profiles for new participants (compare pubkeys)
  - Reuse existing profiles from Map when participants list hasn't changed
  - Batch all profile fetches in single query (already using `getBatchedProfileMetadata`)
- [ ] Clean up subscriptions and intervals in `disconnectedCallback()` to prevent memory leaks
- [ ] Only subscribe to stream updates when component is connected

**Dependencies:**
- All previous phases

**Testing:**
- Test component registration
- Test exports work correctly
- Test build process succeeds
- Test responsive design
- Test all error scenarios

---

## Phase 8: Testing and Documentation

**Goal:** Comprehensive testing and final documentation updates.

### Task 8.1: Manual Testing
- [ ] Test with real naddr from Nostr relays
- [ ] Test all status transitions (planned → live → ended)
- [ ] Test with various participant counts
- [ ] Test on different browsers (Safari, Chrome, Firefox)
- [ ] Test responsive design on mobile devices
- [ ] Test theme switching (light/dark)

### Task 8.2: Edge Case Testing
- [ ] Test with missing optional tags (title, summary, image, streaming URL, etc.)
- [ ] Test with invalid status values (should default to 'planned' or handle gracefully)
- [ ] Test with malformed participant tags (missing pubkey, invalid roles)
- [ ] Test with network failures (relay connection loss, timeout)
- [ ] Test with relay connection issues (unreachable relays, authentication failures)
- [ ] Test with very long titles/summaries (truncation or overflow handling)
- [ ] Test with 1000+ participants (NIP-53 limit) - verify scrolling and performance
- [ ] Test status transitions (planned → live → ended)
- [ ] Test staleness detection (live stream with no updates for 1+ hour)
- [ ] Test with invalid naddr (malformed bech32, wrong type)
- [ ] Test with naddr pointing to non-existent event
- [ ] Test with naddr pointing to wrong kind (not 30311)

### Task 8.3: Documentation
- [ ] Update main README.md if needed
- [ ] Ensure spec files are complete
- [ ] Add usage examples to spec.md
- [ ] Document any known limitations

---

## Implementation Order Summary

1. **Phase 1**: Extend EventResolver and NostrEventComponent (Foundation)
2. **Phase 2**: Create stream-utils.ts (Data parsing)
3. **Phase 3**: Component skeleton and basic rendering (Core structure)
4. **Phase 4**: Live subscription (Real-time updates)
5. **Phase 5**: Participant profiles (Social features)
6. **Phase 6**: Video player (Media display)
7. **Phase 7**: Polish and integration (Production readiness)
8. **Phase 8**: Testing and documentation (Quality assurance)

---

## Key Files to Create/Modify

### New Files
- `src/nostr-stream/nostr-stream.ts` - Main component
- `src/nostr-stream/render.ts` - Rendering functions
- `src/nostr-stream/style.ts` - Component styles
- `src/nostr-stream/stream-utils.ts` - Parsing utilities
- `src/nostr-stream/spec/spec.md` - ✅ Already created
- `src/nostr-stream/spec/implementation.md` - ✅ Already created
- `src/nostr-stream/spec/testing.md` - ✅ Already created

### Files to Modify
- `src/base/resolvers/event-resolver.ts` - Add addressable event support
- `src/base/event-component/nostr-event-component.ts` - Add naddr support
- `src/index.ts` - Export component
- `vite.config.esm.ts` - Add build entry
- `vite.config.umd.ts` - Add build entry (if exists)

---

## Dependencies

### Internal
- `NostrBaseComponent` - Base functionality (relay connection, theme handling, status management, event delegation)
- `NostrEventComponent` - Event resolution (addressable events via naddr)
- `EventResolver` - Event querying (to be extended for addressable events)
- `NostrService` - Relay management
- `getBatchedProfileMetadata` from `../nostr-zap-button/zap-utils` - Profile fetching
- `formatEventDate` from `../common/date-utils` - Date formatting
- `getBaseStyles()` from `../common/base-styles` - Base CSS injection
- `decodeNip19Entity` from `../common/utils` - Optional utility for NIP-19 decoding (or use `nip19.decode` directly)

### Specification Reference
- NIP-53 Live Activities specification (see `spec/nip-53.md`)
  - Kind 30311: Live Streaming Events (this component)
  - All tags optional except `d` tag

### External
- `@nostr-dev-kit/ndk` - NDKEvent, NDKSubscription
- `nostr-tools` - nip19 decoding
- `hls-video-element` - HLS video playback custom element (cross-browser HLS support)

---

## Estimated Complexity

- **Phase 1**: Medium (extends existing infrastructure)
- **Phase 2**: Low (straightforward parsing)
- **Phase 3**: Medium (component structure setup)
- **Phase 4**: Medium (subscription logic)
- **Phase 5**: Low (reuses existing patterns)
- **Phase 6**: Low (hls-video-element custom element)
- **Phase 7**: Low (polish and configuration)
- **Phase 8**: Medium (comprehensive testing)

**Total Estimated Effort**: 3-4 days for complete implementation

---

## Notes

- Follow existing codebase patterns (like nostr-post, nostr-like)
- Use TypeScript strictly typed interfaces
- Implement proper error handling at each phase
- Test incrementally after each phase
- Keep components focused and modular
- Use delegated events for Shadow DOM efficiency (via `delegateEvent()`)
- Follow memory leak prevention patterns (cleanup in disconnectedCallback)
- Status management: Use inherited `eventStatus` and `authorStatus` from `NostrEventComponent`, don't create new `streamStatus`
- Addressable events: Store decoded naddr data (kind, pubkey, dTag, relays) for use in subscriptions
- Video player: Use `<hls-video>` custom element (not native `<video>`) for cross-browser HLS support
- Participant limits: NIP-53 recommends keeping participant lists under 1000 users - handle gracefully
- Status-based rendering: Only show video player when status is "live", show preview image otherwise
- Staleness detection: Automatically mark live streams as "ended" if no updates received for 1 hour