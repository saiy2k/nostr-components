// SPDX-License-Identifier: MIT

import {
  nip57,
  nip05,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools';
import type { Filter, Event } from 'nostr-tools';
import { normalizeURL as normalizeRelayURL } from 'nostr-tools/utils';
import { ensureInitialized, signEvent as signEventWithNostrLogin } from '../common/nostr-login-service';
import { DEFAULT_RELAYS } from '../common/constants';
import {
  fetchProfileOutbox,
  queryRelays,
  zapRelaysFor,
} from '../common/relay-routing';
import { getRelayTransport, httpGetJson } from '../common/relay-transport';
import { zapFilterUrls, zapTagUrl } from '../common/url-tags';
import { cloneVerifiedEvent } from '../common/nostr-event';
import {
  getBolt11AmountMsats,
  resolveZapProviderInfo,
  validateZapReceipt,
  type ZapProviderInfo,
} from './zap-receipt';

/**
 * Helper utilities for Nostr zap operations (adapted from the original `nostr-zap` repo).
 * These are deliberately kept self-contained so `nostr-zap` Web Component can import
 * everything from a single module without polluting the rest of the codebase.
 */

// Basic in-memory cache – sufficient for component lifetime.
const profileCache = new Map<string, Event>();
const ZAP_PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const ZAP_PROVIDER_NEGATIVE_TTL_MS = 30 * 1000;
const ZAP_RECEIPT_POLL_TIMEOUT_MS = 10 * 60 * 1000;
const zapProviderCache: Record<
  string,
  { value: ZapProviderInfo | null; expiresAt: number }
> = {};

const profileCacheKey = (authorId: string, relays: string[]) => {
  const normalizedRelays = Array.from(
    new Set(
      relays.map(relay => {
        try {
          return normalizeRelayURL(relay);
        } catch {
          return relay;
        }
      }),
    ),
  ).sort();
  return `${authorId.toLowerCase()}|${normalizedRelays.join(',')}`;
};

const getVerifiedProfileEvent = (
  event: unknown,
  expectedAuthorId: string,
): Event | null => {
  const profile = cloneVerifiedEvent(event);
  if (!profile) return null;
  if (
    profile.kind !== 0 ||
    profile.pubkey.toLowerCase() !== expectedAuthorId.toLowerCase()
  ) {
    return null;
  }
  return profile;
};

export const getProfileMetadata = async (
  authorId: string,
  relays?: string[],
  actionId?: string,
) => {
  const relayList = relays && relays.length > 0 ? relays : [...DEFAULT_RELAYS];
  const cacheKey = profileCacheKey(authorId, relayList);
  // An action id must reach the directory lookup. A profile cached from a
  // relay query has no action id and would skip that call.
  if (!actionId) {
    const cached = profileCache.get(cacheKey);
    if (cached) return cached;
  }

  const transport = getRelayTransport();
  if (actionId && transport?.getProfiles) {
    const events = await transport.getProfiles(actionId, [authorId]);
    const event = newestVerifiedProfile(events, authorId);
    if (event) profileCache.set(cacheKey, event);
    return event;
  }
  if (transport) {
    const filter = {
      authors: [authorId],
      kinds: [0],
      limit: 1,
    };
    const events = actionId
      ? await transport.query(relayList, filter, actionId)
      : await transport.query(relayList, filter);
    const event = newestVerifiedProfile(events, authorId);
    if (event) profileCache.set(cacheKey, event);
    return event;
  }

  const event = await fetchProfileOutbox(authorId, relayList);
  const verifiedEvent = getVerifiedProfileEvent(event, authorId);
  if (verifiedEvent) profileCache.set(cacheKey, verifiedEvent);
  return verifiedEvent;
};

function newestVerifiedProfile(events: unknown[], authorId: string): Event | null {
  return (
    [...events]
      .map((candidate) => getVerifiedProfileEvent(candidate, authorId))
      .filter((candidate): candidate is Event => candidate !== null)
      .sort(
        (left, right) =>
          right.created_at - left.created_at || left.id.localeCompare(right.id),
      )[0] || null
  );
}

const PROFILE_QUERY_BATCH_SIZE = 50;
const PROFILE_LOOKUP_CONCURRENCY = 5;

async function lookupProfilesOutbox(authorIds: string[], relays: string[]) {
  const events: Event[] = [];
  for (let index = 0; index < authorIds.length; index += PROFILE_LOOKUP_CONCURRENCY) {
    const slice = authorIds.slice(index, index + PROFILE_LOOKUP_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((authorId) => fetchProfileOutbox(authorId, relays)),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) events.push(result.value);
    }
  }
  return events;
}

