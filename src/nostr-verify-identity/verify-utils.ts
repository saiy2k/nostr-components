// SPDX-License-Identifier: MIT

import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import { ensureInitialized, getPublicKey, signEvent } from '../common/nostr-login-service';

const REPLACEABLE_FETCH_TIMEOUT_MS = 8000;
const FETCH_TIMED_OUT = Symbol('fetch-timed-out');

/**
 * Helper utilities for NIP-39 ("Linking Profiles to Other Platforms") identity
 * verification. Kept self-contained so the `<nostr-verify-identity>` Web
 * Component can import everything from a single module.
 *
 * Identity proofs are `i` tags inside a **kind:10011** event:
 *   ["i", "twitter:<handle>", "<proofTweetId>"]
 * (kind:30382 is NIP-85 reputation data and is unrelated.)
 *
 * Verification of a Twitter/X proof runs entirely client-side and for $0:
 * Twitter's oEmbed endpoint (`publish.x.com/oembed`) supports JSONP via a
 * `callback` parameter, so we load it with a <script> tag and sidestep CORS.
 * The returned `html` field contains BOTH the author handle (`author_url`) and
 * the full tweet text — enough to check "authored by <handle> AND contains the
 * user's npub" without any backend or paid X API.
 *
 * (The permanent numeric `x_user_id` — useful for surviving handle renames — is
 * only available from `cdn.syndication.twimg.com`, which is not JSONP/CORS
 * friendly. That is an optional enhancement for the directory crawler, not part
 * of the in-browser verify path, so it is deliberately omitted here.)
 */

export type Platform = 'twitter' | 'github' | 'mastodon' | 'telegram';

export interface OEmbedResult {
  /** Display name, e.g. "Bebop" */
  authorName: string;
  /** Profile URL, e.g. "https://x.com/Bebop2077_" */
  authorUrl: string;
  /** Handle parsed from authorUrl, e.g. "Bebop2077_" */
  handle: string;
  /** Raw oEmbed HTML blockquote (contains the tweet text). */
  html: string;
  /** Tweet text with tags stripped, for display. */
  text: string;
}

export interface VerifyResult {
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  reason?: string;
  oembed?: OEmbedResult;
}

/** Canonical NIP-39 twitter proof text the user is asked to post. */
export function buildProofText(npub: string): string {
  return `Verifying my account on nostr\n\nMy Public Key: "${npub}"`;
}

/** The X "post a tweet" intent URL, prefilled with the proof text. */
export function buildTweetIntentUrl(npub: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildProofText(npub))}`;
}

/**
 * Accepts a raw tweet id OR a full tweet URL (twitter.com / x.com) and returns
 * the numeric status id, or null if none can be extracted.
 */
export function extractTweetId(input: string): string | null {
  const trimmed = (input || '').trim();
  if (/^\d{5,25}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d{5,25})/i);
  return m ? m[1] : null;
}

/** Build the NIP-39 identity `i` tag. Handle is normalized to lowercase. */
export function buildIdentityTag(
  platform: Platform,
  handle: string,
  proof: string
): string[] {
  return ['i', `${platform}:${handle.toLowerCase()}`, proof];
}

/**
 * Load Twitter/X oEmbed for a tweet via JSONP (no CORS, no backend).
 * Resolves null on network error or timeout.
 */
export function fetchProofTweet(
  tweetId: string,
  handleHint = 'i',
  timeoutMs = 8000
): Promise<OEmbedResult | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise<OEmbedResult | null>((resolve) => {
    const cbName = `__nc_oembed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const tweetUrl = `https://twitter.com/${handleHint}/status/${tweetId}`;
    const src =
      `https://publish.x.com/oembed?omit_script=true&dnt=true` +
      `&url=${encodeURIComponent(tweetUrl)}&callback=${cbName}`;

    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      try { delete (window as any)[cbName]; } catch { (window as any)[cbName] = undefined; }
      script.remove();
      clearTimeout(timer);
    };

    const finish = (value: OEmbedResult | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    (window as any)[cbName] = (data: any) => {
      if (!data || typeof data.html !== 'string') return finish(null);
      const handle = parseHandle(data.author_url);
      finish({
        authorName: data.author_name || '',
        authorUrl: data.author_url || '',
        handle,
        html: data.html,
        text: stripHtml(data.html),
      });
    };

    script.src = src;
    script.async = true;
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
}

/**
 * Verify a proof tweet bidirectionally:
 *   1. tweet text contains the exact `npub`, AND
 *   2. if a `handle` is declared up front, the tweet is authored by it.
 * When no handle is declared, the proof links the npub to whichever account
 * actually authored the tweet (read back from `oembed.handle`). Forging this
 * requires the victim's Nostr key AND control of their X account.
 */
