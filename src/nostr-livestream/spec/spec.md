# Nostr Livestream Component Specification

## Overview

- Component: `nostr-livestream`
- Purpose: Display live streaming events from Nostr using NIP-53
- NIP: [NIP-53 Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md)

## Features

- Display livestream metadata (title, summary, image, status)
- Show HLS video player when livestream status is "live"
- Display author profile information
- Show participant list with roles (Host, Speaker, Participant)
- Display participant counts (current and total)
- Status badges: Planned, Live, Ended
- Show post-event recording link when livestream has ended

## Livestream Event Status

### Status Values
- `planned` - Livestream is scheduled but not yet live
- `live` - Livestream is currently active
- `ended` - Livestream has concluded

## Limitations

### Participant List Scalability
⚠️ **1000-Participant Cap**: NIP-53 states providers SHOULD keep participant lists under 1000 users. When limits are reached, providers select which participants get named. Clients should not expect a comprehensive list.

**Impact:**
- Participant list may not show all viewers/participants
- Participant counts may be approximate for large livestreams
- Performance degrades with many participants (fetching 1000+ profiles)

## API

### Required Attributes

- `naddr` (string) - NIP-19 addressable event code for the livestream (`naddr1...` bech32-encoded)

### Optional Attributes

- `show-participants` (boolean, default: `true`) - Display participant list
- `show-participant-count` (boolean, default: `true`) - Display current/total participant counts
- `auto-play` (boolean, default: `false`) - Autoplay video when status is "live"
- `data-theme` (string, default: `"light"`) - Allowed values: `"light"` or `"dark"`
- `relays` (string) - Comma-separated relay URLs

## UI States

- **Loading**: Skeleton loaders for title, author, status badge, preview image, and summary
- **Planned**: Preview image, scheduled start time
- **Live**: HLS video player, live status badge, current participant counts, participant list with roles
- **Ended**: Final frame preview image, recording link (if available), final participant counts
- **Error**: Error message when livestream cannot be loaded

### Responsive Design

- Desktop: Full-width container, video player maintains aspect ratio
- Mobile: Responsive layout, video player scales to container width
- Participant list: Scrollable when many participants are present

### Live State Wireframe

```text
┌─────────────────────────────────────┐
│  🎬 Livestream Title                │
│  [Avatar] Author Name               │
│  [🔴 LIVE] Started: 15 minutes ago  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     [Video Player Controls]   │  │
│  │                               │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Summary: Livestream description    │
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

Basic livestream display:
```html
<nostr-livestream naddr="naddr1..."></nostr-livestream>
```

Hide participant list:
```html
<nostr-livestream naddr="naddr1..." show-participants="false"></nostr-livestream>
```

Autoplay video (when live):
```html
<nostr-livestream naddr="naddr1..." auto-play="true"></nostr-livestream>
```

Dark theme:
```html
<nostr-livestream naddr="naddr1..." data-theme="dark"></nostr-livestream>
```

Custom relays:
```html
<nostr-livestream naddr="naddr1..." relays="wss://relay1.com,wss://relay2.com"></nostr-livestream>
```

Hide participant count:
```html
<nostr-livestream naddr="naddr1..." show-participant-count="false"></nostr-livestream>
```

## Participant Roles

The component displays participant roles as defined by NIP-53:

- `Host` - Full livestream management capabilities
- `Speaker` - Allowed to present/speak in livestream
- `Participant` - Regular participant/viewer

Participants with proof are verified participants who agreed to join. Participants without proof may be displayed as "invited".

