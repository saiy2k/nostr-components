// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';
import { normalizeURL } from '../nostr-comment/utils';
import { hexToNpub } from '../common/utils';

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
}

/**
 * Fetch all likes for a URL using NIP-25 kind 17 events
 */
export async function fetchLikesForUrl(
  url: string, 
  relays: string[]
): Promise<LikeCountResult> {
  const pool = new SimplePool();
  const normalizedUrl = normalizeURL(url);
  
  try {
    // Query kind 17 events
    const events = await pool.querySync(relays, {
      kinds: [17],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1000
    });
    
    // Deduplicate by author (keep latest only)
    const latestByAuthor = new Map<string, any>();
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
    
    return {
      totalCount: likes.length,
      likeDetails: likes
    };
  } catch (error) {
    console.error("Nostr-Components: Like button: Error fetching likes", error);
    return {
      totalCount: 0,
      likeDetails: []
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
      ['i', normalizeURL(url)]
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
  const normalizedUrl = normalizeURL(url);
  
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
    
    // Check if latest reaction is a like
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
