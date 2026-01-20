# Nostr Stream Component Specification

## Overview

- Component: `nostr-stream`
- Purpose: Display live streaming events from Nostr using NIP-53
- NIP: [NIP-53 Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md)

## Features

- Display stream metadata (title, summary, image, status)
- Show HLS video player when stream status is "live"
- Display author profile information
- Show participant list with roles (Host, Speaker, Participant)
- Display participant counts (current and total)
- Status badges: Planned, Live, Ended
- Show post-event recording link when stream has ended

## Stream Event Status

### Status Values
- `planned` - Stream is scheduled but not yet live
- `live` - Stream is currently active
- `ended` - Stream has concluded

## Limitations

### Participant List Scalability
⚠️ **1000-Participant Cap**: NIP-53 states providers SHOULD keep participant lists under 1000 users. When limits are reached, providers select which participants get named. Clients should not expect a comprehensive list.

**Impact:**
- Participant list may not show all viewers/participants
- Participant counts may be approximate for large streams
- Performance degrades with many participants (fetching 1000+ profiles)

## API

### Required Attributes

- `naddr` (string) - NIP-19 addressable event code for the stream (`naddr1...` bech32-encoded)

### Optional Attributes

- `show-participants` (boolean, default: `true`) - Display participant list
- `show-participant-count` (boolean, default: `true`) - Display current/total participant counts
- `auto-play` (boolean, default: `false`) - Autoplay video when status is "live"
- `data-theme` (string, default: `"light"`) - Allowed values: `"light"` or `"dark"`
- `relays` (string) - Comma-separated relay URLs

## UI States

- **Loading**: Skeleton loaders for title, author, status badge, preview image, and summary
- **Planned**: Preview image, scheduled start time, participant counts (0/0)
- **Live**: HLS video player, live status badge, current participant counts, participant list with roles
- **Ended**: Final frame preview image, recording link (if available), final participant counts
- **Error**: Error message indicating stream could not be loaded

### Responsive Design

- Desktop: Full-width container, video player maintains aspect ratio
- Mobile: Responsive layout, video player scales to container width
- Participant list: Scrollable when many participants are present

### Live State Wireframe

```text
┌─────────────────────────────────────┐
│  🎬 Stream Title                    │
│  [Avatar] Author Name               │
│  [🔴 LIVE] Started: 15 minutes ago  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     [Video Player Controls]   │  │
│  │                               │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Summary: Stream description text   │
│  Tags: #tag1 #tag2                  │
│  Participants: 127 / 145            │
│                                     │
│  Participants:                      │
│  [👤] Host Name (Host)             │
│  [👤] Speaker Name (Speaker)       │
│  [👤] Participant Name (Participant)│
└─────────────────────────────────────┘
```

## Usage

Basic stream display:
```html
<nostr-stream naddr="naddr1..."></nostr-stream>
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