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

export const DIRECTORY_WRITE_ERROR = 'Directory did not store the reaction';
const LOCAL_REACTION_KEY = 'nostr-components:last-reaction';
const LOCAL_REACTION_LIMIT = 20;

export function isDirectoryWriteError(error: unknown): boolean {
  return error instanceof Error && error.message === DIRECTORY_WRITE_ERROR;
}

interface LocalReaction {
  url: string;
  pubkey: string;
  content: string;
  id: string;
  created_at: number;
}

function reactionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function reactionTargetUrl(event: { tags?: unknown }): string | null {
  if (!Array.isArray(event?.tags)) return null;
  const tag = event.tags.find(
    (item) => Array.isArray(item) && item[0] === 'i' && typeof item[1] === 'string',
  );
  return Array.isArray(tag) ? tag[1] : null;
}

function readLocalReactions(): LocalReaction[] {
  const storage = reactionStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_REACTION_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is LocalReaction => (
      !!row &&
      typeof row.url === 'string' &&
      typeof row.pubkey === 'string' &&
      typeof row.content === 'string' &&
      typeof row.id === 'string' &&
      Number.isFinite(row.created_at)
    ));
  } catch {
    return [];
  }
}

function writeLocalReactions(reactions: LocalReaction[]): void {
  const storage = reactionStorage();
  if (!storage) return;
  try {
    storage.setItem(
      LOCAL_REACTION_KEY,
      JSON.stringify(reactions.slice(0, LOCAL_REACTION_LIMIT)),
    );
  } catch {
    // A private window can refuse storage. The relay copy still stands.
  }
}

/** Remember a signed reaction until a relay returns the same event id. */
export function rememberLocalReaction(event: {
  id?: string;
  pubkey?: string;
  content?: string;
  created_at?: number;
  tags?: unknown;
}): void {
  if (getRelayTransport()) return;
  const url = reactionTargetUrl(event);
  const pubkey = typeof event.pubkey === 'string' ? event.pubkey.toLowerCase() : '';
  const id = typeof event.id === 'string' ? event.id : '';
  if (!url || !pubkey || !id || !Number.isFinite(event.created_at)) return;
  const next = readLocalReactions().filter(
    (row) => !(row.url === url && row.pubkey === pubkey),
  );
  next.unshift({
    url,
    pubkey,
    content: typeof event.content === 'string' ? event.content : '',
    id,
    created_at: Number(event.created_at),
  });
  writeLocalReactions(next);
}

function forgetLocalReaction(id: string): void {
  writeLocalReactions(readLocalReactions().filter((row) => row.id !== id));
}

function pageReactionUrls(url: string): Set<string> {
  const urls = new Set(likeFilterUrls(url));
  const tag = likeTagUrl(url);
  if (tag) urls.add(tag);
  if (url) urls.add(url);
  return urls;
}

function readLocalReaction(url: string, pubkey: string): LocalReaction | null {
  const urls = pageReactionUrls(url);
  const normalized = pubkey.toLowerCase();
  return readLocalReactions().find(
    (row) => row.pubkey === normalized && urls.has(row.url),
  ) ?? null;
}

/**
 * Whether this browser's signer currently likes the page.
 * Uses the reaction saved at publish time even when window.nostr is not
 * loaded yet, then lets a newer relay reaction replace it.
 * Null means this page has no saved signer to check.
 */
export function restoredViewerLiked(
  url: string,
  likeDetails: LikeDetails[],
  pubkey: string | null,
): boolean | null {
  const urls = pageReactionUrls(url);
  const normalized = pubkey?.toLowerCase() || null;
  const local = readLocalReactions()
    .filter((row) => urls.has(row.url) && (!normalized || row.pubkey === normalized))
    .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? 1 : -1))[0];
  const viewer = normalized || local?.pubkey || null;
  if (!viewer) return null;

  const relay = likeDetails.find(
    (detail) => detail.authorPubkey.toLowerCase() === viewer,
  );
  const relayAt = relay ? Math.floor(relay.date.getTime() / 1000) : null;
  if (relay && (local == null || relayAt! >= local.created_at)) {
    return relay.content === '+' || relay.content === '';
  }
  if (local) return local.content === '+' || local.content === '';
  return false;
}

function latestViewerReaction(events: Array<{ created_at?: number; id?: string } | null>): any | null {
  let latest: any = null;
  for (const event of events) {
    if (!event) continue;
    latest = newerReaction(latest, event);
  }
  return latest;
}

function newerReaction(current: any, candidate: any): any {
  if (!candidate) return current;
  if (!current) return candidate;
  const createdAt = Number(candidate.created_at);
  const latestAt = Number(current.created_at);
  if (createdAt > latestAt) return candidate;
  if (createdAt < latestAt) return current;
  return String(candidate.id || '') > String(current.id || '') ? candidate : current;
}

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
    const transport = getRelayTransport();
    if (transport?.getLikeState) {
      try {
        const state = await transport.getLikeState(relays, filterUrls[0]);
        // Null, or a failed directory read, means this browser has no saved
        // like. Stopping here blocks the first like on X.
        return state?.isLiked === true;
      } catch (error) {
        console.error("Nostr-Components: Like button: Error checking user like status", error);
        return false;
      }
    }

    const filter = {
      kinds: [17],
      authors: [userPubkey],
      '#k': ['web'],
      '#i': filterUrls,
      limit: 1
    };
    const events = transport
      ? await transport.query(relays, filter)
      : await pool.querySync(relays, filter);
    if (!Array.isArray(events)) {
      throw new Error('Could not check whether this page is already liked');
    }

    const local = readLocalReaction(url, userPubkey);
    const echoed = !!local && events.some((event) => event?.id === local.id);
    if (local && echoed) forgetLocalReaction(local.id);
    const latest = newerReaction(
      latestViewerReaction(events),
      echoed ? null : local,
    );
    if (!latest) return false;
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
  rememberLocalReaction(event);
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
