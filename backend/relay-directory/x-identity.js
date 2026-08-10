// SPDX-License-Identifier: MIT

import { nip19 } from "nostr-tools";
import {
  extractTweetId,
  isHexPubkey,
  isPublicHostname,
  normalizeTwitterHandle,
} from "./utils.js";

const NIP19_PROFILE_IDENTIFIER =
  /(?:nostr:)?((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)/gi;
const NIP05_IDENTIFIER =
  /(?:^|[\s([<{'"`])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=$|[\s)\]}>,'"`.!?;:])/gi;

export async function verifyTweetCandidate(
  candidate,
  timeoutMs,
  options = {},
) {
  const normalizedOptions =
    typeof options === "function" ? { fetchImpl: options } : options;
  const fetchImpl = normalizedOptions.fetchImpl || fetch;
  if (!candidate?.npub) {
    return {
      ...candidate,
      identityStatus: "rejected",
      rejectionReason: "claim-missing-npub",
    };
  }
  const proofTweetId = extractTweetId(candidate.proofTweetId);
  const handleHint = normalizeTwitterHandle(candidate.handle);
  if (!proofTweetId) {
    return {
      ...candidate,
      identityStatus: "rejected",
      rejectionReason: "invalid-proof-tweet-id",
    };
  }
  const result = await fetchTweetViaFxTwitter(
    proofTweetId,
    handleHint,
    timeoutMs,
    fetchImpl,
  );
  if (!result.ok) {
    if (result.retryable) {
      return {
        ...candidate,
        identityStatus: "retry_later",
        retryReason: result.reason,
        retrySource: result.source,
        retryRateLimited: result.rateLimited,
        rateLimitResetAt: result.rateLimitResetAt,
        retryAfter: result.retryAfter,
      };
    }
    return {
      ...candidate,
      identityStatus: "rejected",
      rejectionReason: "proof-tweet-unavailable",
    };
  }

  const tweet = result.tweet;
  const tweetHandle = normalizeTwitterHandle(tweet.handle);
  if (tweetHandle !== handleHint) {
    return {
      ...candidate,
      identityStatus: "rejected",
      rejectionReason: "proof-author-mismatch",
      proofAuthor: tweetHandle,
      proofSource: tweet.source,
      xUserId: tweet.userId,
    };
  }

  if (!tweet.text.includes(candidate.npub)) {
    return {
      ...candidate,
      identityStatus: "rejected",
      rejectionReason: "npub-not-in-proof-tweet",
      proofAuthor: tweetHandle,
      proofSource: tweet.source,
      xUserId: tweet.userId,
    };
  }

  return {
    ...candidate,
    identityStatus: "verified",
    verificationMethod: "nip39_proof_tweet",
    proofAuthor: tweetHandle,
    proofSource: tweet.source,
    xUserId: tweet.userId,
    verifiedAt: new Date().toISOString(),
  };
}

async function fetchTweetViaFxTwitter(
  tweetId,
  handleHint,
  timeoutMs,
  fetchImpl,
) {
  const path = handleHint
    ? `${encodeURIComponent(handleHint)}/status/${encodeURIComponent(tweetId)}`
    : `status/${encodeURIComponent(tweetId)}`;
  try {
    const response = await fetchImpl(`https://api.fxtwitter.com/${path}`, {
      headers: { "User-Agent": "nostr-components-relay-directory/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return httpFailure("fxtwitter-tweet", response);
    const json = await response.json();
    if (Number(json.code) !== 200) {
      return httpFailure("fxtwitter-tweet", {
        status: Number(json.code) || 500,
        headers: response.headers,
      });
    }
    const text = json.tweet?.text || json.tweet?.raw_text?.text || null;
    const handle = json.tweet?.author?.screen_name || null;
    const userId = json.tweet?.author?.id || null;
    if (!text || !handle) {
      return fetchFailure("fxtwitter-tweet", "tweet_unavailable", {
        retryable: false,
      });
    }
    return {
      ok: true,
      tweet: {
        text,
        handle,
        userId,
        source: "fxtwitter-tweet",
      },
    };
  } catch (error) {
    return fetchFailure("fxtwitter-tweet", fetchErrorReason(error), {
      retryable: true,
    });
  }
}

export function extractNostrIdentifiers(text) {
  const identifiers = new Map();
  const value = String(text || "");

  for (const match of value.matchAll(NIP19_PROFILE_IDENTIFIER)) {
    const identifier = match[1].toLowerCase();
    identifiers.set(identifier, {
      type: identifier.startsWith("npub1") ? "npub" : "nprofile",
      value: identifier,
    });
  }

  for (const match of value.matchAll(NIP05_IDENTIFIER)) {
    const identifier = match[1].toLowerCase();
    identifiers.set(identifier, { type: "nip05", value: identifier });
  }

  return [...identifiers.values()];
}

export async function resolveNostrIdentifier(
  identifier,
  timeoutMs,
  fetchImpl = fetch,
) {
  if (identifier.type === "npub" || identifier.type === "nprofile") {
    try {
      const decoded = nip19.decode(identifier.value);
      const pubkey =
        decoded.type === "npub"
          ? decoded.data
          : decoded.type === "nprofile"
            ? decoded.data.pubkey
            : null;
      if (!isHexPubkey(pubkey)) {
        return { ok: false, reason: "invalid_nip19_profile" };
      }
      const normalizedPubkey = pubkey.toLowerCase();
      return {
        ok: true,
        pubkey: normalizedPubkey,
        npub: nip19.npubEncode(normalizedPubkey),
        identifier: identifier.value,
        identifierType: identifier.type,
      };
    } catch {
      return { ok: false, reason: "invalid_nip19_profile" };
    }
  }

  if (identifier.type !== "nip05") {
    return { ok: false, reason: "unsupported_identifier" };
  }

  const parts = identifier.value.split("@");
  const [name, domain] = parts;
  if (
    parts.length !== 2 ||
    !name ||
    !domain ||
    !/^[a-z0-9._-]+$/i.test(name) ||
    !isPublicHostname(domain)
  ) {
    return { ok: false, reason: "invalid_nip05" };
  }

  try {
    const response = await fetchImpl(
      `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        reason: `nip05_http_${response.status}`,
        retryable: response.status === 429 || response.status >= 500,
      };
    }
    const json = await response.json();
    const pubkey = json.names?.[name];
    if (!isHexPubkey(pubkey)) {
      return { ok: false, reason: "nip05_name_not_found" };
    }
    const normalizedPubkey = pubkey.toLowerCase();
    return {
      ok: true,
      pubkey: normalizedPubkey,
      npub: nip19.npubEncode(normalizedPubkey),
      identifier: identifier.value,
      identifierType: "nip05",
    };
  } catch (error) {
    return {
      ok: false,
      reason: fetchErrorReason(error),
      retryable: true,
    };
  }
}

export async function discoverXBioIdentities({
  handleSeeds,
  additionalHandles = [],
  timeoutMs,
  maxProfiles,
  fetchImpl = fetch,
}) {
  const seedsByHandle = new Map();
  for (const seed of handleSeeds || []) {
    const handle = normalizeTwitterHandle(seed.handle);
    if (!handle) continue;
    const seeds = seedsByHandle.get(handle) || [];
    seeds.push(seed);
    seedsByHandle.set(handle, seeds);
  }
  for (const value of additionalHandles) {
    const handle = normalizeTwitterHandle(value);
    if (handle && !seedsByHandle.has(handle)) seedsByHandle.set(handle, []);
  }

  const handles = [...seedsByHandle.keys()]
    .sort()
    .slice(0, Math.max(0, maxProfiles));
  const recordsByKey = new Map();
  let profilesAttempted = 0;
  let profilesChecked = 0;
  let profilesFailed = 0;
  const profileFailures = {};
  let profilesWithIdentifiers = 0;
  let identifiersResolved = 0;
  let stoppedReason = null;
  const checkedHandles = [];

  for (const handle of handles) {
    profilesAttempted += 1;
    const profileResult = await fetchXProfileViaFxTwitter(
      handle,
      timeoutMs,
      fetchImpl,
    );
    if (!profileResult.ok) {
      if (profileResult.rateLimited) {
        stoppedReason = "x_rate_limited";
        break;
      }
      profilesFailed += 1;
      profileFailures[profileResult.reason] =
        (profileFailures[profileResult.reason] || 0) + 1;
      continue;
    }
    profilesChecked += 1;
    checkedHandles.push(handle);

    const identifiers = extractNostrIdentifiers(
      profileSearchText(profileResult.profile),
    );
    if (identifiers.length) profilesWithIdentifiers += 1;

    for (const identifier of identifiers) {
      const resolved = await resolveNostrIdentifier(
        identifier,
        timeoutMs,
        fetchImpl,
      );
      if (!resolved.ok) continue;
      identifiersResolved += 1;

      const matchingSeed = seedsByHandle
        .get(handle)
        ?.find((seed) => seed.pubkey === resolved.pubkey);
      const key = `${handle}:${resolved.pubkey}`;
      recordsByKey.set(key, {
        platform: "twitter",
        handle,
        pubkey: resolved.pubkey,
        npub: resolved.npub,
        source: "x_profile.bio",
        sourceKind: matchingSeed?.sourceKind || null,
        sourceEventId: matchingSeed?.sourceEventId || null,
        sourceCreatedAt: matchingSeed?.sourceCreatedAt || null,
        identityStatus: "verified",
        verificationMethod: `x_profile_bio_${resolved.identifierType}`,
        nostrIdentifier: resolved.identifier,
        proofSource: profileResult.source,
        xUserId: profileResult.profile.id,
        verifiedAt: new Date().toISOString(),
      });
    }
  }

  return {
    records: [...recordsByKey.values()],
    profilesAttempted,
    profilesChecked,
    profilesFailed,
    profileFailures,
    checkedHandles,
    profilesWithIdentifiers,
    identifiersResolved,
    stoppedReason,
  };
}

async function fetchXProfileViaFxTwitter(handle, timeoutMs, fetchImpl) {
  try {
    const response = await fetchImpl(
      `https://api.fxtwitter.com/2/profile/${encodeURIComponent(handle)}`,
      {
        headers: { "User-Agent": "nostr-components-relay-directory/0.1" },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return httpFailure("fxtwitter-profile", response);
    const json = await response.json();
    if (Number(json.code) !== 200) {
      return httpFailure("fxtwitter-profile", {
        status: Number(json.code) || 500,
        headers: response.headers,
      });
    }
    if (!json.user?.id || !json.user?.screen_name) {
      return fetchFailure("fxtwitter-profile", "profile_unavailable", {
        retryable: false,
      });
    }
    return {
      ok: true,
      profile: json.user,
      source: "fxtwitter-profile",
    };
  } catch (error) {
    return fetchFailure("fxtwitter-profile", fetchErrorReason(error), {
      retryable: true,
    });
  }
}

function profileSearchText(profile) {
  const urls = [
    ...(profile.entities?.description?.urls || []),
    ...(profile.entities?.url?.urls || []),
  ]
    .flatMap((url) => [url.expanded_url, url.display_url])
    .filter(Boolean);
  const fxtwitterUrls = [
    ...(profile.raw_description?.facets || []),
  ].flatMap((facet) => [facet.original, facet.replacement, facet.display]);
  return [
    profile.description,
    profile.raw_description?.text,
    profile.url,
    profile.website?.url,
    profile.website?.display_url,
    ...urls,
    ...fxtwitterUrls,
  ]
    .filter(Boolean)
    .join(" ");
}

function httpFailure(source, response) {
  const status = response.status;
  return fetchFailure(
    source,
    status === 429 ? "rate_limited" : `http_${status}`,
    {
      retryable: status === 429 || status === 408 || status >= 500,
      rateLimited: status === 429,
      status,
      rateLimitResetAt: response.headers?.get?.("x-rate-limit-reset") || null,
      retryAfter: response.headers?.get?.("retry-after") || null,
    },
  );
}

function fetchFailure(source, reason, extra = {}) {
  return {
    ok: false,
    source,
    reason,
    retryable: Boolean(extra.retryable),
    rateLimited: Boolean(extra.rateLimited),
    status: extra.status || null,
    rateLimitResetAt: extra.rateLimitResetAt || null,
    retryAfter: extra.retryAfter || null,
  };
}

function fetchErrorReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "timeout";
  }
  return "network_error";
}
