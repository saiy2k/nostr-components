# Nostr Zap Component - Technical Implementation

## Overview

This document contains the technical implementation details for the `nostr-zap` component. For component usage and API specifications, see [spec.md](./spec.md).

## Architecture

### Base Class
- Extends: `NostrUserComponent` → `NostrBaseComponent`
- Inheritance Chain: 
  - `NostrBaseComponent`: Relay connection, theme handling, status management, event delegation
  - `NostrUserComponent`: User resolution, profile fetching, user-specific logic
  - `NostrZap`: Zap-specific functionality

### Status Management
- Channel-based: Separate status channels for different concerns
  - `zapStatus`: Zap operation status (Idle, Loading, Ready, Error)
  - `amountStatus`: Zap amount fetching status (Idle, Loading, Ready, Error)
  - `userStatus`: User resolution status (inherited)
  - `connectionStatus`: Relay connection status (inherited)

### Event Handling
- Delegated Events: Uses `delegateEvent()` for efficient Shadow DOM event handling
- Click Handler: Delegated to `.nostr-zap-button` class
- Event Delegation: Prevents memory leaks and improves performance

### Rendering Architecture
- Separation of Concerns: 
  - `nostr-zap.ts`: Component logic and lifecycle
  - `render.ts`: Rendering functions and HTML generation
  - `style.ts`: CSS styles and theming (component-specific only)
  - `dialog-zap.ts`: Zap modal dialog implementation (uses DialogComponent)
  - `dialog-zap-style.ts`: Zap modal content styles
  - `dialog-help.ts`: Help dialog implementation (uses DialogComponent)
  - `dialog-help-style.ts`: Help dialog content styles
  - `dialog-zappers.ts`: Zappers dialog implementation (uses DialogComponent)
  - `dialog-zappers-style.ts`: Zappers dialog content styles
  - `zap-utils.ts`: Zap-specific utility functions

## Dependencies

### External Dependencies
- @nostr-dev-kit/ndk: User resolution and profile fetching
- nostr-tools: 
  - `SimplePool`: Relay connection and event querying
  - `nip19`: Bech32 encoding/decoding
  - `nip57`: Lightning zap utilities
  - `nip05`: Identity verification
- qrcode: QR code generation for Lightning invoices
- WebLN: Browser Lightning wallet integration

### Internal Dependencies
- NostrUserComponent: Base class for user-specific components
- UserResolver: User identity validation and resolution
- NostrService: Relay connection management
- getComponentStyles(): Utility for CSS injection with design tokens
- Common Utils: `decodeNpub()` and `decodeNip19Entity()` for NIP-19 decoding

## Component Lifecycle

### Initialization Flow
1. Constructor: Initialize `amountStatus` to Loading
2. Connected Callback: Inherited from base classes
3. Attribute Changed: Handle attribute updates including URL validation
4. Status Change: React to status updates via `onStatusChange()`
5. User Ready: Handle user resolution via `onUserReady()`

### Status Management Flow
```typescript
// Initial state
amountStatus.set(NCStatus.Loading);  // Show skeleton immediately

// User resolution (inherited)
userStatus: Idle → Loading → Ready/Error

// Zap amount fetching
amountStatus: Loading → Ready/Error

// Overall status computation
computeOverall(): Reflects the most critical status
```

## Dialog Implementation

### DialogComponent
All dialogs use the shared `DialogComponent` base class (see `src/base/dialog-component/README.md` for details).

- Purpose: Provides reusable dialog foundation with header, close button, and consistent behavior
- Benefits: Code reuse, consistent UX, automatic cleanup
- Usage: Each dialog creates a DialogComponent instance and sets content via innerHTML

### Zap Dialog Features
- Amount Presets: 21, 100, 1000 sats with custom input
- Comment Field: Optional comment with 200 character limit
- QR Code: Generated via `qrcode` library
- WebLN Integration: Direct wallet connection
- Copy Functionality: Clipboard API for invoice copying
- Payment Confirmation: Uses `listenForZapReceipt()` to detect successful payments
- URL-Based Zaps: Passes URL parameter through `OpenZapModalParams` for NIP-73 compliance
- Success State: Shows "⚡ Thank you!" overlay and hides controls

### Help Dialog Features
- Educational Content: Explains what zaps are
- YouTube Link: Hardcoded tutorial URL
- Simple Layout: Clean, centered design

