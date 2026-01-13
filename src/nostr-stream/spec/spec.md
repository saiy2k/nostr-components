# Nostr Stream Component Specification

## Overview

- Component: `nostr-stream`
- Purpose: Display live streaming events from Nostr using NIP-53
- NIP: [NIP-53 Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md)

## Features

- Display live streaming event metadata (title, summary, image, status)
- Show video player with streaming URL (when status is "live")
- Display author profile information
- Show participant list with roles (Host, Speaker, Participant)
- Display participant counts (current and total)
- Automatically updates when stream status or participants change
- Status badges: Planned, Live, Ended
- Handle status transitions (planned → live → ended)
- Show post-event recording link when ended

## Stream Event Status

### Status Values
- `planned` - Stream is scheduled but not yet live
- `live` - Stream is currently active
- `ended` - Stream has concluded

### Status Transitions
- Component automatically updates when stream status changes
- If a live stream hasn't updated in 1 hour, it will be considered `ended`

## Limitations

### Participant List Scalability
⚠️ **1000-Participant Cap**: NIP-53 states providers SHOULD keep participant lists under 1000 users. When limits are reached, providers select which participants get named. Clients should not expect a comprehensive list.

**Impact:**
- Participant list may not show all viewers/participants
- Participant counts may be approximate for large streams
- Performance degrades with many participants (fetching 1000+ profiles)

## API

### Required Attributes

- `naddr` (string) - NIP-19 addressable event code for the stream
  - Format: `naddr1...` (bech32-encoded)
  - Example: `naddr1qqjr2vehvyenvdtr94nrzetr956rgctr94skvvfs95eryep3x3snwve389nxyqgwwaehxw309ahx7uewd3hkctcpz4mhxue69uhhyetvv9ujuerpd46hxtnfduhszxthwden5te0wfjkccte9eekummjwsh8xmmrd9skctcpzamhxue69uhhyetvv9ujumn0wd68ytnzv9hxgtcpz9mhxue69uhkummnw3ezumrpdejz7qg7waehxw309ahx7um5wgkhqatz9emk2mrvdaexgetj9ehx2ap0qyghwumn8ghj7mn0wd68ytnhd9hx2tcpz4mhxue69uhhyetvv9ujumn0wd68ytnzvuhsz9thwden5te0dehhxarj9ehhsarj9ejx2a30qgsv73dxhgfk8tt76gf6q788zrfyz9dwwgwfk3aar6l5gk82a76v9fgrqsqqqan8tp7le0`

### Optional Attributes

- `show-participants` (boolean, default: `true`) - Display participant list
- `show-participant-count` (boolean, default: `true`) - Display current/total participant counts
- `auto-play` (boolean, default: `false`) - Autoplay video when status is "live"
- `data-theme` (string, default: `"light"`) - Allowed values: `"light"` or `"dark"`
- `relays` (string) - Comma-separated relay URLs

## Wireframes

### States

#### Loading
```text
┌─────────────────────────────────────┐
│  [Skeleton: Stream Title]           │
│  [Skeleton: Author Avatar + Name]   │
│  [Skeleton: Status Badge]           │
│  [Skeleton: Preview Image]          │
│  [Skeleton: Summary Text]           │
│  [Skeleton: Participant Count]      │
└─────────────────────────────────────┘
```

#### Planned Status
```text
┌─────────────────────────────────────┐
│  🎬 Adult Swim Metalocalypse        │
│  [Avatar] Author Name               │
│  [🟡 Planned] Starts: 2 hours      │
├─────────────────────────────────────┤
│  [Preview Image Placeholder]        │
│  ⏸️ Stream starts in 2 hours        │
├─────────────────────────────────────┤
│  Summary: Live stream from IPTV-ORG │
│  Tags: #animation #iptv             │
│  Participants: 0 / 0                │
└─────────────────────────────────────┘
```

