# Nostr Zap Component Specification

## Overview

- Component Name: `nostr-zap`
- Purpose: Allow users to send zaps (Lightning Network payments) to Nostr users
- Architecture: Extends `NostrUserComponent` → `NostrBaseComponent`
- Inheritance: Inherits user resolution, relay management, theme handling, and status management from base classes

## Functional Requirements

### Core Features
- Resolve user identity from npub/nip05/pubkey attributes
- Display zap button with Lightning icon and custom text
- Show help icon (?) with outlined style next to zap amount
- Open modal dialog for amount selection and payment
- Open help dialog explaining what zaps are with YouTube link
- Generate Lightning invoice via NIP-57
- Display total zap amount received by the user (clickable)
- Open zappers dialog showing individual zap details
- Handle payment success/failure states
- Support both fixed amounts and custom amount selection

### User Resolution
- Supported: npub, nip05, pubkey
- Validation: Handled by inherited UserResolver
- Caching: User profile cached by base component

### Zap Flow
1. User clicks zap button
2. Open modal with amount presets (21, 100, 1000 sats)
3. User selects/customizes amount and adds comment
4. Generate Lightning invoice via NIP-57
5. Display QR code and wallet links
6. User completes payment in external wallet
7. Payment Confirmation: Listen for zap receipt events (kind 9735)
8. Success State: Show "⚡ Thank you!" overlay
9. Close: User clicks close button (×) or modal closes automatically after WebLN payment

### URL-Based Zaps
When the `url` attribute is provided:
- Zap requests include additional tags: `["k", "web"]` and `["i", url]`
- Total zap amount filtering includes these tags to show only zaps sent to the specific URL
- Enables content creators to receive zaps for specific articles, posts, or URLs

### Modal Features
- Amount presets with custom input
- Optional comment field (max 200 chars)
- QR code generation for mobile wallets
- WebLN integration for browser wallets
- Copy invoice to clipboard
- Payment Confirmation: Automatic detection via zap receipt events
- Success Feedback: "⚡ Thank you!" overlay with hidden controls
- Close Methods: Manual close button (×) or automatic close after WebLN payment

### Zap Count
- Purpose: Display total sats received by the user
- Display: Shows outside button, horizontally aligned
- Loading: Shows skeleton loader while fetching
- Interactive: Clickable to open zappers dialog

## API Specification

### Required Attributes
At least one user identifier must be provided:

- npub: Bech32-encoded public key (npub1...)
- nip05: NIP-05 identifier (user@domain.com)
- pubkey: Raw hex-encoded public key (64 chars)

### Optional Attributes

#### `text`
- Type: string
- Default: "Zap"
- Description: Custom text displayed on button
- Validation: Max 128 characters
- Example: `text="Send Sats!"`

#### `amount`
- Type: string
- Default: undefined
- Description: Fixed zap amount in sats (no amount selection in modal)
- Validation: 1-210,000 sats
- Example: `amount="5000"`

#### `default-amount`
- Type: string
- Default: 21
- Description: Default amount shown in modal (user can change)
- Validation: 1-210,000 sats
- Example: `default-amount="100"`

#### `url`
- Type: string
- Default: undefined
- Description: URL to send zap to (enables URL-based zaps)
- Validation: Valid URL format
- Example: `url="https://example.com/article"`
- Behavior: When provided, zap requests include `["k", "web"]` and `["i", url]` tags

#### `theme`
- Type: string
- Default: "light"
- Description: Component theme
- Options: light, dark
- Inherited: From NostrBaseComponent

#### `relays`
- Type: string
- Default: DEFAULT_RELAYS
- Description: Comma-separated relay URLs
- Inherited: From NostrBaseComponent
- Example: `relays="wss://relay1.com,wss://relay2.com"`

### CSS Variables

#### Icon Sizing
- `--nostrc-icon-width`: Width of Lightning icon (default: 25px)
- `--nostrc-icon-height`: Height of Lightning icon (default: 25px)
- `--nostrc-help-icon-size`: Size of help icon (default: 16px)

#### Button Styling
- `--nostrc-zap-btn-padding`: Button padding
- `--nostrc-zap-btn-border-radius`: Button border radius
- `--nostrc-zap-btn-bg`: Button background color
- `--nostrc-zap-btn-color`: Button text color
- `--nostrc-zap-btn-hover-bg`: Button hover background
- `--nostrc-zap-btn-hover-color`: Button hover text color
- `--nostrc-zap-btn-hover-border`: Button hover border

## Wireframes

Visual wireframes showing all component states and behaviors:

![Nostr Zap Component Wireframes](./wireframes.png)

### Layout States

#### Default State
```text
┌─────────────┐ 1,234 ⚡ (?)
│ [⚡ Zap]    │
└─────────────┘
```
- Lightning icon + custom text
- Zap amount displayed outside button
- Help icon (?) with outlined style
- Horizontal alignment

#### Loading State
```text
┌─────────────────┐ [skeleton-loader]
│ [⚡ skeleton-loader...] │
└─────────────────┘
```
- Lightning icon stays visible
- Button text shows skeleton loader animation
- Zap amount shows skeleton loader animation
- Both load independently (button ready before amount)

#### Error State
```text
┌─────────────────────────────────┐
│ ⚠️  Error message here          │
└─────────────────────────────────┘
```
- Warning icon on left
- Error message on right
- Red border around container
- Similar to profile-badge error pattern

#### Success State
```text
┌─────────────┐ 1,234 ⚡
│ [✓ Zap Sent!] │
└─────────────┘
```
- Success checkmark icon
- Success message
- Temporary state after successful zap

