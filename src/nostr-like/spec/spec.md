# Nostr Like Component Specification

## Overview

- Component: `nostr-like`
- Purpose: Like/unlike web pages using Nostr reactions
- Architecture: Extends `NostrBaseComponent`
- NIP: [NIP-25 External Content Reactions (kind 17)](https://github.com/nostr-protocol/nips/blob/master/25.md#external-content-reactions)

## Features

- Display like button with thumbs-up icon and like count
- Show net like count (likes minus unlikes) for current or specified URL
- Click button to like (one-way action initially)
- If already liked, show confirmation dialog to unlike
- Unlike publishes kind 17 event with '-' content
- Click count to view individual likers/dislikers in modal
- Progressive profile loading in likers dialog
- Help icon/dialog that explain this component

## Like/Unlike Flow

### Like
1. User clicks like button
2. Check for NIP-07 extension (browser signer) // TODO: Onboarding module
3. Check current user's like status
4. If not liked, create kind 17 reaction event with '+' content
5. Request user signature
6. Broadcast to relays
7. Update button state to liked
8. Refresh like count

### Unlike
1. User clicks like button (when already liked)
2. Check for NIP-07 extension (browser signer) // TODO: Onboarding module
3. Check current user's like status
4. Show confirmation dialog: "You have already liked this. Do you want to unlike it?"
5. If confirmed, create kind 17 reaction event with '-' content
6. Request user signature
7. Broadcast to relays
8. Update button state to not liked
9. Refresh like count

## Limitations

### Like Count Scalability
⚠️ **1000-Event Cap**: The component queries up to 1000 reaction events (kind 17) per URL. For viral content, this may result in undercounting total likes.
Hint: Nip-45

**Impact:**
- Total net like count (likes minus unlikes) may not reflect all reactions
- Likers/dislikers list may not show all contributors
- Performance degrades with many reactions (fetching 1000+ profiles)

## API

### Required Attributes

None - works out of the box with current page URL.

### Optional Attributes

- `url` (string) - URL to like/unlike (default: current page URL)
  - URLs are normalized for consistency (normalizeURL from nostr-tools)
  - Without this attribute, the component automatically uses the current page URL
- `text` (string, default: "Like") - Button text (max 32 chars)
- `data-theme` (string, default: "light") - Allowed values: "light" or "dark"
- `relays` (string) - Comma-separated relay URLs

### CSS Variables

Icon:
- `--nostrc-icon-width` (default: 20px)
- `--nostrc-icon-height` (default: 20px)

Button:
- `--nostrc-like-btn-padding` (default: 8px 16px)
- `--nostrc-like-btn-border-radius` (default: 4px)
- `--nostrc-like-btn-bg` (default: #f0f2f5)
- `--nostrc-like-btn-color` (default: #65676b)
- `--nostrc-like-btn-hover-bg` (default: #e4e6eb)
- `--nostrc-like-btn-liked-bg` (default: #e7f3ff)
- `--nostrc-like-btn-liked-color` (default: #1877f2)

Count:
- `--nostrc-like-count-color` (default: #65676b)

## Wireframes

### States

Default (Not Liked):
```text
┌──────────┐
│ 👍 Like  │ 3 likes (?)
└──────────┘
```

Liked:
```text
┌──────────┐
│ 👍 Liked │ 4 likes (?)
└──────────┘
(button has blue background/text, text changes to "Liked")
```

Note: Count shows net likes (likes - unlikes). Negative counts are possible.

Loading:
```text
┌──────────────┐
│ 👍 skeleton  │ [skeleton] (?)
└──────────────┘
```

Error:
```text
┌─────────────────────────────────┐
│ ⚠️  Error message here          │
└─────────────────────────────────┘
```

No Likes:
```text
┌──────────┐
│ 👍 Like  │ (?)
└──────────┘
```

### Likers Dialog Layout

#### Initial State (with npubs in skeleton loaders)
```text
┌─────────────────────────────────────┐
│              Likers             [×] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1abc123...       │ │
│ │     2 hours ago . Liked         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1def456...       │ │
│ │     1 day ago . Liked           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1ghi789...       │ │
│ │     3 days ago . Disliked       │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### Progressive Enhancement (as profiles load)
```text
┌─────────────────────────────────────┐
│              Likers             [×] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👤] Alice Smith                │ │
│ │     2 hours ago . Liked         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1def456...       │ │
│ │     1 day ago . Liked           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👤] Charlie Brown              │ │
│ │     3 days ago . Disliked       │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Responsive

- Desktop: min-width auto, max-content
- Mobile: responsive with max-width 90vw for dialog
- Button: min-height 36px

## Usage

Basic (likes current page):
```html
<nostr-like></nostr-like>
```

Specific URL:
```html
<nostr-like url="https://saiy2k.in/2025/04/01/nostr-components/"></nostr-like>
```

Custom text:
```html
<nostr-like text="Love it!"></nostr-like>
```

Dark theme:
```html
<nostr-like data-theme="dark"></nostr-like>
```

Custom relays:
```html
<nostr-like relays="wss://relay1.com,wss://relay2.com"></nostr-like>
```

Custom styling:
```html
<nostr-like style="
  --nostrc-icon-width: 24px;
  --nostrc-like-btn-bg: #f0f0f0;
  --nostrc-like-btn-liked-color: #ff0000;
"></nostr-like>
```

## Likers Dialog

Shows individual like details with progressive loading:
- Triggered by clicking like count
- Opens instantly with skeleton loaders showing npubs
- Profile metadata loads in background
- Each entry updates independently as data loads

Each reaction entry shows:
- Author name (from profile metadata, fallback to npub)
- Profile picture (from metadata, fallback to default emoji)
- Time of reaction (relative time)
- Reaction type badge: "Liked" (blue) or "Disliked" (red)
- Clickable link to njump.me profile

## Help Dialog

### Content

**Header:** "What is a Like?"

**Body:**
- A like is a reaction stored on Nostr using NIP-25 kind 17 events
- This component uses URL-based likes with kind 17 events

**Features:**
- One-click liking of any URL
- View who liked your content
- See total like counts
- All data stored on Nostr relays

**Requirement:**
Requires a Nostr browser extension (Alby, nos2x, etc.) to sign and publish likes. // TODO:Onboarding

## NIP-25 Event Structure

### Like Event (kind 17)
```json
{
  "kind": 17,
  "content": "+",
  "tags": [
    ["k", "web"],
    ["i", "https://saiy2k.in/2025/04/01/nostr-components/"]
  ],
  "created_at": 1234567890,
  "pubkey": "user_pubkey_hex"
}
```### Unlike Event (kind 17)
```json
{
  "kind": 17,
  "content": "-",
  "tags": [
    ["k", "web"],
    ["i", "https://saiy2k.in/2025/04/01/nostr-components/"]
  ],
  "created_at": 1234567890,
  "pubkey": "user_pubkey_hex"
}
```
## Future Enhancements

- Reaction emoji support (heart, fire, etc.) beyond just like (+) /unlike (-)
- Anonymous reactions (without NIP-07)
- Bulk profile fetching optimization (NIP-45)
- Pagination for 1000+ likes
- Real-time updates via subscriptions


