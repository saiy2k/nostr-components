// SPDX-License-Identifier: MIT

import { SimplePool } from 'nostr-tools';
import { normalizeURL } from '../common/utils';
import {
  ensureInitialized,
  getCachedPublicKey,
  getPublicKey,
  signEvent as signEventWithNostrLogin,
} from '../common/nostr-login-service';
import { netLikesByPubkey } from './like-netting';
import type { LikeCountResult, LikeDetails } from './like-netting';

export type { LikeCountResult, LikeDetails };

export interface NostrRelayTransport {
  query(relays: string[], filter: Record<string, unknown>): Promise<any[]>;
  publish(relays: string[], event: any): Promise<void>;
  getLikeState?(
    relays: string[],
    url: string,
  ): Promise<Omit<LikeStateResult, 'likeDetails'>>;
}

export interface LikeStateResult extends LikeCountResult {
  isLiked: boolean;
}

/** Optional host transport used when page CSP prevents direct relay sockets. */
export function getRelayTransport(): NostrRelayTransport | null {
  const transport = (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: Partial<NostrRelayTransport>;
    }
  ).__nostrComponentsRelayTransport;

  if (
    !transport ||
    typeof transport.query !== 'function' ||
    typeof transport.publish !== 'function'
  ) {
    return null;
  }
  return transport as NostrRelayTransport;
}

// One pool per page keeps timeline components from opening their own relay
// sockets while still allowing independent URL queries.
const likePool = new SimplePool();
const LIKE_STATE_CACHE_TTL_MS = 30_000;
const MAX_HYDRATION_CONCURRENCY = 4;
const likeStateCache = new Map<
  string,
  { value: LikeStateResult; expiresAt: number }
>();
const inFlightLikeStates = new Map<string, Promise<LikeStateResult>>();
interface HydrationQueueEntry {
  start(): void;
  cancel(): void;
}
const hydrationQueue: HydrationQueueEntry[] = [];
let activeHydrations = 0;

function likeStateCacheKey(url: string, relays: string[]): string {
  return `${normalizeURL(url)}\n${[...new Set(relays)].sort().join(',')}`;
}

function runNextHydration(): void {
  while (
    activeHydrations < MAX_HYDRATION_CONCURRENCY &&
    hydrationQueue.length > 0
  ) {
    hydrationQueue.shift()?.start();
  }
}

function scheduleHydration<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let startedOrCanceled = false;
    const start = () => {
      if (startedOrCanceled) return;
      startedOrCanceled = true;
      activeHydrations += 1;
      void operation()
        .then(resolve, reject)
        .finally(() => {
          activeHydrations -= 1;
          runNextHydration();
        });
    };
    const cancel = () => {
      if (startedOrCanceled) return;
      startedOrCanceled = true;
      reject(new Error('Like-state hydration was canceled'));
    };
    hydrationQueue.push({ start, cancel });
    runNextHydration();
  });
}

