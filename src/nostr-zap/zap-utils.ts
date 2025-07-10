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

/**
 * Safely decodes an npub string into its hex representation
 * @param npub - The npub string to decode (format: npub1...)
 * @returns The hex-encoded public key, or empty string if decoding fails
 */
export const decodeNpub = (npub: string): string => {
  if (typeof npub !== 'string' || !npub.startsWith('npub1')) {
    return '';
  }

  try {
    const decoded = nip19.decode(npub);
    if (decoded && typeof decoded.data === 'string') {
      return decoded.data;
    }
  } catch (error) {
    console.error('Failed to decode npub:', error);
  }
  
  return '';
};

/**
 * Safely decodes a NIP-19 entity (like npub, nsec, etc.)
 * @param entity - The NIP-19 encoded string
 * @returns The decoded data or null if decoding fails
 */
const decodeNip19Entity = (entity: string): any => {
  if (typeof entity !== 'string' || !/^[a-z0-9]+1[ac-hj-np-z02-9]+/.test(entity)) {
    return null;
  }

  try {
    const decoded = nip19.decode(entity);
    return decoded?.data ?? null;
  } catch (error) {
    console.error('Failed to decode NIP-19 entity:', error);
    return null;
  }
};

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
        : undefined,
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

// List of allowed TLDs for NIP-05 identifiers
const ALLOWED_TLDS = [
  'com', 'org', 'net', 'io', 'co', 'dev', 'me', 'xyz', 'app', 'page', 'site',
  'blog', 'info', 'biz', 'online', 'app', 'world', 'lol', 'sh', 'wtf', 'ninja'
];

// Maximum time to wait for NIP-05 resolution (in milliseconds)
const NIP05_RESOLVE_TIMEOUT = 10000; // 10 seconds

// Validate domain to prevent SSRF and other attacks
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 255) return false;
  
  // Check if domain contains only allowed characters
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)) {
    return false;
  }

  // Check TLD against whitelist
  const tld = domain.split('.').pop()?.toLowerCase();
  if (!tld || !ALLOWED_TLDS.includes(tld)) {
    return false;
  }

  return true;
}

export async function resolveNip05(nip05: string): Promise<string> {
  // Basic input validation
  if (!nip05 || typeof nip05 !== 'string') {
    throw new Error('Invalid NIP-05 identifier');
  }

  const [name, domain] = nip05.split('@');
  
  // Validate name and domain
  if (!name || !domain || !/^[a-zA-Z0-9_.+-]+$/.test(name)) {
    throw new Error('Invalid NIP-05 format');
  }

  // Validate domain to prevent SSRF
  if (!isValidDomain(domain)) {
    throw new Error('Invalid domain in NIP-05 identifier');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NIP05_RESOLVE_TIMEOUT);

  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { 
      headers: { 
        'accept': 'application/json',
        'user-agent': 'NostrZap/1.0',
      },
      signal: controller.signal,
      // Prevent sending cookies or credentials
      credentials: 'omit',
      // Prevent following redirects to avoid SSRF
      redirect: 'error'
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to resolve NIP-05: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const pubkey = json.names?.[name];
    
    if (!pubkey || typeof pubkey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
      throw new Error('Invalid or missing pubkey in NIP-05 response');
    }

    return pubkey;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('NIP-05 resolution timed out');
      }
      throw new Error(`NIP-05 resolution failed: ${error.message}`);
    }
    
    throw new Error('Unknown error during NIP-05 resolution');
  }
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
