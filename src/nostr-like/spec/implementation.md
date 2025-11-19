# Nostr Like Component - Technical Implementation

## Overview

This document contains the technical implementation details for the `nostr-like` component. For component usage and API specifications, see [spec.md](./spec.md).

## Architecture

### Base Class
- Extends: `NostrBaseComponent`
- Inheritance Chain: 
  - `NostrBaseComponent`: Relay connection, theme handling, status management, event delegation
  - `NostrLike`: Like-specific functionality

### Status Management
- Channel-based: Separate status channels for different concerns
  - `likeActionStatus`: Like/unlike operation status (Idle, Loading, Ready, Error)
  - `likeListStatus`: Like count fetching status (Idle, Loading, Ready, Error)
  - `connectionStatus`: Relay connection status (inherited)

### Event Handling
- Delegated Events: Uses `delegateEvent()` for efficient Shadow DOM event handling
- Button Click: Delegated to `.nostr-like-button` class → triggers like/unlike
- Count Click: Delegated to `.like-count` class → opens likers dialog
- Help Click: Delegated to `.help-icon` class → opens help dialog
- Event Delegation: Prevents memory leaks and improves performance

### Rendering Architecture
- Separation of Concerns: 
  - `nostr-like.ts`: Component logic and lifecycle
  - `render.ts`: Rendering functions and HTML generation
  - `style.ts`: CSS styles and theming (component-specific)
  - `dialog-likers.ts`: Likers modal dialog implementation (uses DialogComponent)
  - `dialog-likers-style.ts`: Likers modal content styles
  - `like-utils.ts`: Like-specific utility functions
  - `dialog-help.ts`: Help modal dialog implementation (uses DialogComponent)
  - `dialog-help-style.ts`: Help modal content styles

## Dependencies

### Internal Dependencies
- NostrBaseComponent: Base class with relay and status management
- NostrService: Relay connection management
- getComponentStyles(): Utility for CSS injection
- Common Utils: `formatRelativeTime()`
- Zap Utils: `getBatchedProfileMetadata()` (reused for profile fetching)

## Component Lifecycle

### Initialization Flow
1. Constructor: Initialize `likeListStatus` to Loading
2. Connected Callback: 
   - Validate inputs (URL, relays, text)
   - Connect to relays (inherited)
   - Attach delegated listeners
   - Render initial state
3. Attribute Changed: Handle URL, text, data-theme updates
4. Status Change: React to status updates via `onStatusChange()`, `onNostrRelaysConnected()`

## Like State Management

### Like/Unlike Action Flow
```typescript
handleLikeClick():
  - Check NIP-07 availability → error if not available
  - Get user's pubkey via NIP-07
  - Check if user has already liked this URL
  - If liked: show confirmation dialog → handleUnlike() if confirmed
  - If not liked: handleLike()

handleLike():
  - Create kind 17 event with content: '+'
  - Sign with NIP-07
  - Publish to relays
  - Optimistic update: isLiked = true, count++
  - Refresh like count
  - Rollback on error

handleUnlike():
  - Create kind 17 event with content: '-'
  - Sign with NIP-07
  - Publish to relays
  - Optimistic update: isLiked = false, count--
  - Refresh like count
  - Rollback on error
```

## Utility Functions

### Like-Specific Utilities (`src/nostr-like/like-utils.ts`)

```typescript
fetchLikesForUrl(url, relays):
  - Normalize URL
  - Query kind 17 events with #k=web and #i=url (limit 1000)
  - Count likes (content = '+' or '') and unlikes (content = '-')
  - Sort by date (newest first)
  - Return: { totalCount: likes - unlikes, likedCount, dislikedCount, likeDetails }

createLikeEvent(url):
  - kind: 17, content: '+'
  - tags: [['k', 'web'], ['i', normalizedUrl]]

createUnlikeEvent(url):
  - kind: 17, content: '-'
  - tags: [['k', 'web'], ['i', normalizedUrl]]

hasUserLiked(url, userPubkey, relays):
  - Query user's kind 17 events for this URL (limit 1)
  - Return true if latest content is '+' or ''
```

### Reused Utilities
- `formatRelativeTime()` from `src/common/utils.ts`
- `getBatchedProfileMetadata()` from `src/nostr-zap/zap-utils.ts`

## Like Count

### Interactivity
- Clickable count opens likers dialog
- Delegated click handler on `.like-count` class
- Only clickable if count > 0

## Individual Likes (Likers Dialog)

### Progressive Loading
- Dialog shows skeleton loaders with npubs immediately
- Profile metadata fetched in batches
- Each entry updates independently as profile data loads
- Pattern borrowed from zappers dialog

### Entry Display
- Shows: Author (profile name or npub), time (relative), badge ("Liked"/"Disliked")
- Fetches profiles from kind 0 events
- Falls back to npub for name and 👤 emoji for picture
- Links to njump.me profiles

## Performance Considerations

### Optimistic UI Updates
- Update UI immediately on like
- Rollback if broadcast fails
- Improves perceived performance

### Profile Batching
- Fetch all profiles in single batched query
- Reduces relay round-trips
- Reuses `getBatchedProfileMetadata()` from zap-utils

### Query Optimization
- Limit queries to 1000 events
- Filter by tags at relay level (#k, #i)
- Deduplicate client-side to reduce data transfer

### Caching Strategy
- Cache like count for component lifetime
- Refresh after successful like/unlike
- No persistent caching (always fresh data)

## File Structure

```
src/nostr-like/
├── nostr-like.ts              # Main component class
├── render.ts                  # Rendering logic
├── style.ts                   # Component styles
├── like-utils.ts              # Like fetching and creation utilities
├── dialog-likers.ts           # Likers modal dialog
├── dialog-likers-style.ts     # Likers dialog styles
├── dialog-help.ts             # Help dialog implementation
├── dialog-help-style.ts       # Help dialog styles
└── spec/
    ├── spec.md                # Component specification
    ├── implementation.md       # This file
    └── testing.md              # Testing considerations
```