/** Clear cached state after a mutation, or reset all state for tests. */
export function invalidateLikeStateCache(
  url?: string,
  relays?: string[],
): void {
  if (url && relays) {
    likeStateCache.delete(likeStateCacheKey(url, relays));
    return;
  }
  likeStateCache.clear();
  inFlightLikeStates.clear();
  const queued = hydrationQueue.splice(0, hydrationQueue.length);
  for (const entry of queued) entry.cancel();
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
  // Normalize URL at the beginning for consistent comparison with tags
  const normalizedUrl = normalizeURL(url);

  try {
    // Query kind 17 events (both likes and unlikes)
    const filter = {
      kinds: [17],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1000,
    };
    const transport = getRelayTransport();
    const events = transport
      ? await transport.query(relays, filter)
      : await likePool.querySync(relays, filter, { maxWait: 8000 });

    return netLikesByPubkey(events);
  } catch (error) {
    // Rethrow error so callers can handle relay/network failures appropriately
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/** Resolve the last known signer without opening a prompt during page render. */
async function getKnownUserPublicKey(): Promise<string | null> {
  return getCachedPublicKey();
}

/** Fetch the count and restore the known user's existing reaction on revisit. */
export async function fetchLikeStateForUrl(
  url: string,
  relays: string[],
  options: { force?: boolean } = {},
): Promise<LikeStateResult> {
  const normalizedUrl = normalizeURL(url);
  const cacheKey = likeStateCacheKey(normalizedUrl, relays);
  if (!options.force) {
    const cached = likeStateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const inFlight = inFlightLikeStates.get(cacheKey);
    if (inFlight) return inFlight;
  }

  const request = scheduleHydration(async () => {
    const transport = getRelayTransport();
    let result: LikeCountResult;
    let isLiked: boolean;

    if (transport && typeof transport.getLikeState === 'function') {
      const state = await transport.getLikeState(relays, normalizedUrl);
      result = { ...state, likeDetails: [] };
      isLiked = state.isLiked;
    } else {
      const [countResult, userPublicKey] = await Promise.all([
        fetchLikesForUrl(normalizedUrl, relays),
        getKnownUserPublicKey(),
      ]);
      result = countResult;
      const ownReaction = userPublicKey
        ? result.likeDetails.find(
            (detail) => detail.authorPubkey.toLowerCase() === userPublicKey,
          )
        : undefined;
      isLiked = ownReaction?.content === '+' || ownReaction?.content === '';
    }

    const value = { ...result, isLiked };
    likeStateCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + LIKE_STATE_CACHE_TTL_MS,
    });
    return value;
  });

  inFlightLikeStates.set(cacheKey, request);
  const clearInFlight = () => {
    if (inFlightLikeStates.get(cacheKey) === request) {
      inFlightLikeStates.delete(cacheKey);
    }
  };
  void request.then(clearInFlight, clearInFlight);

  return request;
}

/**
 * Create reaction event (kind 17)
 * @param url - URL to react to
 * @param content - '+' for like, '-' for unlike
 */
export function createReactionEvent(url: string, content: '+' | '-'): any {
  const normalizedUrl = normalizeURL(url);
  return {
    kind: 17,
    content,
    tags: [
      ['k', 'web'],
      ['i', normalizedUrl],
    ],
    created_at: Math.floor(Date.now() / 1000),
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
  const normalizedUrl = normalizeURL(url);

  try {
    // Get user's latest reaction for this URL
    const filter = {
      kinds: [17],
      authors: [userPubkey],
      '#k': ['web'],
      '#i': [normalizedUrl],
      limit: 1,
    };
    const transport = getRelayTransport();
    const events = transport
      ? await transport.query(relays, filter)
      : await likePool.querySync(relays, filter, { maxWait: 8000 });

    if (events.length === 0) return false;

    // Check if latest reaction is a like (not an unlike)
    const latest = [...events].sort(
      (a, b) =>
        b.created_at - a.created_at ||
        (a.id === b.id ? 0 : a.id > b.id ? -1 : 1),
    )[0];
    return latest.content === '+' || latest.content === '';
  } catch (error) {
    console.error('Nostr-Components: Like button: Error checking user like status', error);
    return false;
  }
}

/** Publish through a host transport, falling back to the component's NDK path. */
export async function publishSignedReaction(
  event: any,
  relays: string[],
  publishWithNdk: () => Promise<unknown>,
): Promise<void> {
  const transport = getRelayTransport();
  if (transport) {
    await transport.publish(relays, event);
    return;
  }
  await publishWithNdk();
}

/**
 * Get user's pubkey from NostrLogin
 */
export async function getUserPubkey(): Promise<string | null> {
  try {
    await ensureInitialized();
    return await getPublicKey();
  } catch (error) {
    console.error('Nostr-Components: Like button: Error getting user pubkey', error);
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
    console.error('Nostr-Components: Like button: Error signing event', error);
    throw error;
  }
}