function cacheVerifiedProfiles(
  events: unknown[],
  requestedIds: Set<string>,
  relayList: string[],
) {
  for (const event of events) {
    const candidate = event as Partial<Event> | null;
    const verifiedEvent = getVerifiedProfileEvent(
      candidate,
      candidate?.pubkey || '',
    );
    if (!verifiedEvent) continue;
    if (!requestedIds.has(verifiedEvent.pubkey.toLowerCase())) continue;

    const cacheKey = profileCacheKey(verifiedEvent.pubkey, relayList);
    const cached = profileCache.get(cacheKey);
    if (
      !cached ||
      verifiedEvent.created_at > cached.created_at ||
      (verifiedEvent.created_at === cached.created_at &&
        verifiedEvent.id < cached.id)
    ) {
      profileCache.set(cacheKey, verifiedEvent);
    }
  }
}

export const getBatchedProfileMetadata = async (
  authorIds: string[],
  relays?: string[],
  actionId?: string,
) => {
  const relayList = relays && relays.length > 0 ? relays : [...DEFAULT_RELAYS];
  const uncachedIds = Array.from(
    new Set(
      authorIds.map(id => id.toLowerCase()).filter(
        id => actionId || !profileCache.has(profileCacheKey(id, relayList)),
      ),
    ),
  );

  // If all profiles are cached, return them
  if (uncachedIds.length === 0) {
    return authorIds.map(id => ({
      id,
      profile: profileCache.get(profileCacheKey(id, relayList)) || null,
    }));
  }

  const transport = getRelayTransport();
  const requestedIds = new Set(uncachedIds);
  for (
    let offset = 0;
    offset < uncachedIds.length;
    offset += PROFILE_QUERY_BATCH_SIZE
  ) {
      const batch = uncachedIds.slice(offset, offset + PROFILE_QUERY_BATCH_SIZE);
      const filter = {
        authors: batch,
        kinds: [0],
        limit: batch.length,
      };
      if (actionId && transport?.getProfiles) {
        cacheVerifiedProfiles(
          await transport.getProfiles(actionId, batch),
          requestedIds,
          relayList,
        );
      } else if (transport) {
        const events = actionId
          ? await transport.query(relayList, filter, actionId)
          : await transport.query(relayList, filter);
        cacheVerifiedProfiles(events, requestedIds, relayList);
      } else {
        const events = await lookupProfilesOutbox(batch, relayList);
        cacheVerifiedProfiles(events, requestedIds, relayList);
      }
    }

    return authorIds.map(id => ({
      id,
      profile: profileCache.get(profileCacheKey(id, relayList)) || null,
    }));
};

export const extractProfileMetadataContent = (profileMetadata: any) => {
  try {
    return JSON.parse(profileMetadata?.content || '{}');
  } catch {
    return {};
  }
};

export const getZapEndpoint = async (profileMetadata: any) => {
  const provider = await getZapProviderInfo(profileMetadata);
  if (!provider) throw new Error('Failed to retrieve zap LNURL');
  return provider.callback;
};

export const getZapProviderInfo = async (
  profileMetadata: Event,
): Promise<ZapProviderInfo | null> => {
  const verifiedProfile = getVerifiedProfileEvent(
    profileMetadata,
    profileMetadata?.pubkey || '',
  );
  if (!verifiedProfile) return null;
  const cacheKey = verifiedProfile.pubkey || verifiedProfile.id || '';
  const cached = cacheKey ? zapProviderCache[cacheKey] : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const provider = await resolveZapProviderInfo(verifiedProfile);
  if (cacheKey) {
    const ttl = provider ? ZAP_PROVIDER_CACHE_TTL_MS : ZAP_PROVIDER_NEGATIVE_TTL_MS;
    zapProviderCache[cacheKey] = {
      value: provider,
      expiresAt: Date.now() + ttl,
    };
  }
  return provider;
};

/**
 * Builds the deterministic `a` tag value for a URL-based zap.
 * Format: "39735:<recipient_pubkey>:<normalized_url>"
 * Kind 39735 is in the NIP-01 addressable event range (30000-39999), making
 * this a valid event coordinate that NIP-57 relays copy from the zap request
 * to the zap receipt, enabling relay-side #a filtering.
 *
 * Note: kind 39735 is also referenced by the publsp project for Lightning LSP
 * liquidity offers. No actual kind 39735 event is ever published here — the
 * number is used purely as a stable coordinate prefix. The d-field is always a
 * normalized URL, which is semantically distinct from publsp identifiers, so
 * the overlap is benign in practice.
 */
