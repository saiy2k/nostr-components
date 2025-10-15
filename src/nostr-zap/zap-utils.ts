// SPDX-License-Identifier: MIT

import {
  nip57,
  nip05,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools';
import { decodeNip19Entity } from '../common/utils';

/**
 * Helper utilities for Nostr zap operations (adapted from the original `nostr-zap` repo).
 * These are deliberately kept self-contained so `nostr-zap` Web Component can import
 * everything from a single module without polluting the rest of the codebase.
 */

// Basic in-memory cache – sufficient for component lifetime.
const profileCache: Record<string, any> = {};

export const getProfileMetadata = async (authorId: string) => {
  if (profileCache[authorId]) return profileCache[authorId];

  const pool = new SimplePool();
  const relays = [
    'wss://relay.nostr.band',
    'wss://purplepag.es',
    'wss://relay.damus.io',
    'wss://nostr.wine',
  ];

  try {
    const event = await pool.get(relays, {
      authors: [authorId],
      kinds: [0],
    });
    profileCache[authorId] = event;
    return event;
  } finally {
    pool.close(relays);
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
  const endpoint = await nip57.getZapEndpoint(profileMetadata);
  if (!endpoint) throw new Error('Failed to retrieve zap LNURL');
  return endpoint;
};

interface NostrExtension {
  signEvent(event: any): Promise<{
    id: string;
    sig: string;
    kind: number;
    tags: string[][];
    pubkey: string;
    content: string;
    created_at: number;
  }>;
}

const signEvent = async (zapEvent: any, anon?: boolean) => {
  if (isNip07ExtAvailable() && !anon) {
    try {
      const ext = (window as { nostr?: NostrExtension }).nostr;
      if (ext?.signEvent) return await ext.signEvent(zapEvent);
    } catch {
      /* fall-through -> anonymous */
    }
  }
  return finalizeEvent(zapEvent, generateRandomPrivKey());
};

const makeZapEvent = async ({
  profile,
  nip19Target,
  amount,
  relays,
  comment,
  anon,
}: {
  profile: string;
  nip19Target?: string;
  amount: number;
  relays: string[];
  comment?: string;
  anon?: boolean;
}) => {
  const event = nip57.makeZapRequest({
    profile,
    event:
      nip19Target?.startsWith('note')
        ? decodeNip19Entity(nip19Target)
        : null,
    amount,
    relays,
    comment: comment || '',
  });

  if (nip19Target?.startsWith('naddr')) {
    const naddrData: any = decodeNip19Entity(nip19Target);
    const relayTag = naddrData?.relays?.join(',') ?? '';
    event.tags.push(['a', `${naddrData.kind}:${naddrData.pubkey}:${naddrData.identifier}`, relayTag]);
  }

  if (!isNip07ExtAvailable() || anon) {
    event.tags.push(['anon']);
  }

  return signEvent(event, anon);
};

export const fetchInvoice = async ({
  zapEndpoint,
  amount,
  comment,
  authorId,
  nip19Target,
  normalizedRelays,
  anon,
}: {
  zapEndpoint: string;
  amount: number;
  comment?: string;
  authorId: string;
  nip19Target?: string;
  normalizedRelays: string[];
  anon?: boolean;
}): Promise<string> => {
  const zapEvent = await makeZapEvent({
    profile: authorId,
    nip19Target,
    amount,
    relays: normalizedRelays,
    comment: comment ?? '',
    anon,
  });


  let url = `${zapEndpoint}?amount=${amount}&nostr=${encodeURIComponent(
    JSON.stringify(zapEvent)
  )}`;
  if (comment) url += `&comment=${encodeURIComponent(comment ?? '')}`;

  const res = await fetch(url);
  const json = await res.json();
  const { pr: invoice, reason, status } = json;
  if (invoice) return invoice;
  if (status === 'ERROR') throw new Error(reason ?? 'Unable to fetch invoice');
  throw new Error('Unable to fetch invoice');
};

const generateRandomPrivKey = (): Uint8Array => {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback during build – use Math.random (not cryptographically strong but acceptable for anon zaps)
    console.warn('crypto.getRandomValues not available, using Math.random as fallback');
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const isNip07ExtAvailable = (): boolean => typeof window !== 'undefined' && !!(window as any).nostr;

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

// Import necessary types from nostr-tools
import type { Filter, Event } from 'nostr-tools';

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

export const fetchTotalZapAmount = async ({
  pubkey,
  relays,
}: {
  pubkey: string;
  relays: string[];
}): Promise<number> => {
  const pool = new SimplePool();
  let totalAmount = 0;

  try {
    // Use pool.querySync to fetch multiple zap receipt events
    const events = await pool.querySync(relays, {
      kinds: [9735], // Zap receipt
      '#p': [pubkey],
      limit: 1000,
    });

    for (const event of events) {
      const descriptionTag = event.tags?.find((tag: string[]) => tag[0] === 'description');
      if (descriptionTag?.[1]) {
        try {
          const zapRequest = JSON.parse(descriptionTag[1]);
          const amountTag = zapRequest?.tags?.find((tag: string[]) => tag[0] === 'amount');
          if (amountTag?.[1]) {
            totalAmount += parseInt(amountTag[1], 10);
          }
        } catch (e) {
          console.error("Nostr-Components: Zap button: Could not parse zap request from description tag", e);
        }
      }
    }
  } catch (error) {
    console.error("Nostr-Components: Zap button: Error fetching zap receipts", error);
  } finally {
    pool.close(relays);
  }

  return totalAmount / 1000; // convert from msats to sats
};

export const listenForZapReceipt = ({
  relays,
  receiversPubKey,
  invoice,
  onSuccess,
}: {
  relays: string[];
  receiversPubKey: string,
  invoice: string;
  onSuccess: () => void;
}) => {
  const pool = new SimplePool();
  const normalizedRelays = Array.from(new Set([...relays, 'wss://relay.nostr.band']));
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
        if (tags.some(t => t[0] === 'bolt11' && t[1] === invoice)) {
          onSuccess();
          cleanup();
        }
      }
    }
  );

  const cleanup = () => {
    pool.close(normalizedRelays);
  };

  return cleanup;
};