export async function verifyTwitterProof(
  handle: string,
  npub: string,
  tweetId: string
): Promise<VerifyResult> {
  const oembed = await fetchProofTweet(tweetId, handle || 'i');
  if (!oembed) {
    return { ok: false, reason: 'Could not load that tweet (deleted, private, or network error).' };
  }
  if (!oembed.handle) {
    return {
      ok: false,
      reason: 'Could not determine the tweet author handle from oEmbed.',
      oembed,
    };
  }
  if (handle && oembed.handle.toLowerCase() !== handle.toLowerCase()) {
    return {
      ok: false,
      reason: `Tweet is authored by @${oembed.handle}, not @${handle}.`,
      oembed,
    };
  }
  if (!oembed.html.includes(npub)) {
    return {
      ok: false,
      reason: 'Tweet does not contain your npub. Post the exact proof text and try again.',
      oembed,
    };
  }
  return { ok: true, oembed };
}

/** Get the logged-in user's hex pubkey (via window.nostr / NIP-07). */
export async function getUserPubkey(): Promise<string | null> {
  try {
    await ensureInitialized();
    return await getPublicKey();
  } catch (error) {
    console.error('Nostr-Components: verify-identity: error getting pubkey', error);
    return null;
  }
}

/**
 * Merge an `i` tag into an existing tag list without clobbering other tags.
 * De-dupes on `platform:handle` (case-insensitive) so re-verifying updates the
 * proof in place and other platforms' claims are preserved.
 */
export function mergeIdentityTag(
  existingTags: string[][],
  identityTag: string[]
): string[][] {
  const key = (identityTag[1] || '').toLowerCase();
  const kept = (existingTags || []).filter(
    (t) => !(t[0] === 'i' && (t[1] || '').toLowerCase() === key)
  );
  kept.push(identityTag);
  return kept;
}

/**
 * Publish the verified identity.
 *
 * NIP-39 canonical home is **kind:10011**; we also mirror the `i` tag into the
 * user's **kind:0** because most clients read identity claims from the profile
 * event today. Both writes are a non-destructive merge WHEN THE CURRENT EVENT IS
 * RETRIEVABLE: we fetch the user's current event, preserve its `content` and all
 * existing `tags`, then append/replace only this one `i` tag. (kind:0 is
 * replaceable — building it from scratch would wipe the user's
 * name/about/picture/lud16.)
 *
 * If the current kind:10011 state cannot be read with confidence, publishing is
 * aborted rather than risking an empty merge that drops other identity tags.
 *
 * @returns the kinds actually published to.
 */
export async function publishIdentity(
  ndk: NDK,
  pubkey: string,
  identityTag: string[],
  opts: { mirrorToKind0?: boolean } = {}
): Promise<{ published: number[] }> {
  const { mirrorToKind0 = true } = opts;
  await ensureInitialized();
  const published: number[] = [];

  // --- kind:10011 (canonical) ---
  // 10011 isn't a named NDKKind member, so cast the literal to the enum type.
  const existing10011 = await fetchReplaceableEvent(ndk, { kinds: [10011 as NDKKind], authors: [pubkey] });
  if (existing10011 === FETCH_TIMED_OUT) {
    throw new Error('Could not load your existing identity event. Try again before publishing.');
  }
  await signAndPublish(ndk, {
    kind: 10011,
    pubkey,
    content: existing10011?.content ?? '',
    tags: mergeIdentityTag(existing10011?.tags ?? [], identityTag),
  });
  published.push(10011);

  // --- kind:0 mirror (only if a profile already exists; never create a blank one) ---
  if (mirrorToKind0) {
    const existing0 = await fetchReplaceableEvent(ndk, { kinds: [NDKKind.Metadata], authors: [pubkey] });
    if (existing0 !== FETCH_TIMED_OUT && existing0) {
      await signAndPublish(ndk, {
        kind: 0,
        pubkey,
        content: existing0.content ?? '',
        tags: mergeIdentityTag(existing0.tags ?? [], identityTag),
      });
      published.push(0);
    }
  }

  return { published };
}

async function fetchReplaceableEvent(
  ndk: NDK,
  filter: { kinds: NDKKind[]; authors: string[] }
): Promise<NDKEvent | null | typeof FETCH_TIMED_OUT> {
  try {
    return await Promise.race([
      ndk.fetchEvent(filter),
      new Promise<typeof FETCH_TIMED_OUT>((resolve) => {
        setTimeout(() => resolve(FETCH_TIMED_OUT), REPLACEABLE_FETCH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return FETCH_TIMED_OUT;
  }
}

/** Internal: sign an unsigned event with window.nostr and publish via NDK. */
async function signAndPublish(
  ndk: NDK,
  unsigned: { kind: number; pubkey: string; content: string; tags: string[][] }
): Promise<void> {
  const event = {
    ...unsigned,
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signEvent(event as any);
  const ndkEvent = new NDKEvent(ndk, signed as any);
  await ndkEvent.publish();
}

/** Parse a Twitter/X handle from a profile URL. */
function parseHandle(authorUrl: string | undefined): string {
  if (!authorUrl) return '';
  const m = authorUrl.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
  return m ? m[1] : '';
}

/** Strip HTML tags / decode the few entities oEmbed uses, for display only. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&#39;/g, "'")
    .trim();
}
