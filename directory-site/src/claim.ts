import {
  SimplePool,
  nip19,
  verifyEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools";
import crawlerRelayDirectory from "../../backend/relays.json";

export const DEFAULT_CLAIM_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
] as const;

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;
const PROOF_URL_PATTERN =
  /^\/(?:@?)([a-z0-9_]{1,15})\/status\/(\d{10,25})(?:\/(?:photo|video)\/\d{1,5})?\/?$/i;
const TWITTER_IDENTITY = /^(?:twitter|x|com\.twitter):([a-z0-9_]{1,15})$/i;
const MAX_IDENTITY_TAGS = 20;
const MAX_TAG_VALUES = 10;
const MAX_TAG_VALUE_LENGTH = 2000;
const IDENTITY_READ_TIMEOUT_MS = 8_000;
const IDENTITY_FUTURE_SKEW_SECONDS = 120;
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

interface ClaimReadPool {
  subscribe(
    relays: string[],
    filter: { kinds: number[]; authors: string[]; limit: number },
    params: {
      onevent: (event: Event) => void;
      oneose?: () => void;
      onclose?: (reasons: string[]) => void;
      maxWait?: number;
    },
  ): { close(): void | Promise<void> };
  close(relays: string[]): void;
}

export interface ExistingClaimIdentity {
  createdAt?: number;
  tags?: ReadonlyArray<readonly string[]>;
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

function canonicalRelayUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "wss:" ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return url.toString();
}

const CRAWLER_RELAYS = new Set(
  crawlerRelayDirectory
    .map((entry) => canonicalRelayUrl(entry.url))
    .filter((url): url is string => url !== null),
);

export function crawlerCoveredRelays(relays: readonly string[]): string[] {
  return relays.filter((relay) => CRAWLER_RELAYS.has(relay));
}

export function parseClaimRelays(value?: string): string[] {
  const candidates = value?.trim()
    ? value.split(",").map((relay) => relay.trim())
    : [...DEFAULT_CLAIM_RELAYS];
  const relays: string[] = [];

  for (const candidate of candidates) {
    const normalized = canonicalRelayUrl(candidate);
    if (!normalized || relays.includes(normalized)) continue;
    relays.push(normalized);
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
  existing?: ExistingClaimIdentity | null,
): EventTemplate {
  return {
    kind: 10011,
    created_at: claimEventCreatedAt(now, existing?.createdAt),
    content: "",
    tags: identityTagsForClaim(handle, proofUrl, existing?.tags),
  };
}

function claimEventCreatedAt(now: Date, existingCreatedAt?: number): number {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (existingCreatedAt == null || !Number.isFinite(existingCreatedAt)) {
    return nowSeconds;
  }
  if (existingCreatedAt > nowSeconds + IDENTITY_FUTURE_SKEW_SECONDS) {
    throw new Error(
      "The existing Nostr identity event is too far in the future to replace.",
    );
  }
  return Math.max(nowSeconds, Math.floor(existingCreatedAt) + 1);
}

function identityTagsForClaim(
  handle: string,
  proofUrl: string,
  existingTags: ReadonlyArray<readonly string[]> = [],
): string[][] {
  const kept: string[][] = [];
  for (const tag of existingTags) {
    if (tag[0] !== "i") continue;
    if (
      tag.length < 2 ||
      tag.length > MAX_TAG_VALUES ||
      tag.some(
        (value) =>
          typeof value !== "string" || value.length > MAX_TAG_VALUE_LENGTH,
      )
    ) {
      throw new Error(
        "The existing Nostr identity could not be preserved safely.",
      );
    }
    const match = TWITTER_IDENTITY.exec(tag[1]);
    if (match && match[1].toLowerCase() === handle) continue;
    kept.push([...tag]);
  }
  if (kept.length > MAX_IDENTITY_TAGS) {
    throw new Error(
      "The existing Nostr identity has too many linked accounts to update safely.",
    );
  }
  return [...kept, ["i", `twitter:${handle}`, proofUrl]];
}

export async function loadExistingClaimEvent(
  pubkey: string,
  relays: string[],
  pool: ClaimReadPool = new SimplePool(),
): Promise<Event | null> {
  const events: Event[] = [];
  let settled = false;
  let subscription: { close(): void | Promise<void> } | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        void subscription?.close();
        finish(new Error("timeout"));
      }, IDENTITY_READ_TIMEOUT_MS);
      subscription = pool.subscribe(
        relays,
        { kinds: [10011], authors: [pubkey], limit: 1 },
        {
          onevent(event) {
            events.push(event);
          },
          oneose() {
            void subscription?.close();
          },
          onclose(reasons) {
            const list = (Array.isArray(reasons) ? reasons : [reasons]).map(
              (reason) => String(reason),
            );
            const complete =
              list.length === relays.length &&
              list.every((reason) => reason === "closed by caller");
            if (!complete) finish(new Error("unavailable"));
            else finish();
          },
          maxWait: 5_000,
        },
      );
    });
  } catch {
    throw new Error(
      "Could not read the existing Nostr identity before publishing.",
    );
  } finally {
    pool.close(relays);
  }

  const authored = events.filter(
    (event) => event.kind === 10011 && event.pubkey?.toLowerCase() === pubkey,
  );
  const verified = authored.filter((event) => verifyEvent(event));
  if (authored.length > 0 && verified.length === 0) {
    throw new Error(
      "Could not read the existing Nostr identity before publishing.",
    );
  }
  verified.sort((left, right) => right.created_at - left.created_at);
  return verified[0] ?? null;
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
  const expectedKind = unsignedEvent.kind;
  const expectedCreatedAt = unsignedEvent.created_at;
  const expectedContent = unsignedEvent.content;
  const expectedTags = JSON.stringify(unsignedEvent.tags);
  const signed = await signer.signEvent(unsignedEvent);
  if (
    signed.pubkey.toLowerCase() !== expectedPubkey ||
    signed.kind !== expectedKind ||
    signed.created_at !== expectedCreatedAt ||
    signed.content !== expectedContent ||
    JSON.stringify(signed.tags) !== expectedTags ||
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
  requiredRelays: readonly string[] = relays,
): Promise<void> {
  if (
    requiredRelays.length === 0 ||
    requiredRelays.some((relay) => !relays.includes(relay))
  ) {
    throw new Error("No crawler-covered claim relay is configured.");
  }
  try {
    const publishes = pool.publish(relays, event);
    if (publishes.length === 0) {
      throw new Error("No claim relay is available.");
    }
    const settled = await Promise.allSettled(publishes);
    const requiredAcknowledged = relays.some(
      (relay, index) =>
        requiredRelays.includes(relay) &&
        settled[index]?.status === "fulfilled",
    );
    if (!requiredAcknowledged) {
      throw new Error(
        "No crawler-covered relay acknowledged the signed claim.",
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("No crawler-covered")
    ) {
      throw error;
    }
    throw new Error("No claim relay acknowledged the signed claim.");
  } finally {
    pool.close(relays);
  }
}

export function publishClaimToCoveredRelays(
  event: Event,
  relays: string[],
  coveredRelays: readonly string[],
): Promise<void> {
  return publishClaimEvent(event, relays, new SimplePool(), coveredRelays);
}