#### Live Status
```text
┌─────────────────────────────────────┐
│  🎬 Adult Swim Metalocalypse        │
│  [Avatar] Author Name               │
│  [🔴 LIVE] Started: 15 minutes ago  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     [Video Player Controls]   │  │
│  │                               │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Summary: Live stream from IPTV-ORG │
│  Tags: #animation #iptv             │
│  Participants: 127 / 145            │
│                                     │
│  Participants:                      │
│  [👤] Host Name (Host)             │
│  [👤] Speaker Name (Speaker)       │
│  [👤] Participant Name (Participant)│
└─────────────────────────────────────┘
```

#### Ended Status
```text
┌─────────────────────────────────────┐
│  🎬 Adult Swim Metalocalypse        │
│  [Avatar] Author Name               │
│  [⚫ Ended] Ended: 1 hour ago       │
├─────────────────────────────────────┤
│  [Final Frame Preview Image]        │
│  ▶️ Watch Recording                 │
├─────────────────────────────────────┤
│  Summary: Live stream from IPTV-ORG │
│  Tags: #animation #iptv             │
│  Participants: 145 / 145            │
│                                     │
│  Participants: (collapsed)          │
└─────────────────────────────────────┘
```

#### Error State
```text
┌─────────────────────────────────────┐
│  ⚠️ Stream not found                │
│  The stream event could not be      │
│  loaded from the specified relays.  │
└─────────────────────────────────────┘
```

### Responsive

- Desktop: Full-width container, video player maintains aspect ratio
- Mobile: Responsive with max-width 100%, video player scales to container
- Participant list: Scrollable if many participants

## Usage

Basic stream display:
```html
<nostr-stream naddr="naddr1qqjr2vehvyenvdtr94nrzetr956rgctr94skvvfs95eryep3x3snwve389nxyqgwwaehxw309ahx7uewd3hkctcpz4mhxue69uhhyetvv9ujuerpd46hxtnfduhszxthwden5te0wfjkccte9eekummjwsh8xmmrd9skctcpzamhxue69uhhyetvv9ujumn0wd68ytnzv9hxgtcpz9mhxue69uhkummnw3ezumrpdejz7qg7waehxw309ahx7um5wgkhqatz9emk2mrvdaexgetj9ehx2ap0qyghwumn8ghj7mn0wd68ytnhd9hx2tcpz4mhxue69uhhyetvv9ujumn0wd68ytnzvuhsz9thwden5te0dehhxarj9ehhsarj9ejx2a30qgsv73dxhgfk8tt76gf6q788zrfyz9dwwgwfk3aar6l5gk82a76v9fgrqsqqqan8tp7le0"></nostr-stream>
```

Hide participant list:
```html
<nostr-stream naddr="naddr1..." show-participants="false"></nostr-stream>
```

Autoplay video (when live):
```html
<nostr-stream naddr="naddr1..." auto-play="true"></nostr-stream>
```

Dark theme:
```html
<nostr-stream naddr="naddr1..." data-theme="dark"></nostr-stream>
```

Custom relays:
```html
<nostr-stream naddr="naddr1..." relays="wss://relay1.com,wss://relay2.com"></nostr-stream>
```

Hide participant count:
```html
<nostr-stream naddr="naddr1..." show-participant-count="false"></nostr-stream>
```

## Participant Roles

The component displays participant roles as defined by NIP-53:

- `Host` - Full stream management capabilities
- `Speaker` - Allowed to present/speak in stream
- `Participant` - Regular participant/viewer

Participants with proof are verified participants who agreed to join. Participants without proof may be displayed as "invited".

For technical details about the event structure and implementation, see [NIP-53 Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md).

## Future Enhancements

- Live event subscriptions: Real-time updates when stream status or participants change
- Live chat integration (kind:1311 events with `a` tag reference)
- Meeting spaces support (kind:30312, 30313)
- Participant proof verification
- Zap button integration for streams
- Full-screen video mode
- Video quality selector (if HLS with multiple variants)
- Real-time participant presence indicators
- Enhanced video player controls
- Notification when stream goes live
- Staleness detection: Marking live streams as ended if no updates received for extended period