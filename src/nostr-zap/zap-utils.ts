import {
  nip19,
  nip57,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools';

/**
 * Helper utilities for Nostr zap operations (adapted from the original `nostr-zap` repo).
 * These are deliberately kept self-contained so `nostr-zap` Web Component can import
 * everything from a single module without polluting the rest of the codebase.
 */

export const decodeNpub = (npub: string): string => {
  return (nip19.decode(npub).data as string) || '';
};

const decodeNip19Entity = (entity: string): any => nip19.decode(entity).data;

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

const signEvent = async (zapEvent: any, anon?: boolean) => {
  if (isNip07ExtAvailable() && !anon) {
    try {
      const ext = (window as any).nostr as { signEvent: (e: any) => Promise<any> } | undefined;
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
      nip19Target && nip19Target.startsWith('note')
        ? decodeNip19Entity(nip19Target)
        : undefined,
    amount,
    relays,
    comment: comment || '',
  });

  if (nip19Target && nip19Target.startsWith('naddr')) {
    const naddrData: any = decodeNip19Entity(nip19Target);
    const relayTag = naddrData.relays?.join(',') ?? '';
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
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const isNip07ExtAvailable = (): boolean => typeof window !== 'undefined' && !!(window as any).nostr;

// ---------------------------------------------------------------------------
// nip05 resolution helper – very lightweight fetch to /.well-known/nostr.json
// ---------------------------------------------------------------------------
export async function resolveNip05(nip05: string): Promise<string> {
  const [name, domain] = nip05.split('@');
  if (!domain) throw new Error('Invalid nip05');
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('Unable to resolve nip05');
  const json = await res.json();
  const pubkey = json.names?.[name];
  if (!pubkey) throw new Error('nip05 not found');
  return pubkey as string;
}

// Augment missing types for SimplePool.sub so we can safely cast above
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
declare module 'nostr-tools' {
  interface SimplePool {
    sub(relays: string[], filters: Array<Record<string, unknown>>): {
      on(type: string, cb: (event: any) => void): void;
    };
  }
}

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

  const sub = pool.subscribe(normalizedRelays, 
    {
      kinds: [9735],
      "#p": [receiversPubKey],
      since,
    },
    {
      onevent(event: any) {
        if (event.tags.find((t: any) => t[0] === 'bolt11' && t[1] === invoice)) {
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