### Zappers Dialog Features
- Individual Zap Details: Shows each zap with amount, date, author name, and profile picture
- Progressive Loading: Initial display with npubs in skeleton loaders, then async profile enhancement
- Author Profile Links: Clicking on zap author opens njump.me profile link
- Chronological Order: Zaps sorted by date (newest first)
- Profile Picture Fallback: Default avatar for users without profile pictures
- Responsive Layout: Adapts to different screen sizes
- Async Profile Enhancement: Profile metadata fetched in parallel, entries updated individually

### Payment Confirmation (Active)
- Function: `listenForZapReceipt()` in `zap-utils.ts`
- Purpose: Listen for zap receipt events (kind 9735) matching the invoice
- Status: ACTIVELY USED in dialog implementation
- Behavior: Shows success overlay when payment is detected

### Close Behavior
- ESC Key: Closes dialog
- Click Outside: Closes dialog
- Close Button (×): Closes dialog
- WebLN Success: Modal closes automatically after successful WebLN payment
- WebLN Failure: Modal closes automatically after failed WebLN payment
- Cleanup: Receipt listener cleanup on dialog close event

### CSS Management
- Content Styles: Separate files for each dialog type
  - `dialog-zap-style.ts`: Zap-specific content styles
  - `dialog-help-style.ts`: Help-specific content styles  
  - `dialog-zappers-style.ts`: Zappers-specific content styles
- Theme Support: Dynamic theme injection with CSS variables
- Responsive: Mobile-optimized layout (max-width: 90vw)

## Utility Functions

### Common Utilities (`src/common/utils.ts`)
- `decodeNpub()`: Decodes npub strings to hex pubkeys
- `decodeNip19Entity()`: General NIP-19 entity decoder

### Zap-Specific Utilities (`src/nostr-zap/zap-utils.ts`)
- `fetchTotalZapAmount()`: Fetches total and individual zap data with relay-side URL filtering via `#a`
- `buildUrlATag()`: Computes the deterministic `a` tag value (`39735:pubkey:url`) for a given recipient pubkey and URL
- `getProfileMetadata()`: Caches user profile data
- `getZapEndpoint()`: Resolves Lightning zap endpoints
- `fetchInvoice()`: Generates Lightning invoices with URL-based zap `a` tag
- `makeZapEvent()`: Creates zap request events with `["a", "39735:pubkey:url"]` for URL-based zaps
- `listenForZapReceipt()`: Monitors for zap payment confirmations

## Zap Count

> **Kind 39735** was chosen as the URL-zap coordinate kind. It is a custom, non-standard kind in the NIP-01 addressable range (30000–39999). No actual event of this kind is ever published — the coordinate string (`39735:pubkey:url`) is used purely as a stable `a` tag value that NIP-57 relays copy to zap receipts. Kind 39735 is also referenced by the publsp project for Lightning LSP liquidity offers; however, the `d`-field here is always a normalized URL, which is semantically distinct from publsp identifiers, making the overlap benign in practice.

### Data Fetching
- Queries kind 9735 events with `#p` tag matching user's pubkey
- Limit: 1000 events
- When `url` attribute is provided, adds `#a` filter with value `39735:<pubkey>:<normalized_url>` — the relay returns only URL-specific receipts, eliminating client-side description tag parsing
- The `a` tag value is a valid NIP-01 addressable event coordinate (kind 39735 is in the 30000–39999 addressable range); per NIP-57 Appendix E, relays copy the `a` tag from the zap request to the receipt, making relay-side `#a` filtering reliable

### Amount Calculation
- Extracts amounts from zap request description tags
- Aggregates and converts msats to sats
- Real-time data (no caching)

### Interactivity
- Clickable total opens zappers dialog
- Delegated click handler on `.total-zap-amount` class

## Individual Zaps

### Data Strategy
- Reuses data from `fetchTotalZapAmount()` (single query)
- Returns both total and individual zap details
- Same URL filtering as total amount

### Progressive Loading
- Dialog shows skeleton loaders with npubs immediately
- Profile metadata fetched in parallel
- Each entry updates independently as profile data loads

### Zap Details
- Amount from zap request description tags
- Date from event `created_at` timestamp
- Author from zap request `pubkey` field
- Sorted chronologically (newest first)

### Profile Display
- Initial: npubs in skeleton loaders
- Enhanced: Display name and profile picture from metadata
- Fallback: npub for name, default avatar for picture
- Links: njump.me URLs for author profiles
