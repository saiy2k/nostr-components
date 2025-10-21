# Nostr Like Component - Technical Implementation

## Overview

This document contains the technical implementation details for the `nostr-like` component. For component usage and API specifications, see [spec.md](./spec.md).

## Architecture

### Base Class
- Extends: `NostrBaseComponent`
- Inheritance Chain: 
  - `NostrBaseComponent`: Relay connection, theme handling, status management, event delegation
  - `NostrLike`: Like-specific functionality

**Why NOT NostrUserComponent?**
- URL-based likes don't require user identity resolution
- No npub/nip05/pubkey attributes needed
- Component focuses on URL content, not user profiles

### Status Management
- Channel-based: Separate status channels for different concerns
  - `likeActionStatus`: Like/unlike operation status (Idle, Loading, Ready, Error)
  - `likeListStatus`: Like count fetching status (Idle, Loading, Ready, Error)
  - `connectionStatus`: Relay connection status (inherited)

### Event Handling
- Delegated Events: Uses `delegateEvent()` for efficient Shadow DOM event handling
- Button Click: Delegated to `.nostr-like-button` class → triggers like/unlike
- Count Click: Delegated to `.like-count` class → opens likers dialog
- Event Delegation: Prevents memory leaks and improves performance

### Rendering Architecture
- Separation of Concerns: 
  - `nostr-like.ts`: Component logic and lifecycle
  - `render.ts`: Rendering functions and HTML generation
  - `style.ts`: CSS styles and theming (component-specific)
  - `dialog-likers.ts`: Likers modal dialog implementation (uses DialogComponent)
  - `dialog-likers-style.ts`: Likers modal content styles
  - `like-utils.ts`: Like-specific utility functions

## Dependencies

### External Dependencies
- @nostr-dev-kit/ndk: 
  - `NDKNip07Signer`: For signing like/unlike events
  - Not used for user resolution (unlike zap component)
- nostr-tools: 
  - `SimplePool`: Relay connection and event querying
  - `finalizeEvent`: Event signing and ID calculation
  - `nip19`: Bech32 encoding for npub display

### Internal Dependencies
- NostrBaseComponent: Base class with relay and status management
- NostrService: Relay connection management
- getComponentStyles(): Utility for CSS injection
- Common Utils: `normalizeURL()`, `hexToNpub()`, `formatRelativeTime()`
- Zap Utils: `getBatchedProfileMetadata()` (reused for profile fetching)

## Component Lifecycle

### Initialization Flow
1. Constructor: Initialize `likeListStatus` to Loading
2. Connected Callback: 
   - Validate inputs (URL, relays, text)
   - Get URL (from attribute or window.location.href)
   - Normalize URL
   - Connect to relays
   - Attach delegated listeners
   - Render initial state
3. Attribute Changed: Handle URL, text, data-theme updates
4. Status Change: React to status updates via `onStatusChange()`

### Status Management Flow
```typescript
// Initial state
likeListStatus.set(NCStatus.Loading);  // Show skeleton immediately

// Relay connection (inherited)
connectionStatus: Idle → Loading → Ready/Error

// Like count fetching
likeListStatus: Loading → Ready/Error

// Like action (on button click)
likeActionStatus: Idle → Loading → Ready/Error

// Overall status computation
computeOverall(): Reflects the most critical status
```

### URL Handling
```typescript
// Get URL
const url = this.getAttribute('url') || window.location.href;

// Normalize (reuse from nostr-comment/utils.ts)
const normalizedUrl = normalizeURL(url);

// Store for queries
this.currentUrl = normalizedUrl;
```

## Like State Management

### Checking User's Like Status
```typescript
async checkIfUserLiked() {
  // Get current user's pubkey via NIP-07
  const nip07signer = new NDKNip07Signer();
  const user = await nip07signer.user();
  
  // Query user's kind 17 events for this URL
  const userReactions = await pool.querySync(relays, {
    kinds: [17],
    authors: [user.pubkey],
    '#k': ['web'],
    '#i': [this.currentUrl],
    limit: 1
  });
  
  // Check if user has liked
  if (userReactions.length > 0) {
    const latest = userReactions[0]; // Most recent
    this.isLiked = latest.content === '+' || latest.content === '';
  }
}
```

### Like Action (One-Way)
```typescript
async handleLikeClick() {
  if (this.isLiked) {
    // Already liked - do nothing or show message
    return;
  }
  
  await this.likeUrl();
}

async likeUrl() {
  // Create kind 17 event with content "+"
  const event = {
    kind: 17,
    content: '+',
    tags: [
      ['k', 'web'],
      ['i', this.currentUrl]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
  
  // Sign with NIP-07
  const nip07signer = new NDKNip07Signer();
  const signedEvent = await nip07signer.sign(event);
  
  // Broadcast
  await this.nostrService.getNDK().publish(signedEvent);
  
  // Update state
  this.isLiked = true;
  this.likeCount++;
  this.render();
}
```

## Dialog Implementation

Uses the shared `DialogComponent` base class for the likers modal. See `src/base/dialog-component/README.md` for dialog implementation details.

## Utility Functions

### Like-Specific Utilities (`src/nostr-like/like-utils.ts`)

