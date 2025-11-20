// SPDX-License-Identifier: MIT

// Import components for side effects (registers custom elements)
import './nostr-profile-badge/nostr-profile-badge.ts';
import './nostr-post/nostr-post.ts';
import './nostr-profile/nostr-profile.ts';
import './nostr-follow-button/nostr-follow-button.ts';
import './nostr-zap/nostr-zap.ts';
import './nostr-comment/nostr-comment.ts';
import './nostr-dm/nostr-dm.ts';
import './nostr-live-chat/nostr-live-chat.ts';
import './nostr-like/nostr-like.ts';

// Import classes for default export
import NostrProfileBadge from './nostr-profile-badge/nostr-profile-badge.ts';
import NostrPost from './nostr-post/nostr-post.ts';
import NostrProfile from './nostr-profile/nostr-profile.ts';
import NostrFollowButton from './nostr-follow-button/nostr-follow-button.ts';
import NostrZap from './nostr-zap/nostr-zap.ts';
import NostrComment from './nostr-comment/nostr-comment.ts';
import NostrDm from './nostr-dm/nostr-dm.ts';
import NostrLiveChat from './nostr-live-chat/nostr-live-chat.ts';
import NostrLike from './nostr-like/nostr-like.ts';

// Export classes for TypeScript types
export { default as NostrProfileBadge } from './nostr-profile-badge/nostr-profile-badge.ts';
export { default as NostrPost } from './nostr-post/nostr-post.ts';
export { default as NostrProfile } from './nostr-profile/nostr-profile.ts';
export { default as NostrFollowButton } from './nostr-follow-button/nostr-follow-button.ts';
export { default as NostrZap } from './nostr-zap/nostr-zap.ts';
export { default as NostrComment } from './nostr-comment/nostr-comment.ts';
export { default as NostrDm } from './nostr-dm/nostr-dm.ts';
export { default as NostrLiveChat } from './nostr-live-chat/nostr-live-chat.ts';
export { default as NostrLike } from './nostr-like/nostr-like.ts';

// Export init function for explicit initialization (optional, for compatibility)
export function init() {
  // Components are already registered via imports above
  // This function exists for backward compatibility with UMD usage
  if (typeof window !== 'undefined') {
    console.log('Nostr Components initialized');
  }
}

// Default export for ESM usage (e.g., import nostrComponents from 'nostr-components')
export default {
  init,
  NostrProfileBadge,
  NostrPost,
  NostrProfile,
  NostrFollowButton,
  NostrZap,
  NostrComment,
  NostrDm,
  NostrLiveChat,
  NostrLike,
};