export const buildUrlATag = (pubkey: string, url: string): string =>
  `39735:${pubkey}:${zapTagUrl(url)}`;

export function zapATagValues(pubkey: string, url: string): string[] {
  return zapFilterUrls(url).map((value) => `39735:${pubkey}:${value}`);
}

function relaysForSignedZap(relays: string[]): string[] {
  if (getRelayTransport()) {
    return Array.from(new Set(relays.filter(Boolean)));
  }
  const out: string[] = [];
  for (const relay of relays) {
    let normalized: string;
    try {
      normalized = normalizeRelayURL(relay);
    } catch {
      continue;
    }
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

const signEvent = async (zapEvent: any, anon?: boolean) => {
  if (!anon) {
    try {
      await ensureInitialized();
      return await signEventWithNostrLogin(zapEvent);
    } catch {
      /* A signer that looked available can still fail. The receipt is anonymous. */
    }
  }
  if (!zapEvent.tags.some((tag: string[]) => tag[0] === 'anon')) {
    zapEvent.tags.push(['anon']);
  }
  return finalizeEvent(zapEvent, generateRandomPrivKey());
};

const makeZapEvent = async ({
  profile,
  amount,
  relays,
  comment,
  anon,
  url,
}: {
  profile: string;
  nip19Target?: string;
  amount: number;
  relays: string[];
  comment?: string;
  anon?: boolean;
  url?: string;
}) => {
  const req: any = {
    profile: profile,
    amount,
    relays,
    comment: comment || '',
  };
  const event = nip57.makeZapRequest({
    ...req,
    relays: relaysForSignedZap(relays),
  });

  // Add URL-based zap a tag if URL is provided.
  // Uses a deterministic addressable event coordinate (kind 39735) so relays
  // copy it to the zap receipt, enabling relay-side #a filtering.
  if (url) {
    event.tags.push(['a', buildUrlATag(profile, url)]);
  }

  // Check if NostrLogin is available (will initialize if needed)
  // Note: We check availability here to decide if we should add 'anon' tag
  // The actual signing happens in signEvent() which will ensure initialization
  let isNostrLoginAvailable = false;
  if (!anon) {
    try {
      await ensureInitialized();
      isNostrLoginAvailable = typeof window !== 'undefined' && !!(window as any).nostr;
    } catch {
      // If initialization fails, fall back to anonymous
      isNostrLoginAvailable = false;
    }
  }
  
  if (!isNostrLoginAvailable || anon) {
    event.tags.push(['anon']);
  }

  return signEvent(event, anon);
};

export const fetchInvoiceForAction = async ({
  actionId,
  amount,
  comment,
  authorId,
  normalizedRelays,
  anon,
  url,
}: {
  actionId: string;
  amount: number;
  comment?: string;
  authorId: string;
  normalizedRelays: string[];
  anon?: boolean;
  url: string;
}): Promise<{
  invoice: string;
  provider: ZapProviderInfo;
  anonymous: boolean;
}> => {
  const transport = getRelayTransport();
  if (!transport?.fetchZapInvoice) {
    throw new Error('Trusted Zap transport is unavailable');
  }
  const zapEvent = await makeZapEvent({
    profile: authorId,
    amount,
    relays: normalizedRelays,
    comment: comment ?? '',
    anon,
    url,
  });
  const paid = await transport.fetchZapInvoice(actionId, {
    relays: normalizedRelays,
    amount,
    comment: comment ?? '',
    zapEvent,
  });
  return {
    ...paid,
    anonymous: Array.isArray(zapEvent.tags)
      && zapEvent.tags.some((tag: string[]) => tag[0] === 'anon'),
  };
};

export const fetchInvoice = async (
  request: {
    zapEndpoint: string;
    amount: number;
    comment?: string;
    authorId: string;
    normalizedRelays: string[];
    anon?: boolean;
    url?: string;
  },
): Promise<string> => {
  return (await fetchInvoiceDetails(request)).invoice;
};

export async function fetchInvoiceDetails({
  zapEndpoint,
  amount,
  comment,
  authorId,
  normalizedRelays,
  anon,
  url,
}: {
  zapEndpoint: string;
  amount: number;
  comment?: string;
  authorId: string;
  normalizedRelays: string[];
  anon?: boolean;
  url?: string;
}): Promise<{ invoice: string; anonymous: boolean }> {
  const zapEvent = await makeZapEvent({
    profile: authorId,
    amount,
    relays: normalizedRelays,
    comment: comment ?? '',
    anon,
    url,
  });
  const anonymous = Array.isArray(zapEvent.tags)
    && zapEvent.tags.some((tag: string[]) => tag[0] === 'anon');

  let invoiceUrl = `${zapEndpoint}?amount=${amount}&nostr=${encodeURIComponent(
    JSON.stringify(zapEvent)
  )}`;
  if (comment) invoiceUrl += `&comment=${encodeURIComponent(comment ?? '')}`;

  const { status, json } = await httpGetJson(invoiceUrl);
  if (status < 200 || status >= 300) {
    throw new Error(`LNURL request failed: ${status}`);
  }
  if (json == null || typeof json !== 'object') {
    throw new Error('Invalid JSON from LNURL endpoint');
  }
  const { pr: invoice, reason, status: lnurlStatus } = json || {};
  if (typeof invoice === 'string' && invoice.length > 0) {
    const invoiceAmount = getBolt11AmountMsats(invoice);
    if (invoiceAmount == null) {
      throw new Error('LNURL endpoint returned an invalid invoice');
    }
    if (invoiceAmount !== amount) {
      throw new Error('LNURL invoice amount does not match requested amount');
    }
    return { invoice, anonymous };
  }
  if (lnurlStatus === 'ERROR') throw new Error(reason ?? 'Unable to fetch invoice');
  throw new Error('Unable to fetch invoice');
}

export async function relaysForZapRequest({
  actionId,
  pubkey,
  attributeRelays,
  transportRelays,
}: {
  actionId?: string;
  pubkey?: string;
  attributeRelays: string[];
  transportRelays: string[];
}): Promise<string[]> {
  const transport = getRelayTransport();
  if (actionId && transport?.getZapRoute) {
    const route = await transport.getZapRoute(actionId);
    return route.zapRelays;
  }
  if (transport) return transportRelays;
  if (!pubkey) return transportRelays;
  return zapRelaysFor(pubkey, attributeRelays);
}

const generateRandomPrivKey = (): Uint8Array => {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random unavailable: crypto.getRandomValues is required for anonymous zaps');
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Check if NostrLogin is available
 * @deprecated Use ensureInitialized() instead - it will initialize NostrLogin if needed
 */
export const isNip07ExtAvailable = (): boolean => {
  // This function is kept for backward compatibility but will always return false
  // until ensureInitialized() is called. Components should use ensureInitialized() instead.
  return typeof window !== 'undefined' && !!(window as any).nostr;
};

// ---------------------------------------------------------------------------
// nip05 resolution helper – very lightweight fetch to /.well-known/nostr.json
// ---------------------------------------------------------------------------



export async function resolveNip05(nip05Identifier: string): Promise<string | null> {
  try {
    const profile = await nip05.queryProfile(nip05Identifier);
    return profile?.pubkey || null;
  } catch (error) {
    console.error(`Failed to resolve NIP-05 ${nip05Identifier}:`, error);
    return null;
  }
}

// Augment the SimplePool type to include our usage
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
declare module 'nostr-tools' {
  interface SimplePool {
    subscribe(
      relays: string[],
      filter: Filter,
      params: {
        onevent: (event: Event) => void;
        onclose?: () => void;
        id?: string;
        maxWait?: number;
      }
    ): {
      close: () => void;
    };
  }
}

export interface ZapDetails {
  amount: number;
  date: Date;
  authorPubkey: string | null;
  comment?: string;
}

export interface ZapAmountResult {
  totalAmount: number;
  zapDetails: ZapDetails[];
}

function readExtensionZapCache(events: unknown[]): ZapAmountResult | null {
  if (!Array.isArray(events) || events.length !== 1) return null;
  const marker = events[0] as {
    id?: unknown;
    extensionZapCache?: unknown;
    cachedZapSummary?: {
      totalSats?: unknown;
      rows?: unknown;
    };
  } | null;
  if (
    !marker ||
    marker.id !== undefined ||
    marker.extensionZapCache !== true ||
    !marker.cachedZapSummary ||
    typeof marker.cachedZapSummary !== 'object'
  ) {
    return null;
  }
  const { totalSats, rows } = marker.cachedZapSummary;
  if (typeof totalSats !== 'number' || !Number.isFinite(totalSats) || totalSats < 0) {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const zapDetails: ZapDetails[] = [];
  for (const row of rows) {
    const candidate = row as {
      amountSats?: unknown;
      createdAt?: unknown;
      authorPubkey?: unknown;
      comment?: unknown;
    };
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof candidate.amountSats !== 'number' ||
      !Number.isFinite(candidate.amountSats) ||
      candidate.amountSats < 0
    ) {
      continue;
    }
    zapDetails.push({
      amount: candidate.amountSats,
      date: new Date((typeof candidate.createdAt === 'number' ? candidate.createdAt : 0) * 1000),
      authorPubkey: typeof candidate.authorPubkey === 'string' && candidate.authorPubkey
        ? candidate.authorPubkey
        : null,
      comment: typeof candidate.comment === 'string' ? candidate.comment : '',
    });
  }
  zapDetails.sort((left, right) => right.date.getTime() - left.date.getTime());
  return {
    totalAmount: totalSats,
    zapDetails,
  };
}

function zapRowsFromReceipts(
  events: Array<{ created_at?: number }>,
  pubkey: string,
  provider: ZapProviderInfo,
  expectedATag: string | string[] | undefined,
): { totalMsats: number; zapDetails: ZapDetails[] } {
  let totalMsats = 0;
  const zapDetails: ZapDetails[] = [];
  for (const event of events) {
    const validated = validateZapReceipt(event as Event, {
      recipientPubkey: pubkey,
      provider,
      expectedATag,
    });
    if (!validated.ok) continue;
    totalMsats += validated.amountMsats;
    zapDetails.push({
      amount: validated.amountMsats / 1000,
      date: new Date((event.created_at || 0) * 1000),
      authorPubkey: validated.senderPubkey,
      comment: validated.zapRequest.content,
    });
  }
  zapDetails.sort((left, right) => right.date.getTime() - left.date.getTime());
  return { totalMsats, zapDetails };
}

async function fetchLibraryZapAmount({
  pubkey,
  relays,
  url,
}: {
  pubkey: string;
  relays: string[];
  url?: string;
}): Promise<ZapAmountResult> {
  const profileMetadata = await fetchProfileOutbox(pubkey, relays);
  if (!profileMetadata) {
    throw new Error('Zap recipient profile was not found');
  }
  const provider = await getZapProviderInfo(profileMetadata);
  if (!provider) {
    throw new Error('Zap recipient has no valid LNURL provider');
  }
  const filter: Filter = {
    kinds: [9735],
    '#p': [pubkey],
    limit: 1000,
  };
  const expectedATag = url ? zapATagValues(pubkey, url) : undefined;
  if (expectedATag && expectedATag.length > 0) {
    filter['#a'] = expectedATag;
  }
  const { events, answered } = await queryRelays(relays, filter);
  if (answered === 0) {
    throw new Error('No relay answered the zap query');
  }
  const { totalMsats, zapDetails } = zapRowsFromReceipts(
    events,
    pubkey,
    provider,
    expectedATag,
  );
  return {
    totalAmount: totalMsats / 1000,
    zapDetails,
  };
}

export const fetchTotalZapAmount = async ({
  pubkey,
  relays,
  url,
  actionId,
}: {
  pubkey: string;
  relays: string[];
  url?: string;
  actionId?: string;
}): Promise<ZapAmountResult> => {
  const transport = getRelayTransport();
  if (actionId && transport?.getZapSummary) {
    const summary = await transport.getZapSummary(actionId);
    return {
      totalAmount: summary.totalAmount,
      zapDetails: [...summary.zapDetails].sort(
        (left, right) => right.date.getTime() - left.date.getTime(),
      ),
    };
  }
  if (!transport) {
    return fetchLibraryZapAmount({ pubkey, relays, url });
  }

  const pool = transport ? null : new SimplePool();
  let totalAmount = 0;
  const zapDetails: ZapDetails[] = [];

  try {
    let provider: ZapProviderInfo | null = null;
    let providerLookupFailed = false;
    if (actionId && transport?.getZapProvider) {
      try {
        provider = await transport.getZapProvider(actionId, relays);
      } catch (error) {
        providerLookupFailed = true;
        if (!transport) throw error;
      }
    } else {
      const profileMetadata = await getProfileMetadata(pubkey, relays);
      if (profileMetadata) {
        provider = await getZapProviderInfo(profileMetadata);
      } else if (!transport) {
        return { totalAmount: 0, zapDetails: [] };
      }
    }
    if (!provider && !transport) {
      // Fail closed: without LNURL nostrPubkey we cannot authenticate receipts.
      return { totalAmount: 0, zapDetails: [] };
    }

    const filter: any = {
      kinds: [9735],
      '#p': [pubkey],
      limit: 1000,
    };
    const expectedATag = url ? buildUrlATag(pubkey, url) : undefined;

    // When a URL is provided, filter at the relay level using the #a tag.
    // The a tag value (39735:pubkey:url) is copied from the zap request to the
    // zap receipt by NIP-57-compliant relays, so only URL-specific receipts
    // are returned — no client-side description parsing needed for filtering.
    if (expectedATag) {
      filter['#a'] = [expectedATag];
    }

    const events = transport
      ? await transport.query(relays, filter)
      : await pool!.querySync(relays, filter);

    const cached = transport ? readExtensionZapCache(events) : null;
    if (cached) return cached;

    if (!provider) {
      if (providerLookupFailed || transport) {
        throw new Error('Zap recipient has no valid LNURL provider');
      }
      return { totalAmount: 0, zapDetails: [] };
    }

    for (const event of events) {
      const validated = validateZapReceipt(event, {
        recipientPubkey: pubkey,
        provider,
        expectedATag,
      });
      if (!validated.ok) continue;

      totalAmount += validated.amountMsats;
      zapDetails.push({
        amount: validated.amountMsats / 1000, // convert from msats to sats
        date: new Date(event.created_at * 1000),
        authorPubkey: validated.senderPubkey,
        comment: validated.zapRequest.content,
      });
    }
  } catch (error) {
    if (transport) throw error;
    console.error("Nostr-Components: Zap button: Error fetching zap receipts", error);
  } finally {
    pool?.close(relays);
  }

  // Sort zap details by date (newest first)
  zapDetails.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    totalAmount: totalAmount / 1000, // convert from msats to sats
    zapDetails,
  };
};

export const listenForZapReceipt = ({
  relays,
  receiversPubKey,
  invoice,
  provider,
  url,
  onSuccess,
}: {
  relays: string[];
  receiversPubKey: string;
  invoice: string;
  provider: ZapProviderInfo;
  url?: string;
  onSuccess: () => void;
}) => {
  const normalizedRelays = Array.from(new Set(relays));
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // current time - 24 hours
  const transport = getRelayTransport();
  const expectedATag = url
    ? buildUrlATag(receiversPubKey, url)
    : undefined;

  if (transport) {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const deadlineAt = Date.now() + ZAP_RECEIPT_POLL_TIMEOUT_MS;

    const poll = async () => {
      if (stopped || Date.now() >= deadlineAt) {
        stopped = true;
        return;
      }
      try {
        const events = await transport.query(normalizedRelays, {
          kinds: [9735],
          '#p': [receiversPubKey],
          since,
          limit: 100,
        });
        if (stopped || Date.now() >= deadlineAt) {
          stopped = true;
          return;
        }
        for (const event of events) {
          const tags = event.tags as [string, string][];
          if (!tags.some(t => t[0] === 'bolt11' && t[1] === invoice)) continue;
          const validated = validateZapReceipt(event, {
            recipientPubkey: receiversPubKey,
            provider,
            expectedATag,
            expectedBolt11: invoice,
          });
          if (!validated.ok) continue;
          stopped = true;
          onSuccess();
          return;
        }
      } catch {
        // A relay quorum may be temporarily unavailable while the wallet is open.
      }
      const remainingMs = deadlineAt - Date.now();
      if (!stopped && remainingMs > 0) {
        timeoutId = setTimeout(poll, Math.min(3000, remainingMs));
      } else {
        stopped = true;
      }
    };

    void poll();
    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }

  const pool = new SimplePool();

  pool.subscribe(
    normalizedRelays,
    {
      kinds: [9735],
      '#p': [receiversPubKey],
      since,
    },
    {
      onevent(event: Event) {
        const tags = event.tags as [string, string][];
        if (!tags.some(t => t[0] === 'bolt11' && t[1] === invoice)) {
          return;
        }

        const validated = validateZapReceipt(event, {
          recipientPubkey: receiversPubKey,
          provider,
          expectedATag,
          expectedBolt11: invoice,
        });
        if (!validated.ok) return;

        onSuccess();
        cleanup();
      }
    }
  );

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    pool.close(normalizedRelays);
  };

  return cleanup;
};