### Interactive States

#### Hover State
```text
┌─────────────┐ 1,234 ⚡
│ [⚡ Zap]    │ ← Hovered (background changes)
└─────────────┘
```
- Only button triggers hover effect
- Zap amount area has no hover effect
- Smooth transition (0.2s ease)

#### Disabled State
- Opacity: 0.6
- Cursor: not-allowed
- Pointer Events: none

### Modal Dialog Layout

```text
┌─────────────────────────────────────┐
│            Send a Zap           [×] │
├─────────────────────────────────────┤
│ [21 ⚡]      [100 ⚡]      [1000 ⚡]   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Custom sats: [________] [Update]│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Comment: [_____________] [Add]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │        QR Code Here             │ │
│ └─────────────────────────────────┘ │
│                                     │
│                 [Copy]              │
│            [Open in Wallet]         │
└─────────────────────────────────────┘
```

### Help Dialog Layout

```text
┌─────────────────────────────────────┐
│            What is a Zap?        [×] │
├─────────────────────────────────────┤
│                                     │
│ A zap is a Lightning Network        │
│ payment sent to a Nostr user.      │
│                                     │
│ Zaps allow you to:                  │
│ • Send micropayments instantly      │
│ • Support content creators          │
│ • Show appreciation for posts      │
│                                     │
│ Learn more about zaps:              │
│ ┌─────────────────────────────────┐ │
│ │    [Watch YouTube Tutorial]      │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Zappers Dialog Layout

#### Initial State (with npubs in skeleton loaders)
```text
┌─────────────────────────────────────┐
│              Zappers             [×] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1abc123...        │ │
│ │     500 ⚡ • 2 hours ago         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1def456...        │ │
│ │     1,000 ⚡ • 1 day ago          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1ghi789...        │ │
│ │     250 ⚡ • 3 days ago           │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### Progressive Enhancement (as profiles load)
```text
┌─────────────────────────────────────┐
│              Zappers             [×] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👤] Alice Smith                │ │
│ │     500 ⚡ • 2 hours ago         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [skeleton] npub1def456...        │ │
│ │     1,000 ⚡ • 1 day ago          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👤] Charlie Brown               │ │
│ │     250 ⚡ • 3 days ago           │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Responsive Behavior

- Desktop: Full modal dialog (424px width)
- Mobile: Modal adapts to screen (max-width: 90vw)
- Button: Maintains minimum height (47px) across all sizes
- Amount: Text scales with font size settings

## Usage Examples

### Basic
```html
<nostr-zap npub="npub1..."></nostr-zap>
```

### Custom Text
```html
<nostr-zap npub="npub1..." text="Send Sats!"></nostr-zap>
```

### Fixed Amount
```html
<nostr-zap npub="npub1..." amount="5000"></nostr-zap>
```

### NIP-05
```html
<nostr-zap nip05="user@domain.com"></nostr-zap>
```

### URL-Based Zap
```html
<nostr-zap npub="npub1..." url="https://example.com/article"></nostr-zap>
```

### URL-Based Zap with Custom Text
```html
<nostr-zap 
  npub="npub1..." 
  url="https://example.com/article"
  text="Support this article">
</nostr-zap>
```

### With Help Icon
```html
<nostr-zap 
  npub="npub1..." 
  text="Send Zap">
</nostr-zap>
```

### Custom Styling
```html
<nostr-zap 
  npub="npub1..." 
  style="
    --nostrc-icon-width: 30px;
    --nostrc-icon-height: 30px;
    --nostrc-zap-btn-bg: #ff6b35;
    --nostrc-zap-btn-color: white;
  ">
</nostr-zap>
```

### Dark Theme
```html
<nostr-zap npub="npub1..." data-theme="dark"></nostr-zap>
```

## Zappers Dialog

### Features
- **Title**: "Zappers" with close button (×)
- **Individual Zap Details**: Each zap shows:
  1. Zap amount (in sats with ⚡ symbol)
  2. Zap date (relative time, e.g., "2 hours ago")
  3. Zap author's name (from profile metadata)
  4. Zap author's profile picture (with fallback)
- **Progressive Loading**: Shows npubs immediately in skeleton loaders, then enhances with profile data
- **Interactive Elements**:
  - Clicking on zap author opens njump.me profile link
  - Close button dismisses dialog
  - Click outside dialog dismisses dialog
- **Data Source**: Fetches individual zap receipt events (kind 9735)
- **URL Filtering**: Respects URL attribute for URL-based zaps
- **Sorting**: Chronological order (newest first)
- **Loading States**: Skeleton loaders with npubs, then progressive profile enhancement

### Dialog Behavior
- **Trigger**: Clicking on total zap amount when zaps are available
- **Immediate Display**: Dialog opens instantly showing skeleton loaders with npubs
- **Progressive Enhancement**: Profile metadata loads in background, updates entries individually
- **Responsive**: Adapts to screen size (max-width: 90vw on mobile)
- **Theme Support**: Inherits component theme (light/dark)
- **Accessibility**: Keyboard navigation and screen reader support

### Profile Integration
- **Initial Display**: Shows npubs in skeleton loaders for immediate context
- **Progressive Loading**: Each profile metadata loads independently and updates its entry
- **Author Names**: Uses display name from profile metadata, falls back to npub
- **Profile Pictures**: Uses avatar from profile metadata, falls back to default avatar
- **Profile Links**: njump.me URLs format: `https://njump.me/npub1...`
- **Async Enhancement**: Profile data fetched in parallel, entries updated individually
