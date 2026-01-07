// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';
import { ensureInitialized, getPublicKey, signEvent as signEventWithNostrLogin } from '../common/nostr-login-service';

/**
 * Helper utilities for Nostr like operations using NIP-25 External Content Reactions.
 * These are deliberately kept self-contained so `nostr-like` Web Component can import
 * everything from a single module without polluting the rest of the codebase.
 */

export interface LikeDetails {
  authorPubkey: string;
  date: Date;
  content: string;
}

export interface LikeCountResult {
  totalCount: number;
  likeDetails: LikeDetails[];
  likedCount: number;
  dislikedCount: number;
}

/**
 * Fetch all likes for a URL using NIP-25 kind 17 events
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
    
    const likes: LikeDetails[] = [];
    let likedCount = 0;
    let dislikedCount = 0;
    
    for (const event of events) {
      likes.push({
        authorPubkey: event.pubkey,
        date: new Date(event.created_at * 1000),
        content: event.content
      });
      
      if (event.content === '-') {
        dislikedCount++;
      } else {
        likedCount++;
      }
    }
    
    likes.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    const totalCount = likedCount - dislikedCount;
    
    return {
      totalCount: totalCount,
      likeDetails: likes,
      likedCount: likedCount,
      dislikedCount: dislikedCount
    };
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