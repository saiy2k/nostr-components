// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';

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
  const pool = new SimplePool();
  const normalizedUrl = url;
  
  try {
    // Query kind 17 events (both likes and unlikes)
    console.log("Like: Fetching likes for url", url);
    const events = await pool.querySync(relays, {
      kinds: [17],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1000
    });
    
    // Process likes and unlikes - count separately
    const likes: LikeDetails[] = [];
    let likedCount = 0;
    let dislikedCount = 0;
    
    for (const event of events) {
      // Add to list regardless (shows both likes and unlikes in dialog)
      likes.push({
        authorPubkey: event.pubkey,
        date: new Date(event.created_at * 1000),
        content: event.content
      });
      
      // Count separately
      if (event.content === '-') {
        // Latest reaction is an unlike
        dislikedCount++;
      } else {
        // Latest reaction is a like ('+' or empty string)
        likedCount++;
      }
    }
    
    // Sort by date (newest first)
    likes.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Calculate net count: likes minus unlikes
    const totalCount = likedCount - dislikedCount;
    
    return {
      totalCount: totalCount,
      likeDetails: likes,
      likedCount: likedCount,
      dislikedCount: dislikedCount
    };
  } catch (error) {
    console.error("Nostr-Components: Like button: Error fetching likes", error);
    return {
      totalCount: 0,
      likeDetails: [],
      likedCount: 0,
      dislikedCount: 0
    };
  } finally {
    pool.close(relays);
  }
}

/**
 * Create like event (kind 17)
 */
export function createLikeEvent(url: string): any {
  return {
    kind: 17,
    content: '+',
    tags: [
      ['k', 'web'],
      ['i', url]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Create unlike event (kind 17 with '-' content)
 */
export function createUnlikeEvent(url: string): any {
  return {
    kind: 17,
    content: '-',
    tags: [
      ['k', 'web'],
      ['i', url]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
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
 * Get user's pubkey from NIP-07 signer
 */
export async function getUserPubkey(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).nostr) {
      const nip07signer = (window as any).nostr;
      const user = await nip07signer.getPublicKey();
      return user;
    }
  } catch (error) {
    console.error("Nostr-Components: Like button: Error getting user pubkey", error);
  }
  return null;
}

/**
 * Sign event with NIP-07
 */
export async function signEvent(event: any): Promise<any> {
  try {
    if (typeof window !== 'undefined' && (window as any).nostr) {
      const nip07signer = (window as any).nostr;
      const signedEvent = await nip07signer.signEvent(event);
      return signedEvent;
    }
    throw new Error('NIP-07 extension not available');
  } catch (error) {
    console.error("Nostr-Components: Like button: Error signing event", error);
    throw error;
  }
}

/**
 * Check if NIP-07 extension is available
 */
export function isNip07Available(): boolean {
  return typeof window !== 'undefined' && !!(window as any).nostr;
}
