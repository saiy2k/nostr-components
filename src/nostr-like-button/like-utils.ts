// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';
import { ensureInitialized, getPublicKey, signEvent as signEventWithNostrLogin } from '../common/nostr-login-service';
import { netLikesByPubkey } from './like-netting';
import type { LikeCountResult, LikeDetails } from './like-netting';

export type { LikeCountResult, LikeDetails };

/**
 * Fetch likes for a URL using NIP-25 kind 17 events.
 *
 * Bounded sample: relays return at most `limit` events, so netting runs over the
 * most recent ~1000 reactions. If a pubkey's newer reaction falls outside that
 * window, its netted state can be stale — acceptable for a social-proof counter,
 * but do not treat the result as a complete reaction history.
 */
export async function fetchLikesForUrl(
  url: string, 
  relays: string[]
): Promise<LikeCountResult> {
  // Normalize URL at the beginning for consistent comparison with tags
  const normalizedUrl = normalizeURL(url);
  
  const pool = new SimplePool();
  
  try {
    // Query kind 17 events (both likes and unlikes)
    const events = await pool.querySync(relays, {
      kinds: [17],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1000
    });
    
    return netLikesByPubkey(events);
  } catch (error) {
    // Rethrow error so callers can handle relay/network failures appropriately
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    pool.close(relays);
  }
}

/**
 * Create reaction event (kind 17)
 * @param url - URL to react to
 * @param content - '+' for like, '-' for unlike
 */
export function createReactionEvent(url: string, content: '+' | '-'): any {
  return {
    kind: 17,
    content,
    tags: [
      ['k', 'web'],
      ['i', url]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Create like event (kind 17)
 * @deprecated Use createReactionEvent(url, '+') instead
 */
export function createLikeEvent(url: string): any {
  return createReactionEvent(url, '+');
}

/**
 * Create unlike event (kind 17 with '-' content)
 * @deprecated Use createReactionEvent(url, '-') instead
 */
export function createUnlikeEvent(url: string): any {
  return createReactionEvent(url, '-');
}

/**
 * Check if user has liked a URL
 */
export async function hasUserLiked(
  url: string,
  userPubkey: string,
  relays: string[]
): Promise<boolean> {
  const pool = new SimplePool();
  const normalizedUrl = url;
  
  try {
    // Get user's latest reaction for this URL
    const events = await pool.querySync(relays, {
      kinds: [17],
      authors: [userPubkey],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1
    });
    
    if (events.length === 0) return false;
    
    // Check if latest reaction is a like (not an unlike)
    const latest = events[0];
    return latest.content === '+' || latest.content === '';
  } catch (error) {
    console.error("Nostr-Components: Like button: Error checking user like status", error);
    return false;
  } finally {
    pool.close(relays);
  }
}

/**
 * Get user's pubkey from NostrLogin
 */
export async function getUserPubkey(): Promise<string | null> {
  try {
    await ensureInitialized();
    return await getPublicKey();
  } catch (error) {
    console.error("Nostr-Components: Like button: Error getting user pubkey", error);
    return null;
  }
}

/**
 * Sign event with NostrLogin
 */
export async function signEvent(event: any): Promise<any> {
  try {
    await ensureInitialized();
    return await signEventWithNostrLogin(event);
  } catch (error) {
    console.error("Nostr-Components: Like button: Error signing event", error);
    throw error;
  }
}