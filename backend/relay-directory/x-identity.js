// SPDX-License-Identifier: MIT

import { nip19 } from "nostr-tools";
import { isHexPubkey, isPublicHostname } from "./utils.js";

const TWITTER_TAG = /^(?:twitter|x|com\.twitter):(.+)$/i;
const X_PROFILE_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})\b/gi;
const TWEET_ID = /(\d{10,25})/;
const NIP19_PROFILE_IDENTIFIER =
  /(?:nostr:)?((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)/gi;
const NIP05_IDENTIFIER =
  /(?:^|[\s([<{'"`])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=$|[\s)\]}>,'"`.!?;:])/gi;
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

export function normalizeTwitterHandle(value) {
  if (!value) return null;
  let handle = String(value).trim();
  const urlMatch = [...handle.matchAll(X_PROFILE_LINK)][0];
  if (urlMatch) handle = urlMatch[1];
  handle = handle.replace(/^@/, "").split(/[/?#\s]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  if (RESERVED_X_PATHS.has(handle.toLowerCase())) return null;
  return handle.toLowerCase();
}

export function extractTweetId(value) {
  const match = String(value || "").match(TWEET_ID);
  return match ? match[1] : null;
}

export function extractDirectoryInputs(events) {
  const candidatesByKey = new Map();
  const claimedByKey = new Map();
  const metadataByPubkey = new Map();

  for (const event of events) {
    if (!isHexPubkey(event?.pubkey)) continue;
    const metadata = event.kind === 0 ? safeJson(event.content) : null;
    if (metadata) {
      metadataByPubkey.set(event.pubkey, {
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        name: metadata.name || metadata.display_name || null,
        nip05: metadata.nip05 || null,
        lud16: metadata.lud16 || null,
        lud06: metadata.lud06 || null,
        website: metadata.website || null,
        about: metadata.about || null,
      });
    }

    for (const tag of event.tags || []) {
      if (tag[0] !== "i" || !tag[1]) continue;
      const tagMatch = String(tag[1]).match(TWITTER_TAG);
      if (!tagMatch) continue;

      const handle = normalizeTwitterHandle(tagMatch[1]);
      const proofTweetId = extractTweetId(tag[2]);
      if (!handle || !proofTweetId) continue;

      const key = `${handle}:${event.pubkey}:${proofTweetId}`;
      candidatesByKey.set(key, {
        platform: "twitter",
        handle,
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        proofTweetId,
        sourceKind: event.kind,
        sourceEventId: event.id,
        sourceCreatedAt: event.created_at,
      });
    }

    if (!metadata) continue;
    for (const { handle, field } of extractMetadataXHandles(metadata)) {
      const key = `${handle}:${event.pubkey}:${field}`;
      claimedByKey.set(key, {
        platform: "twitter",
        handle,
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        source: `kind0.${field}`,
        sourceKind: event.kind,
        sourceEventId: event.id,
        sourceCreatedAt: event.created_at,
        identityStatus: "claimed",
      });
    }
  }

  return {
    candidates: [...candidatesByKey.values()].sort(sortCandidate),
    claimed: [...claimedByKey.values()].sort(sortClaim),
    metadataByPubkey,
  };
}

function extractMetadataXHandles(metadata) {
  const results = new Map();

  for (const field of ["twitter", "x"]) {
    const handle = normalizeTwitterHandle(metadata[field]);
    if (handle) results.set(`${handle}:${field}`, { handle, field });
  }

  for (const field of ["website", "about"]) {
    const text = String(metadata[field] || "");
    for (const match of text.matchAll(X_PROFILE_LINK)) {
      const handle = normalizeTwitterHandle(match[1]);
      if (handle) results.set(`${handle}:${field}`, { handle, field });
    }
  }

  return [...results.values()];
}

function safeJson(content) {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function sortCandidate(a, b) {
  return a.handle.localeCompare(b.handle) || a.pubkey.localeCompare(b.pubkey);
}

function sortClaim(a, b) {
  return a.handle.localeCompare(b.handle) || a.source.localeCompare(b.source);
}

export async function verifyTweetCandidate(
  candidate,
  timeoutMs,
  options = {},
) {
  const normalizedOptions =
    typeof options === "function" ? { fetchImpl: options } : options;
  const fetchImpl = normalizedOptions.fetchImpl || fetch;
  const bearerToken = normalizedOptions.bearerToken || null;
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
  const result = await fetchTweet(
    proofTweetId,
    handleHint,
    timeoutMs,
    fetchImpl,
    bearerToken,
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

async function fetchTweet(
  tweetId,
  handleHint,
  timeoutMs,
  fetchImpl,
  bearerToken,
) {
  const failures = [];

  if (bearerToken) {
    const official = await fetchTweetViaXApi(
      tweetId,
      bearerToken,
      timeoutMs,
      fetchImpl,
    );
    if (official.ok) return official;
    failures.push(official);
    if (official.retryable && official.rateLimited) return official;
  }

  const syndication = await fetchTweetViaSyndication(
    tweetId,
    timeoutMs,
    fetchImpl,
  );
  if (syndication.ok) return syndication;
  failures.push(syndication);
  if (syndication.retryable && syndication.rateLimited) return syndication;

  const oembed = await fetchTweetViaOembed(
    tweetId,
    handleHint,
    timeoutMs,
    fetchImpl,
  );
  if (oembed.ok) return oembed;
  failures.push(oembed);

  return mostImportantFetchFailure(failures);
}

async function fetchTweetViaXApi(tweetId, bearerToken, timeoutMs, fetchImpl) {
  try {
    const params = new URLSearchParams({
      expansions: "author_id",
      "tweet.fields": "author_id,text",
      "user.fields": "username",
    });
    const response = await fetchImpl(
      `https://api.x.com/2/tweets/${tweetId}?${params}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return httpFailure("x-api", response);
    const json = await response.json();
    const user = json.includes?.users?.find(
      (candidateUser) => candidateUser.id === json.data?.author_id,
    );
    if (!json.data?.text || !user?.username) {
      return fetchFailure("x-api", "tweet_unavailable", {
        retryable: false,
      });
    }
    return {
      ok: true,
      tweet: {
        text: json.data.text,
        handle: user.username,
        userId: user.id,
        source: "x-api",
      },
    };
  } catch (error) {
    return fetchFailure("x-api", fetchErrorReason(error), { retryable: true });
  }
}

async function fetchTweetViaSyndication(tweetId, timeoutMs, fetchImpl) {
  const failures = [];
  for (const token of [syndicationToken(tweetId), "a"]) {
    try {
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const failure = httpFailure("syndication", response);
        failures.push(failure);
        if (failure.retryable && failure.rateLimited) return failure;
        continue;
      }
      const json = await response.json();
      if (!json?.text || !json.user?.screen_name) continue;
      return {
        ok: true,
        tweet: {
          text: json.text,
          handle: json.user.screen_name,
          userId: json.user.id_str || json.user.id || null,
          source: "syndication",
        },
      };
    } catch (error) {
      failures.push(
        fetchFailure("syndication", fetchErrorReason(error), {
          retryable: true,
        }),
      );
    }
  }
  return mostImportantFetchFailure(
    failures,
    fetchFailure("syndication", "tweet_unavailable", { retryable: false }),
  );
}

async function fetchTweetViaOembed(tweetId, handleHint, timeoutMs, fetchImpl) {
  try {
    const tweetUrl = `https://twitter.com/${handleHint || "i"}/status/${tweetId}`;
    const url = `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(tweetUrl)}`;
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return httpFailure("oembed", response);
    const json = await response.json();
    const handle = normalizeTwitterHandle(json.author_url);
    const text = stripHtml(json.html || "");
    if (!handle || !text) {
      return fetchFailure("oembed", "tweet_unavailable", {
        retryable: false,
      });
    }
    return {
      ok: true,
      tweet: {
        text,
        handle,
        userId: null,
        source: "oembed",
      },
    };
  } catch (error) {
    return fetchFailure("oembed", fetchErrorReason(error), {
      retryable: true,
    });
  }
}

function syndicationToken(tweetId) {
  try {
    const id = BigInt(tweetId);
    const divisor = 1000000000000000n;
    const scaled =
      Number(id / divisor) + Number(id % divisor) / Number(divisor);
    return (scaled * Math.PI).toString(36).replace(/(0+|\.)/g, "") || "a";
  } catch {
    return "a";
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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
  bearerToken,
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
    const profileResult = await fetchXProfile(
      handle,
      bearerToken,
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

async function fetchXProfile(handle, bearerToken, timeoutMs, fetchImpl) {
  const failures = [];
  if (bearerToken) {
    const official = await fetchXProfileViaOfficialApi(
      handle,
      bearerToken,
      timeoutMs,
      fetchImpl,
    );
    if (official.ok) return official;
    failures.push(official);
  }

  const fxtwitter = await fetchXProfileViaFxTwitter(
    handle,
    timeoutMs,
    fetchImpl,
  );
  if (fxtwitter.ok) return fxtwitter;
  failures.push(fxtwitter);
  return mostImportantFetchFailure(failures);
}

async function fetchXProfileViaOfficialApi(
  handle,
  bearerToken,
  timeoutMs,
  fetchImpl,
) {
  try {
    const params = new URLSearchParams({
      "user.fields": "description,entities,id,url,username",
    });
    const response = await fetchImpl(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}?${params}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return httpFailure("x-profile-api", response);
    const json = await response.json();
    if (!json.data?.id || !json.data?.username) {
      return fetchFailure("x-profile-api", "profile_unavailable", {
        retryable: false,
      });
    }
    return { ok: true, profile: json.data, source: "x-api-profile" };
  } catch (error) {
    return fetchFailure("x-profile-api", fetchErrorReason(error), {
      retryable: true,
    });
  }
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

function mostImportantFetchFailure(failures, fallback = null) {
  const candidates = failures.filter(Boolean);
  return (
    candidates.find((failure) => failure.rateLimited) ||
    candidates.find((failure) => failure.retryable) ||
    candidates[0] ||
    fallback ||
    fetchFailure("unknown", "unavailable", { retryable: false })
  );
}

function fetchErrorReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "timeout";
  }
  return "network_error";
}
