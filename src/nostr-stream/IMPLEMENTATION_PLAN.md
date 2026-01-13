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
  - Store decoded naddr data (kind, pubkey, dTag) for reference
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
  - `NDKEvent` from `@nostr-dev-kit/ndk`
  - `parseStreamEvent`, `ParsedStreamEvent` from `./stream-utils`
  - `renderStream`, `RenderStreamOptions` from `./render`
  - `getStreamStyles` from `./style`
  - `formatEventDate` from `../common/date-utils` (for displaying start/end times)
  - `getBatchedProfileMetadata` from `../nostr-zap-button/zap-utils` (for Phase 5, but import early)

- [ ] Create `NostrStream` class extending `NostrEventComponent`
- [ ] Add protected properties:
  ```typescript
  protected parsedStream: ParsedStreamEvent | null = null;
  protected participantProfiles: Map<string, any> = new Map();
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
  - Call `super.disconnectedCallback()`

- [ ] Implement `attributeChangedCallback()`
  - Handle `naddr` changes (re-resolve event)
  - Handle `show-participants`, `show-participant-count`, `auto-play`
  - Call super for `data-theme`, `relays`

- [ ] Implement `protected onEventReady(event: NDKEvent)`
  - Parse stream event: `this.parsedStream = parseStreamEvent(event)`
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

## Phase 4: Future Enhancement - Live Subscription Implementation

**Goal:** Subscribe to stream event updates and handle real-time changes (currently requires page refresh).

> **Note:** This phase is planned as a future enhancement. The component currently renders based on the initial event fetch. Users must refresh the page to get updated stream data.

### Task 4.1: Implement live subscription (Future)
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
    - Re-render (with video playback preservation logic)

- [ ] Call subscription in `onEventReady()` after initial load
- [ ] Extract pubkey and dTag from naddr decoded data (stored in Phase 1)
- [ ] Add `streamSubscription: NDKSubscription | null = null` property
- [ ] Add `lastUpdateTime: number = 0` property
- [ ] Clean up subscription in `disconnectedCallback()`

### Task 4.2: Implement staleness detection (Future)
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Add method `startStalenessCheck()`
  - Clear existing interval
  - Set interval to check every 5 minutes (300000ms)
  - Check: if `parsedStream.status === 'live'` and `Date.now() - lastUpdateTime > 3600000` (1 hour)
  - If stale: Update `parsedStream.status` to 'ended' and re-render
  - Store interval ID in `stalenessCheckInterval` for cleanup

- [ ] Add `stalenessCheckInterval: number | null = null` property
- [ ] Call `startStalenessCheck()` in `onEventReady()`
- [ ] Clear interval in `disconnectedCallback()`

**Dependencies:**
- Phase 1 (addressable event resolution)
- Phase 3 (component structure)

**Testing (Future):**
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
- [ ] Note: Participant list updates require page refresh (live subscriptions are future enhancement)

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

### Task 7.6: Performance optimizations (Not now. Future TODO)
**File:** `src/nostr-stream/nostr-stream.ts`

- [ ] Debounce render calls (if rapid updates occur) - throttle to max once per 100ms
- [ ] Cache parsed stream data to avoid re-parsing on every render
- [ ] Optimize participant profile updates:
  - Only fetch profiles for new participants (compare pubkeys)
  - Reuse existing profiles from Map when participants list hasn't changed
  - Batch all profile fetches in single query (already using `getBatchedProfileMetadata`)
- [ ] Clean up listeners in `disconnectedCallback()` to prevent memory leaks
- [ ] Note: Live subscriptions are a future enhancement (see Phase 4)

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
- [ ] Test status rendering (planned/live/ended from initial fetch)
- [ ] Note: Status updates require page refresh (staleness detection is future enhancement)
- [ ] Test with invalid naddr (malformed bech32, wrong type)
- [ ] Test with naddr pointing to non-existent event
- [ ] Test with naddr pointing to wrong kind (not 30311)

### Task 8.3: Documentation
- [ ] Update main README.md if needed
- [ ] Ensure spec files are complete
- [ ] Add usage examples to spec.md
- [ ] Document any known limitations

---

## Phase 9: WordPress Plugin Integration

**Goal:** Add nostr-stream component to WordPress plugin as a Gutenberg block and shortcode.

### Task 9.1: Register component in WordPress plugin registry
**File:** `saiy2k-nostr-components/inc/Registry.php`

- [ ] Add `nostr-stream` entry to `all()` method array:
  ```php
  'nostr-stream' => [
      'title'       => 'Nostr Stream',
      'description' => 'Display Nostr live streaming events (NIP-53)',
      'shortcode'   => 'nostr_stream',
      'block'       => 'nostr/nostr-stream',
      'esm'         => 'assets/nostr-stream.es.js',
      'dependencies' => [],
      'attributes'  => [
          'naddr' => ['type' => 'string'],
          'theme' => ['type' => 'string', 'enum' => ['light','dark'], 'default' => 'light'],
          'relays' => ['type' => 'string'],
          'show-participants' => ['type' => 'boolean', 'default' => true],
          'show-participant-count' => ['type' => 'boolean', 'default' => true],
          'auto-play' => ['type' => 'boolean', 'default' => false],
      ],
  ],
  ```
  - Add after existing component entries
  - Match attribute names from component spec (use kebab-case)
  - Set appropriate defaults

### Task 9.2: Create Gutenberg block definition
**File:** `saiy2k-nostr-components/blocks/nostr-stream/block.json`

- [ ] Create block.json file:
  - Set `name` to `nostr/nostr-stream`
  - Set `title` to `Nostr Stream`
  - Set `category` to `nostr`
  - Set appropriate `icon` (e.g., `video-alt3`)
  - Set `description` to match registry
  - Define `attributes` matching Registry metadata:
    - `naddr` (string, default: "")
    - `theme` (string, enum: ["", "light", "dark"], default: "")
    - `relays` (string, default: "")
    - `show-participants` (boolean, default: true)
    - `show-participant-count` (boolean, default: true)
    - `auto-play` (boolean, default: false)
  - Set `supports.html` to `false` (server-rendered)

### Task 9.3: Create Gutenberg block editor UI
**File:** `saiy2k-nostr-components/blocks/nostr-stream/index.js`

- [ ] Create block editor registration script:
  - Use `wp.blocks.registerBlockType` to register block
  - Implement `edit` function with InspectorControls:
    - Add TextControl for `naddr` attribute
      - Label: "Stream Address (naddr)"
      - Help text: "NIP-19 addressable event code (naddr1...)"
      - Placeholder: "naddr1..."
    - Add TextControl for `relays` attribute
      - Label: "Relays"
      - Help text: "Comma-separated list of Nostr relay URLs"
      - Placeholder: "wss://relay.example.com,wss://relay2.example.com"
    - Add SelectControl for `theme` attribute
      - Label: "Theme"
      - Options: "Use Site Default", "Light", "Dark"
    - Add ToggleControl for `show-participants`
      - Label: "Show Participants"
      - Help: "Display participant list with roles"
    - Add ToggleControl for `show-participant-count`
      - Label: "Show Participant Count"
      - Help: "Display current and total participant counts"
    - Add ToggleControl for `auto-play`
      - Label: "Autoplay Video"
      - Help: "Automatically play video when stream is live"
  - Implement `save` function returning `null` (server-rendered)
  - Add visual placeholder in editor showing:
    - Block title "Nostr Stream"
    - Current naddr value (if provided)
    - Icon or preview placeholder
  - Follow pattern from existing blocks (e.g., `nostr-post/index.js`)

### Task 9.4: Update build script to include nostr-stream
**File:** `scripts/wp-copy.js`

- [ ] Add `'nostr-stream'` to `components` array:
  ```javascript
  const components = [
      'nostr-post',
      'nostr-profile', 
      'nostr-profile-badge',
      'nostr-follow-button',
      'nostr-zap-button',
      'nostr-like-button',
      'nostr-stream'  // Add this line
  ];
  ```
  - Ensure component is copied during WordPress build process
  - Verify `nostr-stream.es.js` is included in manifest

### Task 9.5: Update plugin activation defaults (optional)
**File:** `saiy2k-nostr-components/saiy2k-nostr-components.php`

- [ ] Consider adding `'nostr-stream'` to default enabled components in activation hook:
  ```php
  add_option('nostr_wp_enabled_components', [
      'nostr-post', 
      'nostr-profile', 
      'nostr-profile-badge', 
      'nostr-follow-button', 
      'nostr-zap-button', 
      'nostr-like-button',
      'nostr-stream'  // Optional: add to defaults
  ]);
  ```
  - Note: This is optional - users can enable via plugin settings

### Task 9.6: Update shortcode usage examples (optional)
**File:** `saiy2k-nostr-components/inc/Shortcodes.php`

- [ ] Add `naddr` example value to `get_example_value()` method:
  ```php
  case 'naddr':
      return 'naddr1qqjr2vehvyenvdtr94nrzetr956rgctr94skvvfs95eryep3x3snwve389nxyqgwwaehxw309ahx7uewd3hkctcpz4mhxue69uhhyetvv9ujuerpd46hxtnfduhszxthwden5te0wfjkccte9eekummjwsh8xmmrd9skctcpzamhxue69uhhyetvv9ujumn0wd68ytnzv9hxgtcpz9mhxue69uhkummnw3ezumrpdejz7qg7waehxw309ahx7um5wgkhqatz9emk2mrvdaexgetj9ehx2ap0qyghwumn8ghj7mn0wd68ytnhd9hx2tcpz4mhxue69uhhyetvv9ujumn0wd68ytnzvuhsz9thwden5te0dehhxarj9ehhsarj9ejx2a30qgsv73dxhgfk8tt76gf6q788zrfyz9dwwgwfk3aar6l5gk82a76v9fgrqsqqqan8tp7le0';
  ```
  - Add to identifier priority array if needed (for shortcode usage examples)

### Task 9.7: Verify WordPress integration
- [ ] Run `npm run wp-build` to copy component to WordPress plugin
- [ ] Verify `nostr-stream.es.js` exists in `saiy2k-nostr-components/assets/`
- [ ] Verify block directory exists: `saiy2k-nostr-components/blocks/nostr-stream/`
- [ ] Test Gutenberg block in WordPress editor:
  - Block appears in "Saiy2k Nostr Components" category
  - Inspector controls work correctly
  - Attributes save and render properly
  - Preview placeholder displays correctly
- [ ] Test shortcode `[nostr_stream]` in classic editor:
  - Shortcode renders component correctly
  - Attributes pass through properly
  - Component loads and displays stream

**Dependencies:**
- Phase 1-7 (component must be fully implemented)
- Phase 8 (component should be tested before WordPress integration)

**Files to Create:**
- `saiy2k-nostr-components/blocks/nostr-stream/block.json`
- `saiy2k-nostr-components/blocks/nostr-stream/index.js`

**Files to Modify:**
- `saiy2k-nostr-components/inc/Registry.php` - Add component metadata
- `scripts/wp-copy.js` - Add to components array
- `saiy2k-nostr-components/saiy2k-nostr-components.php` - Optional: Add to default enabled components
- `saiy2k-nostr-components/inc/Shortcodes.php` - Optional: Add naddr example

**Testing:**
- Test Gutenberg block registration
- Test block editor UI and controls
- Test shortcode rendering
- Test component loading in WordPress context
- Verify component works with WordPress shared config (relays, theme)

---

## Implementation Order Summary

1. **Phase 1**: Extend EventResolver and NostrEventComponent (Foundation)
2. **Phase 2**: Create stream-utils.ts (Data parsing)
3. **Phase 3**: Component skeleton and basic rendering (Core structure)
4. **Phase 4**: Live subscription (Future enhancement - currently requires page refresh)
5. **Phase 5**: Participant profiles (Social features)
6. **Phase 6**: Video player (Media display)
7. **Phase 7**: Polish and integration (Production readiness)
8. **Phase 8**: Testing and documentation (Quality assurance)
9. **Phase 9**: WordPress plugin integration (WordPress block and shortcode)

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
- `saiy2k-nostr-components/blocks/nostr-stream/block.json` - WordPress block definition
- `saiy2k-nostr-components/blocks/nostr-stream/index.js` - WordPress block editor UI

### Files to Modify
- `src/base/resolvers/event-resolver.ts` - Add addressable event support
- `src/base/event-component/nostr-event-component.ts` - Add naddr support
- `src/index.ts` - Export component
- `vite.config.esm.ts` - Add build entry
- `vite.config.umd.ts` - Add build entry (if exists)
- `saiy2k-nostr-components/inc/Registry.php` - Add component metadata (Phase 9)
- `scripts/wp-copy.js` - Add to components array (Phase 9)
- `saiy2k-nostr-components/saiy2k-nostr-components.php` - Optional: Add to default enabled components (Phase 9)
- `saiy2k-nostr-components/inc/Shortcodes.php` - Optional: Add naddr example (Phase 9)

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
- `@nostr-dev-kit/ndk` - NDKEvent
- `nostr-tools` - nip19 decoding
- `hls-video-element` - HLS video playback custom element (cross-browser HLS support)
- `NDKSubscription` - Future enhancement for live subscriptions (Phase 4)

---

## Estimated Complexity

- **Phase 1**: Medium (extends existing infrastructure)
- **Phase 2**: Low (straightforward parsing)
- **Phase 3**: Medium (component structure setup)
- **Phase 4**: Medium (subscription logic) - Future enhancement
- **Phase 5**: Low (reuses existing patterns)
- **Phase 6**: Low (hls-video-element custom element)
- **Phase 7**: Low (polish and configuration)
- **Phase 8**: Medium (comprehensive testing)
- **Phase 9**: Low (follows existing WordPress plugin patterns)

**Total Estimated Effort**: 3-4 days for complete implementation (excluding Phase 4 future enhancement)

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
- Addressable events: Store decoded naddr data (kind, pubkey, dTag, relays) for reference
- Video player: Use `<hls-video>` custom element (not native `<video>`) for cross-browser HLS support
- Participant limits: NIP-53 recommends keeping participant lists under 1000 users - handle gracefully
- Status-based rendering: Only show video player when status is "live", show preview image otherwise
- Status updates: Component renders based on initial event fetch. Status updates require page refresh (live subscriptions and staleness detection are future enhancements - see Phase 4)