```typescript
/**
 * Fetch all likes for a URL
 */
async function fetchLikesForUrl(
  url: string, 
  relays: string[]
): Promise<LikeDetails[]> {
  const pool = new SimplePool();
  const normalizedUrl = normalizeURL(url);
  
  // Query kind 17 events
  const events = await pool.querySync(relays, {
    kinds: [17],
    '#k': ['web'],
    '#i': [normalizedUrl],
    limit: 1000
  });
  
  // Deduplicate by author (keep latest only)
  const latestByAuthor = new Map<string, Event>();
  for (const event of events) {
    const existing = latestByAuthor.get(event.pubkey);
    if (!existing || event.created_at > existing.created_at) {
      latestByAuthor.set(event.pubkey, event);
    }
  }
  
  // Filter out unlikes (content === "-") - not needed for one-way likes
  const likes: LikeDetails[] = [];
  for (const [pubkey, event] of latestByAuthor.entries()) {
    if (event.content === '+' || event.content === '') {
      likes.push({
        authorPubkey: pubkey,
        date: new Date(event.created_at * 1000),
        content: event.content
      });
    }
  }
  
  // Sort by date (newest first)
  likes.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  return likes;
}

/**
 * Create like event
 */
function createLikeEvent(url: string): any {
  return {
    kind: 17,
    content: '+',
    tags: [
      ['k', 'web'],
      ['i', normalizeURL(url)]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Check if user has liked a URL
 */
async function hasUserLiked(
  url: string,
  userPubkey: string,
  relays: string[]
): Promise<boolean> {
  const pool = new SimplePool();
  const normalizedUrl = normalizeURL(url);
  
  // Get user's latest reaction for this URL
  const events = await pool.querySync(relays, {
    kinds: [17],
    authors: [userPubkey],
    '#k': ['web'],
    '#i': [normalizedUrl],
    limit: 1
  });
  
  if (events.length === 0) return false;
  
  // Check if latest reaction is a like
  const latest = events[0];
  return latest.content === '+' || latest.content === '';
}

interface LikeDetails {
  authorPubkey: string;
  date: Date;
  content: string;
}
```

### Reused Utilities
- `normalizeURL()` from `src/nostr-comment/utils.ts`
- `hexToNpub()` from `src/common/utils.ts`
- `formatRelativeTime()` from `src/common/utils.ts`
- `getBatchedProfileMetadata()` from `src/nostr-zap/zap-utils.ts`

## Like Count

### Data Fetching
- Queries kind 17 events with `#k=web` and `#i=<url>` tags
- Limit: 1000 events
- Deduplication: Count only latest reaction per author
- Filtering: Exclude unlikes (content === "-")

### Count Calculation
```typescript
async function getLikeCount(url: string, relays: string[]): Promise<number> {
  const likes = await fetchLikesForUrl(url, relays);
  return likes.length;
}
```

### Interactivity
- Clickable count opens likers dialog
- Delegated click handler on `.like-count` class
- Only clickable if count > 0

## Individual Likes

### Data Strategy
- Reuses data from `fetchLikesForUrl()` (single query)
- Returns deduplicated list of likes
- Sorted chronologically (newest first)

### Progressive Loading
- Dialog shows skeleton loaders with npubs immediately
- Profile metadata fetched in batches
- Each entry updates independently as profile data loads
- Pattern borrowed from zappers dialog

### Like Details
- Author from event `pubkey` field
- Date from event `created_at` timestamp
- Content from event `content` field (usually "+")
- Profile from kind 0 metadata events

### Profile Display
- Initial: npubs in skeleton loaders
- Enhanced: Display name and profile picture from metadata
- Fallback: npub for name, 👤 emoji for picture
- Links: njump.me URLs for author profiles

## Error Handling

### No NIP-07 Extension
```typescript
try {
  const nip07signer = new NDKNip07Signer();
  await nip07signer.user();
} catch (error) {
  this.likeActionStatus.set(NCStatus.Error, 
    'Please install a Nostr browser extension (Alby, nos2x, etc.)'
  );
}
```

### Signature Rejection
```typescript
try {
  const signedEvent = await nip07signer.sign(event);
} catch (error) {
  this.likeActionStatus.set(NCStatus.Error,
    'Signature rejected. Please try again.'
  );
}
```

### Network Errors
```typescript
try {
  await this.nostrService.getNDK().publish(signedEvent);
} catch (error) {
  this.likeActionStatus.set(NCStatus.Error,
    'Failed to broadcast. Check your connection.'
  );
  // Rollback optimistic update
  this.isLiked = !this.isLiked;
  this.likeCount += this.isLiked ? 1 : -1;
}
```

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
├── like-utils.ts              # Like fetching and creation
├── dialog-likers.ts           # Likers modal
├── dialog-likers-style.ts     # Dialog styles
└── spec/
    ├── spec.md                # Component specification
    └── implementation.md      # This file
```

## Testing Considerations

- Test like action with NIP-07
- Test without NIP-07 (error state)
- Test with 0 likes
- Test with 1 like
- Test with many likes (100+)
- Test URL normalization edge cases
- Test profile loading in dialog
- Test deduplication logic (prevent duplicate likes)
- Test error states (network, signature)
- Test theme switching
- Test custom URL attribute
- Test default URL (window.location)

