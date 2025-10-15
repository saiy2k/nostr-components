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
  - `dialog-zap.ts`: Zap modal dialog implementation
  - `dialog-zap-style.ts`: Zap modal dialog styles
  - `dialog-help.ts`: Help dialog implementation
  - `dialog-help-style.ts`: Help dialog styles
  - `zap-utils.ts`: Zap-specific utility functions

## Dependencies

### External Dependencies
- @nostr-dev-kit/ndk: User resolution and profile fetching
- nostr-tools: 
  - `SimplePool`: Relay connection and event querying
  - `nip19`: Bech32 encoding/decoding
  - `nip57`: Lightning zap utilities
  - `nip05`: Identity verification
- **qrcode**: QR code generation for Lightning invoices
- **WebLN**: Browser Lightning wallet integration

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

### Global Shadow DOM
- Purpose: Ensures proper z-index layering above all content
- Implementation: `ensureShadow()` creates global shadow root
- CSS Injection: Dynamic CSS injection via `injectCSS()` with theme support
- Style Management: Prevents style accumulation with cleanup logic

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
- Easy Dismissal: Click outside or close button

### Payment Confirmation (Active)
- Function: `listenForZapReceipt()` in `zap-utils.ts`
- Purpose: Listen for zap receipt events (kind 9735) matching the invoice
- Status: ACTIVELY USED in dialog implementation
- Behavior: Shows success overlay when payment is detected

### Close Behavior
- Manual Close: User clicks close button (×) - `dialog.close()`
- WebLN Success: Modal closes automatically after successful WebLN payment
- WebLN Failure: Modal closes automatically after failed WebLN payment
- Cleanup: Receipt listener cleanup on dialog close event

### CSS Management
- Style Files: Separate files for each dialog type
- Theme Support: Dynamic theme injection with CSS variables
- Responsive: Mobile-optimized layout (max-width: 90vw)
- Cleanup: Prevents style accumulation in global shadow DOM

## Utility Functions Organization

### Common Utilities (`src/common/utils.ts`)
- `decodeNpub()`: Decodes npub strings to hex pubkeys
- `decodeNip19Entity()`: General NIP-19 entity decoder
- Purpose: Shared utilities across all components
- Benefits: Reusability, consistency, single source of truth

### Zap-Specific Utilities (`src/nostr-zap/zap-utils.ts`)
- `fetchTotalZapAmount()`: Fetches and calculates total zap amounts with optional URL filtering
- `getProfileMetadata()`: Caches and retrieves user profile data
- `getZapEndpoint()`: Resolves Lightning zap endpoints
- `fetchInvoice()`: Generates Lightning invoices with optional URL-based zap tags
- `makeZapEvent()`: Creates zap request events with optional URL tags (NIP-73 compliance)
- `listenForZapReceipt()`: Monitors for zap payment confirmations
- Purpose: Zap-specific functionality including URL-based zaps

## Zap Count Implementation

### Data Fetching
- Method: `fetchTotalZapAmount()` in `zap-utils.ts`
- Query: `pool.querySync()` for kind 9735 events
- Filter: `#p` tag matching user's pubkey
- URL Filtering: When URL provided, adds `#k: ["web"]` and `#i: [url]` filters for granular tracking
- Limit: 1000 events for performance

### Amount Calculation
- Source: Zap receipt events (kind 9735)
- Parsing: Extract amount from zap request description tags
- Aggregation: Sum all amounts and convert msats to sats
- URL Filtering: Only includes zaps matching specific URL when provided (follows NIP-73)
- Caching: No caching - real-time data

### Error Handling
- Network Errors: Graceful fallback, no error state
- Parse Errors: Logged but don't break functionality
- URL Validation: Invalid URLs show error state in component
- Pool Management: Proper cleanup with `pool.close()`
