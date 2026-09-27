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
export const IDENTITY_READ_TIMEOUT_MS = 8_000;
// nostr-tools treats maxWait as EOSE. That must not beat the outer deadline,
// or a silent relay looks like a finished identity read.
const IDENTITY_READ_MAX_WAIT_MS = IDENTITY_READ_TIMEOUT_MS + 60_000;
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

export interface ProfileIdentityLink {
  platform: "github" | "youtube";
  name: string;
  url: string;
}

type ParsedProfileLink =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ok"; link: ProfileIdentityLink };

export function claimHandleIssue(value: string): "reserved" | "invalid" | null {
  const handle = value.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) return "invalid";
  if (RESERVED_X_HANDLES.has(handle)) return "reserved";
  return null;
}

export function normalizeClaimHandle(value: string): string | null {
  return claimHandleIssue(value) === null
    ? value.trim().replace(/^@/, "").toLowerCase()
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
  return relaysCoveredBy(relays, CRAWLER_RELAYS);
}

export function relaysCoveredBy(
  relays: readonly string[],
  covered: Iterable<string>,
): string[] {
  const allowed = new Set<string>();
  for (const relay of covered) {
    const normalized = canonicalRelayUrl(relay);
    if (normalized) allowed.add(normalized);
  }
  return relays.filter((relay) => allowed.has(relay));
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

export function parseGithubProfile(value: string): ParsedProfileLink {
  return parseProfileLink(value, "github", (url) => {
    if (
      !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())
    ) {
      return null;
    }
    const [login, extra] = url.pathname.split("/").filter(Boolean);
    if (!login || extra) return null;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(login)) return null;
    const name = login.toLowerCase();
    return { platform: "github", name, url: `https://github.com/${name}` };
  });
}

export function parseYoutubeChannel(value: string): ParsedProfileLink {
  return parseProfileLink(value, "youtube", (url) => {
    if (
      !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        url.hostname.toLowerCase(),
      )
    ) {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const handle = parts[0]?.startsWith("@") ? parts[0].slice(1) : "";
    if (handle && parts.length === 1 && /^[a-z0-9._-]{3,30}$/i.test(handle)) {
      const name = handle.toLowerCase();
      return {
        platform: "youtube",
        name,
        url: `https://www.youtube.com/@${name}`,
      };
    }
    if (
      parts.length === 2 &&
      parts[0] === "channel" &&
      /^UC[a-zA-Z0-9_-]{22}$/.test(parts[1])
    ) {
      return {
        platform: "youtube",
        name: parts[1],
        url: `https://www.youtube.com/channel/${parts[1]}`,
      };
    }
    return null;
  });
}

function parseProfileLink(
  value: string,
  platform: ProfileIdentityLink["platform"],
  read: (url: URL) => ProfileIdentityLink | null,
): ParsedProfileLink {
  const trimmed = value.trim();
  if (!trimmed) return { status: "empty" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { status: "invalid" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return { status: "invalid" };
  }
  const link = read(url);
  if (!link || link.platform !== platform) return { status: "invalid" };
  return { status: "ok", link };
}

export function createClaimEvent(
  handle: string,
  proofUrl: string,
  now: Date = new Date(),
  existing?: ExistingClaimIdentity | null,
  links: readonly ProfileIdentityLink[] = [],
): EventTemplate {
  return {
    kind: 10011,
    created_at: claimEventCreatedAt(now, existing?.createdAt),
    content: "",
    tags: identityTagsForClaim(handle, proofUrl, existing?.tags, links),
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
  links: readonly ProfileIdentityLink[] = [],
): string[][] {
  const replacedPlatforms = new Set(links.map((link) => link.platform));
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
    const platform = tag[1].slice(0, tag[1].indexOf(":")).toLowerCase();
    if (replacedPlatforms.has(platform as ProfileIdentityLink["platform"])) {
      continue;
    }
    kept.push([...tag]);
  }
  if (kept.length + 1 + links.length > MAX_IDENTITY_TAGS) {
    throw new Error(
      "The existing Nostr identity has too many linked accounts to update safely.",
    );
  }
  return [
    ...kept,
    ["i", `twitter:${handle}`, proofUrl],
    ...links.map((link) => ["i", `${link.platform}:${link.name}`, link.url]),
  ];
}

export async function loadExistingClaimEvent(
  pubkey: string,
  relays: string[],
  pool: ClaimReadPool = new SimplePool(),
): Promise<Event | null> {
  const author = pubkey.toLowerCase();
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
        { kinds: [10011], authors: [author], limit: 1 },
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
              list.some((reason) => reason === "closed by caller");
            if (!complete) finish(new Error("unavailable"));
            else finish();
          },
          maxWait: IDENTITY_READ_MAX_WAIT_MS,
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
    (event) => event.kind === 10011 && event.pubkey?.toLowerCase() === author,
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
): Promise<string> {
  try {
    if (
      requiredRelays.length === 0 ||
      requiredRelays.some((relay) => !relays.includes(relay))
    ) {
      throw new Error("No crawler-covered claim relay is configured.");
    }
    const publishes = pool.publish(relays, event);
    if (publishes.length === 0) {
      throw new Error("No claim relay is available.");
    }
    const settled = await Promise.allSettled(publishes);
    const acknowledged = relays.find(
      (relay, index) =>
        requiredRelays.includes(relay) &&
        settled[index]?.status === "fulfilled",
    );
    if (!acknowledged) {
      throw new Error(
        "No crawler-covered relay acknowledged the signed claim.",
      );
    }
    return acknowledged;
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
): Promise<string> {
  return publishClaimEvent(event, relays, new SimplePool(), coveredRelays);
}
