// SPDX-License-Identifier: MIT

import {
  nip57,
  nip05,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools';
import type { Filter, Event } from 'nostr-tools';
import { normalizeURL } from '../common/utils';
import { ensureInitialized, signEvent as signEventWithNostrLogin } from '../common/nostr-login-service';
import { DEFAULT_RELAYS } from '../common/constants';
import {
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
const profileCache: Record<string, any> = {};
const ZAP_PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const ZAP_PROVIDER_NEGATIVE_TTL_MS = 30 * 1000;
const zapProviderCache: Record<
  string,
  { value: ZapProviderInfo | null; expiresAt: number }
> = {};

export const getProfileMetadata = async (authorId: string, relays?: string[]) => {
  if (profileCache[authorId]) return profileCache[authorId];

  const pool = new SimplePool();
  const relayList = relays && relays.length > 0 ? relays : [...DEFAULT_RELAYS];

  try {
    const event = await pool.get(relayList, {
      authors: [authorId],
      kinds: [0],
    });
    profileCache[authorId] = event;
    return event;
  } finally {
    pool.close(relayList);
  }
};

export const getBatchedProfileMetadata = async (authorIds: string[], relays?: string[]) => {
  // Filter out already cached profiles
  const uncachedIds = authorIds.filter(id => !profileCache[id]);

  // If all profiles are cached, return them
  if (uncachedIds.length === 0) {
    return authorIds.map(id => ({ id, profile: profileCache[id] }));
  }

  const pool = new SimplePool();
  const relayList = relays && relays.length > 0 ? relays : [...DEFAULT_RELAYS];

  try {
    // Fetch all uncached profiles in a single query
    const events = await pool.querySync(relayList, {
      authors: uncachedIds,
      kinds: [0],
    });

    // Cache the fetched profiles
    events.forEach(event => {
      profileCache[event.pubkey] = event;
    });

    // Combine cached and newly fetched profiles
    const allProfiles = authorIds.map(id => ({
      id,
      profile: profileCache[id] || null
    }));

    return allProfiles;
  } finally {
    pool.close(relayList);
  }
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
  const cacheKey = profileMetadata.pubkey || profileMetadata.id || '';
  const cached = cacheKey ? zapProviderCache[cacheKey] : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const provider = await resolveZapProviderInfo(profileMetadata);
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
  `39735:${pubkey}:${normalizeURL(url)}`;

const signEvent = async (zapEvent: any, anon?: boolean) => {
  if (!anon) {
    try {
      await ensureInitialized();
      return await signEventWithNostrLogin(zapEvent);
    } catch {
      /* fall-through -> anonymous */
    }
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
  const event = nip57.makeZapRequest(req);

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

export const fetchInvoice = async ({
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
}): Promise<string> => {
  const zapEvent = await makeZapEvent({
    profile: authorId,
    amount,
    relays: normalizedRelays,
    comment: comment ?? '',
    anon,
    url,
  });


  let invoiceUrl = `${zapEndpoint}?amount=${amount}&nostr=${encodeURIComponent(
    JSON.stringify(zapEvent)
  )}`;
  if (comment) invoiceUrl += `&comment=${encodeURIComponent(comment ?? '')}`;

  const res = await fetch(invoiceUrl, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`LNURL request failed: ${res.status} ${res.statusText}`);
  }
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error('Invalid JSON from LNURL endpoint');
  }
  const { pr: invoice, reason, status } = json || {};
  if (invoice) return invoice;
  if (status === 'ERROR') throw new Error(reason ?? 'Unable to fetch invoice');
  throw new Error('Unable to fetch invoice');
};

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
  authorPubkey: string;
  comment?: string;
}

export interface ZapAmountResult {
  totalAmount: number;
  zapDetails: ZapDetails[];
}

export const fetchTotalZapAmount = async ({
  pubkey,
  relays,
  url,
}: {
  pubkey: string;
  relays: string[];
  url?: string;
}): Promise<ZapAmountResult> => {
  const pool = new SimplePool();
  let totalAmount = 0;
  const zapDetails: ZapDetails[] = [];

  try {
    const profileMetadata = await getProfileMetadata(pubkey, relays);
    if (!profileMetadata) {
      return { totalAmount: 0, zapDetails: [] };
    }

    const provider = await getZapProviderInfo(profileMetadata);
    if (!provider) {
      // Fail closed: without LNURL nostrPubkey we cannot authenticate receipts.
      return { totalAmount: 0, zapDetails: [] };
    }

    const filter: any = {
      kinds: [9735],
      '#p': [pubkey],
      limit: 1000,
    };

    // When a URL is provided, filter at the relay level using the #a tag.
    // The a tag value (39735:pubkey:url) is copied from the zap request to the
    // zap receipt by NIP-57-compliant relays, so only URL-specific receipts
    // are returned — no client-side description parsing needed for filtering.
    if (url) {
      filter['#a'] = [buildUrlATag(pubkey, url)];
    }

    const events = await pool.querySync(relays, filter);

    for (const event of events) {
      const validated = validateZapReceipt(event, {
        recipientPubkey: pubkey,
        provider,
      });
      if (!validated.ok) continue;

      totalAmount += validated.amountMsats;
      zapDetails.push({
        amount: validated.amountMsats / 1000, // convert from msats to sats
        date: new Date(event.created_at * 1000),
        authorPubkey: validated.zapRequest.pubkey,
        comment: validated.zapRequest.content,
      });
    }
  } catch (error) {
    console.error("Nostr-Components: Zap button: Error fetching zap receipts", error);
  } finally {
    pool.close(relays);
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
  onSuccess,
}: {
  relays: string[];
  receiversPubKey: string;
  invoice: string;
  provider: ZapProviderInfo;
  onSuccess: () => void;
}) => {
  const pool = new SimplePool();
  const normalizedRelays = Array.from(new Set(relays));
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // current time - 24 hours

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
        });
        if (!validated.ok) return;

        onSuccess();
        cleanup();
      }
    }
  );

  const cleanup = () => {
    pool.close(normalizedRelays);
  };

  return cleanup;
};
