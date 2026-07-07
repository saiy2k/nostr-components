// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { nip19 } from "nostr-tools";
import { DEFAULT_COLLECTIONS, stripUndefined } from "./runtime.js";
import { firestoreSafeId } from "./utils.js";

export const DEFAULT_MAX_PENDING_CLAIMS = 20;
export const DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS = 10;
export const DEFAULT_MAX_REJECTION_TOMBSTONES = 100;
const HANDLE_READ_CONCURRENCY = 50;

const TWITTER_TAG = /^(?:twitter|x|com\.twitter):(.+)$/i;
const X_PROFILE_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})\b/gi;
const X_MENTION = /(?:^|[\s([{"'])@([A-Za-z0-9_]{1,15})\b/g;
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

export async function extractIdentityClaims(
  events,
  relay,
  now = new Date(),
  options = {},
) {
  const claims = new Map();
  const discoveredAt = now.toISOString();
  const mentionValidationCache = options.mentionValidationCache || new Map();

  for (const event of events) {
    const byHandle = new Map();
    const metadata = event.kind === 0 ? safeJson(event.content) : null;

    for (const tag of event.tags || []) {
      if (tag[0] !== "i" || !tag[1]) continue;
      const match = String(tag[1]).match(TWITTER_TAG);
      if (!match) continue;
      const handle = normalizeTwitterHandle(match[1]);
      const proofTweetId = extractTweetId(tag[2]);
      if (!handle || !proofTweetId) continue;
      byHandle.set(handle, {
        handle,
        proofTweetId,
        sources: ["event.i_tag"],
        evidence: [
          {
            source: "event.i_tag",
            value: tag.map((value) => String(value)),
          },
        ],
      });
    }

    if (metadata) {
      const metadataCandidates = extractMetadataXHandles(metadata);
      const acceptedCandidates = await filterExistingMentionHandles(
        metadataCandidates,
        mentionValidationCache,
        options,
      );
      for (const { handle, source, evidence } of acceptedCandidates) {
        const current = byHandle.get(handle) || {
          handle,
          proofTweetId: null,
          sources: [],
          evidence: [],
        };
        current.sources = [...new Set([...current.sources, source])];
        current.evidence = mergeEvidence(current.evidence, evidence);
        byHandle.set(handle, current);
      }
    }

    for (const candidate of byHandle.values()) {
      const claim = stripUndefined({
        claimId: event.id,
        platform: "twitter",
        handle: candidate.handle,
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        proofTweetId: candidate.proofTweetId,
        sources: candidate.sources.sort(),
        evidence: candidate.evidence,
        status: "pending",
        sourceEventId: event.id,
        sourceKind: event.kind,
        sourceCreatedAt: event.created_at,
        sourceRelay: relay,
        signatureVerified: true,
        discoveredAt,
        metadata: metadata
          ? profileMetadata(event.pubkey, metadata)
          : undefined,
        sourceEvent:
          event.kind === 10011 ? boundedSourceEvent(event) : undefined,
      });
      claims.set(`${candidate.handle}:${event.id}`, claim);
    }
  }

  return [...claims.values()].sort(compareClaimsNewestFirst);
}

export function mergeHandleClaims(existing, incomingClaims = [], options = {}) {
  const maxPendingClaims =
    options.maxPendingClaims ?? DEFAULT_MAX_PENDING_CLAIMS;
  const maxInactiveVerifiedClaims =
    options.maxInactiveVerifiedClaims ?? DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS;
  const maxRejectionTombstones =
    options.maxRejectionTombstones ?? DEFAULT_MAX_REJECTION_TOMBSTONES;
  const activeClaimId = existing?.activeIdentity?.claimId || null;
  const tombstones = normalizeTombstones(existing).slice(
    0,
    maxRejectionTombstones,
  );
  const rejectedIds = new Set(tombstones.map((item) => item.claimId));
  const currentClaims = (existing?.claims || []).filter(
    (claim) => claim?.claimId && claim.status !== "rejected",
  );
  const claimsById = new Map(
    currentClaims.map((claim) => [claim.claimId, claim]),
  );
  let added = 0;
  let skippedExisting = 0;
  let skippedRejected = 0;

  for (const claim of incomingClaims) {
    if (rejectedIds.has(claim.claimId)) {
      skippedRejected += 1;
      continue;
    }
    if (claimsById.has(claim.claimId)) {
      skippedExisting += 1;
      continue;
    }
    claimsById.set(claim.claimId, claim);
    added += 1;
  }

  const allClaims = [...claimsById.values()];
  const active = activeClaimId
    ? allClaims.find((claim) => claim.claimId === activeClaimId)
    : null;
  const pending = allClaims
    .filter(
      (claim) => claim.claimId !== activeClaimId && claim.status === "pending",
    )
    .sort(compareClaimsNewestFirst)
    .slice(0, maxPendingClaims);
  const inactiveVerified = allClaims
    .filter(
      (claim) => claim.claimId !== activeClaimId && claim.status === "verified",
    )
    .sort(compareClaimsNewestFirst)
    .slice(0, maxInactiveVerifiedClaims);
  const retainedClaims = [active, ...pending, ...inactiveVerified]
    .filter(Boolean)
    .sort(compareClaimsNewestFirst);
  const retainedIds = new Set(retainedClaims.map((claim) => claim.claimId));
  const retainedIncoming = incomingClaims.filter((claim) =>
    retainedIds.has(claim.claimId),
  ).length;
  const changed =
    !sameClaims(currentClaims, retainedClaims) ||
    !sameTombstones(existing?.rejectedClaimTombstones || [], tombstones);

  return {
    changed,
    claims: retainedClaims,
    rejectedClaimTombstones: tombstones,
    pendingClaimCount: retainedClaims.filter(
      (claim) => claim.status === "pending",
    ).length,
    stats: {
      added: Math.min(added, retainedIncoming),
      evicted: Math.max(0, allClaims.length - retainedClaims.length),
      skippedExisting,
      skippedRejected,
    },
  };
}

export async function planDirectoryHandleWrites(db, claims, options = {}) {
  const collection =
    options.firestoreHandlesCollection || DEFAULT_COLLECTIONS.handles;
  const handleStateCache = options.handleStateCache || new Map();
  const grouped = groupClaimsByHandle(claims);
  const groupedEntries = [...grouped.entries()];
  const writes = [];
  const stats = {
    handlesRead: 0,
    handlesChanged: 0,
    claimsAdded: 0,
    claimsEvicted: 0,
    claimsSkippedExisting: 0,
    claimsSkippedRejected: 0,
  };

  for (
    let index = 0;
    index < groupedEntries.length;
    index += HANDLE_READ_CONCURRENCY
  ) {
    await Promise.all(
      groupedEntries
        .slice(index, index + HANDLE_READ_CONCURRENCY)
        .filter(([handle]) => !handleStateCache.has(handle))
        .map(async ([handle]) => {
          const id = directoryHandleId(handle);
          const snapshot = await db.collection(collection).doc(id).get();
          handleStateCache.set(
            handle,
            snapshot.exists ? snapshot.data() || {} : null,
          );
          stats.handlesRead += 1;
        }),
    );
  }

  for (const [handle, handleClaims] of groupedEntries) {
    const id = directoryHandleId(handle);
    const cached = handleStateCache.get(handle);
    const existed = cached !== null && cached !== undefined;
    const existing = cached || {};
    const merged = mergeHandleClaims(existing, handleClaims, options);
    stats.claimsAdded += merged.stats.added;
    stats.claimsEvicted += merged.stats.evicted;
    stats.claimsSkippedExisting += merged.stats.skippedExisting;
    stats.claimsSkippedRejected += merged.stats.skippedRejected;
    if (!merged.changed) continue;

    stats.handlesChanged += 1;
    const projectionStatus =
      merged.pendingClaimCount > 0
        ? "pending"
        : existing.projectionStatus || "complete";
    handleStateCache.set(handle, {
      ...existing,
      platform: "twitter",
      handle,
      claims: merged.claims,
      rejectedClaimTombstones: merged.rejectedClaimTombstones,
      pendingClaimCount: merged.pendingClaimCount,
      projectionStatus,
    });
    writes.push({
      collection,
      id,
      data: stripUndefined({
        platform: "twitter",
        handle,
        activeIdentity: existed ? undefined : existing.activeIdentity || null,
        claims: merged.claims,
        rejectedClaimTombstones: merged.rejectedClaimTombstones,
        pendingClaimCount: merged.pendingClaimCount,
        projectionStatus,
        nextAttemptAt:
          merged.pendingClaimCount > 0
            ? FieldValue.serverTimestamp()
            : undefined,
        createdAt: existed ? undefined : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  return { writes, stats };
}

export function directoryHandleId(handle) {
  return firestoreSafeId(`twitter:${normalizeTwitterHandle(handle)}`);
}

function groupClaimsByHandle(claims) {
  const grouped = new Map();
  for (const claim of claims) {
    const handle = normalizeTwitterHandle(claim.handle);
    if (!handle) continue;
    const current = grouped.get(handle) || [];
    current.push({ ...claim, handle });
    grouped.set(handle, current);
  }
  return grouped;
}

export function extractMetadataXHandles(metadata) {
  const results = new Map();
  for (const field of ["twitter", "x"]) {
    const handle = normalizeTwitterHandle(metadata[field]);
    if (handle) {
      results.set(`${handle}:${field}`, {
        handle,
        source: `kind0.${field}`,
        evidence: {
          source: `kind0.${field}`,
          value: String(metadata[field]),
        },
        requiresExistenceCheck: false,
      });
    }
  }
  for (const field of ["website", "about"]) {
    for (const match of String(metadata[field] || "").matchAll(
      X_PROFILE_LINK,
    )) {
      const handle = normalizeTwitterHandle(match[1]);
      if (handle) {
        results.set(`${handle}:${field}`, {
          handle,
          source: `kind0.${field}`,
          evidence: {
            source: `kind0.${field}`,
            value: match[0],
          },
          requiresExistenceCheck: false,
        });
      }
    }
  }
  for (const match of String(metadata.about || "").matchAll(X_MENTION)) {
    const handle = normalizeTwitterHandle(match[1]);
    if (!handle || results.has(`${handle}:about`)) continue;
    results.set(`${handle}:about-mention`, {
      handle,
      source: "kind0.about_mention",
      evidence: {
        source: "kind0.about_mention",
        value: `@${match[1]}`,
      },
      requiresExistenceCheck: true,
    });
  }
  return [...results.values()];
}

function profileMetadata(pubkey, metadata) {
  return stripUndefined({
    pubkey,
    name: boundedString(metadata.name || metadata.display_name, 100),
    nip05: boundedString(metadata.nip05, 255),
    lud16: boundedString(metadata.lud16, 255),
    lud06: boundedString(metadata.lud06, 2000),
    website: boundedString(metadata.website, 2000),
    about: boundedString(metadata.about, 4000),
  });
}

async function filterExistingMentionHandles(candidates, cache, options) {
  return Promise.all(
    candidates.map(async (candidate) => {
      if (!candidate.requiresExistenceCheck) return candidate;
      if (!cache.has(candidate.handle)) {
        cache.set(
          candidate.handle,
          checkXHandleExists(candidate.handle, options),
        );
      }
      return (await cache.get(candidate.handle)) ? candidate : null;
    }),
  ).then((values) => values.filter(Boolean));
}

export async function checkXHandleExists(handle, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.xMentionCheckTimeoutMs || 5000;
  try {
    const response = await fetchImpl(
      `https://x.com/${encodeURIComponent(handle)}`,
      {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    return response.status !== 404;
  } catch {
    return false;
  }
}

function mergeEvidence(current, evidence) {
  const values = [...(current || []), evidence].filter(Boolean);
  const unique = new Map(values.map((item) => [JSON.stringify(item), item]));
  return [...unique.values()];
}

function boundedSourceEvent(event) {
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    content: boundedString(event.content, 4000) || "",
    tags: (event.tags || [])
      .slice(0, 100)
      .map((tag) =>
        (tag || []).slice(0, 10).map((value) => String(value).slice(0, 2000)),
      ),
    sig: boundedString(event.sig, 128),
  };
}

function boundedString(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).slice(0, maxLength);
}

function safeJson(content) {
  try {
    const value = JSON.parse(content || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function normalizeTombstones(existing) {
  const values = existing?.rejectedClaimTombstones || [];
  const byId = new Map();
  for (const value of values) {
    if (!value?.claimId) continue;
    byId.set(value.claimId, value);
  }
  for (const claim of existing?.claims || []) {
    if (claim?.status !== "rejected" || !claim.claimId) continue;
    byId.set(claim.claimId, {
      claimId: claim.claimId,
      rejectedAt: claim.verifiedAt || claim.updatedAt || null,
      reason: claim.rejectionReason || "rejected",
    });
  }
  return [...byId.values()].sort((a, b) =>
    String(b.rejectedAt || "").localeCompare(String(a.rejectedAt || "")),
  );
}

function compareClaimsNewestFirst(a, b) {
  return (
    Number(b.proofPublishedAt || b.sourceCreatedAt || 0) -
      Number(a.proofPublishedAt || a.sourceCreatedAt || 0) ||
    String(a.claimId).localeCompare(String(b.claimId))
  );
}

function sameClaims(left, right) {
  return (
    JSON.stringify([...left].sort(compareClaimsNewestFirst)) ===
    JSON.stringify([...right].sort(compareClaimsNewestFirst))
  );
}

function sameTombstones(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
