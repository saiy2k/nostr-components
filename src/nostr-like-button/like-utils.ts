// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';
import { ensureInitialized, getPublicKey, signEvent as signEventWithNostrLogin } from '../common/nostr-login-service';
import {
  getRelayTransport,
  hasInstalledRelayTransport,
} from '../common/relay-transport';
import { likePublishRelays, normalizeRelayUrl } from '../common/relay-routing';
import { likeFilterUrls, likeTagUrl } from '../common/url-tags';
import { netLikesByPubkey } from './like-netting';
import type { LikeCountResult, LikeDetails } from './like-netting';

export type { LikeCountResult, LikeDetails };

/** Read a host's short-lived reaction cache without waiting for any relay. */
export async function fetchCachedLikeStateForUrl(
  url: string,
  relays: string[],
): Promise<boolean | null> {
  const transport = getRelayTransport();
  if (!transport?.getCachedLikeState) return null;

  const state = await transport.getCachedLikeState(relays, likeTagUrl(url) || url);
  return state.found ? state.isLiked : null;
}

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
  const filterUrls = likeFilterUrls(url);
  if (filterUrls.length === 0) {
    return netLikesByPubkey([]);
  }
  
  const pool = new SimplePool();
  
  try {
    // Query kind 17 events (both likes and unlikes)
    const filter = {
      kinds: [17],
      '#k': ['web'],
      '#i': filterUrls,
      limit: 1000
    };
    const transport = getRelayTransport();
    if (transport?.getLikeState) {
      const state = await transport.getLikeState(relays, filterUrls[0]);
      return {
        ...state,
        // The extension deliberately keeps liker pubkeys out of MAIN-world
        // state responses. Compact host actions do not open the likers dialog.
        likeDetails: [],
      };
    }
    const events = transport
      ? await transport.query(relays, filter)
      : await pool.querySync(relays, filter);
    
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

function latestViewerReaction(events: any[]): any | null {
  let latest: any = null;
  for (const event of events) {
    if (!event) continue;
    const createdAt = Number(event.created_at);
    const latestAt = latest ? Number(latest.created_at) : Number.NEGATIVE_INFINITY;
    if (
      !latest ||
      createdAt > latestAt ||
      (createdAt === latestAt && String(event.id || '') > String(latest.id || ''))
    ) {
      latest = event;
    }
  }
  return latest;
}

/**
 * Check if user has liked a URL.
 * A failed lookup throws. Callers must not treat that as "not liked".
 */
export async function hasUserLiked(
  url: string,
  userPubkey: string,
  relays: string[]
): Promise<boolean> {
  const pool = new SimplePool();
  const filterUrls = likeFilterUrls(url);
  if (filterUrls.length === 0) {
    pool.close(relays);
    return false;
  }
  
  try {
    // Get user's latest reaction for this URL
    const filter = {
      kinds: [17],
      authors: [userPubkey],
      '#k': ['web'],
      '#i': filterUrls,
      limit: 1
    };
    const transport = getRelayTransport();
    const events = transport
      ? await transport.query(relays, filter)
      : await pool.querySync(relays, filter);
    if (!Array.isArray(events)) {
      throw new Error('Could not check whether this page is already liked');
    }

    const latest = latestViewerReaction(events);
    if (!latest) return false;

    // Check if latest reaction is a like (not an unlike)
    return latest.content === '+' || latest.content === '';
  } catch (error) {
    console.error("Nostr-Components: Like button: Error checking user like status", error);
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    pool.close(relays);
  }
}

/** Publish through a host transport, falling back to the component's NDK path. */
export async function publishSignedReaction(
  event: any,
  relays: string[],
  publishWithNdk: () => Promise<unknown>,
  actionId?: string,
): Promise<void> {
  const transport = getRelayTransport();
  if (transport) {
    if (hasInstalledRelayTransport() && !actionId) {
      throw new Error('Relay publish is not bound to an action');
    }
    if (actionId) {
      await transport.publish(relays, event, actionId);
    } else {
      await transport.publish(relays, event);
    }
    return;
  }
  await publishWithNdk();
}

/** Best-effort copy of a like onto the signer's write relays. A refusal does not fail the like. */
export async function publishToWriteRelays(
  event: { pubkey?: string; id?: string },
  baseRelays: string[],
): Promise<void> {
  if (getRelayTransport() || !event.pubkey) return;
  const targets = await likePublishRelays(baseRelays, event.pubkey);
  const base = new Set(
    baseRelays.map((relay) => normalizeRelayUrl(relay)).filter((relay): relay is string => !!relay),
  );
  const extra = targets.filter((relay) => !base.has(relay));
  if (extra.length === 0) return;
  const pool = new SimplePool();
  try {
    await Promise.allSettled(pool.publish(extra, event as never));
  } finally {
    pool.close(extra);
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
