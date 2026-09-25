import {
  SimplePool,
  nip19,
  verifyEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools";

export const DEFAULT_CLAIM_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
] as const;

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;
const PROOF_URL_PATTERN =
  /^\/(?:@?)([a-z0-9_]{1,15})\/status\/(\d{10,25})\/?$/i;
const RESERVED_X_HANDLES = new Set([
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "search",
  "share",
  "settings",
]);

export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<Event>;
}

interface ClaimPool {
  publish(relays: string[], event: Event): Promise<string>[];
  close(relays: string[]): void;
}

export function normalizeClaimHandle(value: string): string | null {
  const handle = value.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(handle) && !RESERVED_X_HANDLES.has(handle)
    ? handle
    : null;
}

export function validateProofUrl(value: string, handle: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      url.hostname.toLowerCase(),
    )
  ) {
    return null;
  }

  const match = url.pathname.match(PROOF_URL_PATTERN);
  if (!match || match[1].toLowerCase() !== handle) return null;
  return `https://x.com/${handle}/status/${match[2]}`;
}

export function parseClaimRelays(value?: string): string[] {
  const candidates = value?.trim()
    ? value.split(",").map((relay) => relay.trim())
    : [...DEFAULT_CLAIM_RELAYS];
  const relays: string[] = [];

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    if (
      url.protocol !== "wss:" ||
      url.pathname !== "/" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      continue;
    }
    const normalized = url.toString();
    if (!relays.includes(normalized)) relays.push(normalized);
    if (relays.length === 5) break;
  }

  if (relays.length === 0) {
    throw new Error("No valid claim relays are configured.");
  }
  return relays;
}

export function claimProofText(npub: string): string {
  return `Verifying my Nostr identity for Nostr Atlas:\n${npub}`;
}

export function claimProofComposerUrl(npub: string): string {
  const url = new URL("https://x.com/intent/post");
  url.searchParams.set("text", claimProofText(npub));
  return url.toString();
}

export function createClaimEvent(
  handle: string,
  proofUrl: string,
  now: Date = new Date(),
): EventTemplate {
  return {
    kind: 10011,
    created_at: Math.floor(now.getTime() / 1000),
    content: "",
    tags: [["i", `twitter:${handle}`, proofUrl]],
  };
}

export async function connectClaimSigner(signer: NostrSigner): Promise<{
  pubkey: string;
  npub: string;
}> {
  const pubkey = (await signer.getPublicKey()).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) {
    throw new Error("The Nostr signer returned an invalid public key.");
  }
  return { pubkey, npub: nip19.npubEncode(pubkey) };
}

export async function signClaimEvent(
  signer: NostrSigner,
  expectedPubkey: string,
  unsignedEvent: EventTemplate,
): Promise<Event> {
  const signed = await signer.signEvent(unsignedEvent);
  if (
    signed.pubkey.toLowerCase() !== expectedPubkey ||
    signed.kind !== unsignedEvent.kind ||
    signed.created_at !== unsignedEvent.created_at ||
    signed.content !== unsignedEvent.content ||
    JSON.stringify(signed.tags) !== JSON.stringify(unsignedEvent.tags) ||
    !verifyEvent(signed)
  ) {
    throw new Error("The Nostr signer returned an invalid claim event.");
  }
  return signed;
}

export async function publishClaimEvent(
  event: Event,
  relays: string[],
  pool: ClaimPool = new SimplePool(),
): Promise<void> {
  try {
    const publishes = pool.publish(relays, event);
    if (publishes.length === 0) {
      throw new Error("No claim relay is available.");
    }
    await new Promise<void>((resolve, reject) => {
      let failures = 0;
      for (const publish of publishes) {
        publish
          .then(() => resolve())
          .catch(() => {
            failures += 1;
            if (failures === publishes.length)
              reject(new Error("all rejected"));
          });
      }
    });
  } catch {
    throw new Error("No claim relay acknowledged the signed claim.");
  } finally {
    pool.close(relays);
  }
}
