// SPDX-License-Identifier: MIT

export const DEFAULT_MAX_PENDING_CLAIMS = 20;
export const DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS = 10;
export const DEFAULT_MAX_REJECTION_TOMBSTONES = 100;

const TWITTER_TAG = /^(?:twitter|x|com\.twitter):(.+)$/i;
export const X_PROFILE_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})\b/gi;
const TWEET_ID = /(\d{10,25})/;
const RESERVED_X_PATHS = new Set([
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

export function firestoreSafeId(value) {
  return String(value).replace(/[/.#[\]]/g, "_");
}

export function isHexPubkey(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

export function isPublicHostname(value) {
  const hostname = String(value || "").trim().toLowerCase();
  if (!hostname || hostname.length > 253) return false;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

export function backfillStateId(relay, kind, prefix = "backfill") {
  return firestoreSafeId(`${prefix}:${relay}:kind:${kind}`);
}

/** Match an `i` tag value like `twitter:alice` / `x:alice` / `com.twitter:alice`. */
export function matchTwitterTag(value) {
  return String(value || "").match(TWITTER_TAG);
}

export function normalizeTwitterHandle(value) {
  if (!value) return null;
  let handle = String(value).trim();
  const urlMatch = [...handle.matchAll(X_PROFILE_LINK)][0];
  if (urlMatch) handle = urlMatch[1];
  handle = handle.replace(/^@/, "").split(/[/?#\s]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  const normalized = handle.toLowerCase();
  return RESERVED_X_PATHS.has(normalized) ? null : normalized;
}

export function extractTweetId(value) {
  const match = String(value || "").match(TWEET_ID);
  return match ? match[1] : null;
}

/** Recency key for a claim: proof publication wins over source event time. */
export function claimRecency(claim) {
  return Number(claim?.proofPublishedAt || claim?.sourceCreatedAt || 0);
}

export function compareClaimsNewestFirst(a, b) {
  return (
    claimRecency(b) - claimRecency(a) ||
    String(a.claimId).localeCompare(String(b.claimId))
  );
}

export function numberFromEnv(env, name, fallback) {
  if (env[name] === undefined || env[name] === "") return fallback;
  return Number(env[name]);
}
