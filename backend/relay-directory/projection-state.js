// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { nip19 } from "nostr-tools";
import {
  DEFAULT_COLLECTIONS,
  firestoreTimestampToMs,
  stripUndefined,
} from "./runtime.js";
import {
  claimRecency,
  compareClaimsNewestFirst,
  firestoreSafeId,
  isHexPubkey,
} from "./utils.js";

export {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  DEFAULT_MAX_PENDING_CLAIMS,
  DEFAULT_MAX_REJECTION_TOMBSTONES,
} from "./utils.js";
import {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  DEFAULT_MAX_PENDING_CLAIMS,
  DEFAULT_MAX_REJECTION_TOMBSTONES,
} from "./utils.js";

export const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
/** Upper bound for externally supplied retry-after / rate-limit reset hints. */
export const DEFAULT_MAX_EXTERNAL_RETRY_MS = 24 * 60 * 60 * 1000;

export function pendingClaimsForHandle(handleData) {
  return (handleData?.claims || [])
    .filter((claim) => claim?.claimId && claim.status === "pending")
    .sort(compareClaimsNewestFirst);
}

export function projectionHandleIsDue(handleData, nowMs = Date.now()) {
  if (!handleData || Number(handleData.pendingClaimCount || 0) <= 0) {
    return false;
  }
  const nextAttemptAt = firestoreTimestampToMs(handleData.nextAttemptAt);
  return !nextAttemptAt || nextAttemptAt <= nowMs;
}

export function applyProjectionResults(handleData, results, options = {}) {
  const now = options.now || new Date();
  const nowIso = now.toISOString();
  const retryDelayMs = options.retryDelayMs ?? 15 * 60 * 1000;
  const maxExternalRetryMs =
    options.maxExternalRetryMs ?? DEFAULT_MAX_EXTERNAL_RETRY_MS;
  const maxPendingClaims =
    options.maxPendingClaims ?? DEFAULT_MAX_PENDING_CLAIMS;
  const maxInactiveVerifiedClaims =
    options.maxInactiveVerifiedClaims ?? DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS;
  const maxRejectionTombstones =
    options.maxRejectionTombstones ?? DEFAULT_MAX_REJECTION_TOMBSTONES;
  const maxRetryAttempts =
    options.maxRetryAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
  const claimsById = new Map(
    (handleData?.claims || [])
      .filter((claim) => claim?.claimId && claim.status !== "rejected")
      .map((claim) => [claim.claimId, claim]),
  );
  const tombstonesById = new Map(
    (handleData?.rejectedClaimTombstones || [])
      .filter((item) => item?.claimId)
      .map((item) => [item.claimId, item]),
  );
  const stats = {
    verified: 0,
    rejected: 0,
    retryLater: 0,
    pendingDropped: 0,
  };

  for (const result of results || []) {
    const claimId = result.claimId || result.claim?.claimId;
    if (!claimId) continue;
    const current = claimsById.get(claimId) || result.claim;
    if (!current) continue;

    if (result.identityStatus === "verified") {
      claimsById.set(claimId, verifiedClaim(current, result, nowIso));
      tombstonesById.delete(claimId);
      stats.verified += 1;
    } else if (result.identityStatus === "rejected") {
      claimsById.delete(claimId);
      tombstonesById.set(claimId, {
        claimId,
        rejectedAt: nowIso,
        reason: result.rejectionReason || "identity_verification_failed",
      });
      stats.rejected += 1;
    } else if (result.identityStatus === "retry_later") {
      const priorAttemptCount = Number(current.attemptCount || 0);
      const attemptCount =
        (Number.isInteger(priorAttemptCount) && priorAttemptCount >= 0
          ? priorAttemptCount
          : 0) + 1;
      const retryReason =
        result.retryReason || "temporary_verification_failure";
      if (attemptCount >= maxRetryAttempts) {
        claimsById.delete(claimId);
        tombstonesById.set(claimId, {
          claimId,
          rejectedAt: nowIso,
          reason: `retry-attempts-exhausted:${retryReason}`,
        });
        stats.rejected += 1;
      } else {
        claimsById.set(claimId, {
          ...current,
          status: "pending",
          attemptCount,
          lastAttemptAt: nowIso,
          retryReason,
          retrySource: result.retrySource || "projection",
          retryAt: new Date(
            retryAtMs(result, now, retryDelayMs, maxExternalRetryMs),
          ).toISOString(),
        });
        stats.retryLater += 1;
      }
    }
  }

  const existingActive = normalizeActiveIdentity(
    handleData?.activeIdentity,
    claimsById,
    tombstonesById,
  );
  const activeIdentity = selectActiveIdentity(
    existingActive,
    [...claimsById.values()].filter((claim) => claim.status === "verified"),
  );
  if (activeIdentity) claimsById.set(activeIdentity.claimId, activeIdentity);

  const allPending = [...claimsById.values()]
    .filter((claim) => claim.status === "pending")
    .sort(compareClaimsNewestFirst);
  const pending = allPending.slice(0, maxPendingClaims);
  stats.pendingDropped = allPending.length - pending.length;
  const inactiveVerified = [...claimsById.values()]
    .filter(
      (claim) =>
        claim.status === "verified" &&
        claim.claimId !== activeIdentity?.claimId,
    )
    .sort(compareClaimsNewestFirst)
    .slice(0, maxInactiveVerifiedClaims);
  const claims = [activeIdentity, ...pending, ...inactiveVerified]
    .filter(Boolean)
    .sort(compareClaimsNewestFirst);
  const rejectedClaimTombstones = [...tombstonesById.values()]
    .sort((a, b) =>
      String(b.rejectedAt || "").localeCompare(String(a.rejectedAt || "")),
    )
    .slice(0, maxRejectionTombstones);
  const scheduling =
    (results || []).length === 0 && pending.length > 0
      ? {
          status: "retry_later",
          nextAttemptAt: new Date(now.getTime() + retryDelayMs),
        }
      : projectionSchedule(pending, now);
  const activeChanged = !sameValue(
    handleData?.activeIdentity || null,
    activeIdentity || null,
  );
  const state = {
    activeIdentity: activeIdentity || null,
    claims,
    rejectedClaimTombstones,
    pendingClaimCount: pending.length,
    projectionStatus: scheduling.status,
    nextAttemptAt: scheduling.nextAttemptAt,
  };
  const changed = !sameValue(
    projectableState(handleData),
    projectableState(state),
  );

  return { changed, activeChanged, state, stats };
}

export function buildHandleProjectionWrites(
  { id, data },
  transition,
  options = {},
) {
  if (!transition?.changed) return [];
  const handlesCollection =
    options.firestoreHandlesCollection || DEFAULT_COLLECTIONS.handles;
  const entriesCollection =
    options.firestoreEntriesCollection || DEFAULT_COLLECTIONS.entries;
  const writes = [
    {
      collection: handlesCollection,
      id,
      data: stripUndefined({
        ...transition.state,
        projectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    },
  ];
  const active = transition.state.activeIdentity;
  const activeEntryId =
    active && isHexPubkey(active.pubkey)
      ? directoryEntryId(data?.handle || active.handle, active.pubkey)
      : null;
  const previousActive = data?.activeIdentity;
  const previousEntryId =
    previousActive && isHexPubkey(previousActive.pubkey)
      ? directoryEntryId(
          data?.handle || previousActive.handle,
          previousActive.pubkey,
        )
      : null;

  if (
    transition.activeChanged &&
    previousEntryId &&
    previousEntryId !== activeEntryId
  ) {
    writes.push({
      collection: entriesCollection,
      id: previousEntryId,
      data: stripUndefined({
        identityStatus: "obsolete",
        directoryStatus: "obsolete",
        zappable: false,
        autoZapAllowed: false,
        supersededByEntryId: activeEntryId,
        obsoleteAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  if (transition.activeChanged && activeEntryId) {
    writes.push({
      collection: entriesCollection,
      id: activeEntryId,
      data: stripUndefined({
        platform: "twitter",
        handle: data?.handle || active.handle,
        pubkey: active.pubkey,
        npub: active.npub || nip19.npubEncode(active.pubkey),
        claimId: active.claimId,
        sourceEventId: active.sourceEventId,
        sourceKind: active.sourceKind,
        sourceCreatedAt: active.sourceCreatedAt,
        sourceRelay: active.sourceRelay,
        identityStatus: "verified",
        obsoleteAt: null,
        supersededByEntryId: null,
        directoryStatus:
          active.zappable === true
            ? "verified_zappable"
            : active.zapReason === "zap-check-skipped"
              ? "verified_zap_unknown"
              : "verified_not_zappable",
        verificationMethods: active.verificationMethods || [],
        metadata: active.metadata || null,
        proofTweetId: active.proofTweetId,
        proofSource: active.proofSource,
        nostrIdentifier: active.nostrIdentifier,
        xUserId: active.xUserId,
        verifiedAt: active.verifiedAt,
        zappable: active.zappable === true,
        autoZapAllowed: active.zappable === true,
        lud16: active.lud16,
        lnurlp: active.lnurlp,
        zapReason: active.zapReason,
        zapCheckedAt: active.zapCheckedAt,
        zapCheckTransient: active.zapCheckTransient === true,
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  return writes;
}

export function directoryEntryId(handle, pubkey) {
  return firestoreSafeId(
    `twitter:${String(handle || "").toLowerCase()}:${pubkey}`,
  );
}

function verifiedClaim(current, result, nowIso) {
  const methods = [
    ...(current.verificationMethods || []),
    ...(result.verificationMethods || []),
    result.verificationMethod,
  ].filter(Boolean);
  const clean = { ...current };
  delete clean.lastAttemptAt;
  delete clean.retryAt;
  delete clean.retryReason;
  delete clean.retrySource;
  delete clean.attemptCount;

  return stripUndefined({
    ...clean,
    status: "verified",
    verifiedAt: result.verifiedAt || nowIso,
    proofPublishedAt: result.proofPublishedAt,
    verificationMethods: [...new Set(methods)],
    proofAuthor: result.proofAuthor,
    proofSource: result.proofSource,
    nostrIdentifier: result.nostrIdentifier,
    xUserId: result.xUserId,
    zappable: result.zappable,
    zapReason: result.zapReason,
    lud16: result.lud16,
    lnurlp: result.lnurlp,
    lnurlAllowsNostr: result.lnurlAllowsNostr,
    lnurlNostrPubkey: result.lnurlNostrPubkey,
    zapCheckedAt: result.zapCheckedAt,
    zapCheckTransient: result.zapCheckTransient,
  });
}

function normalizeActiveIdentity(activeIdentity, claimsById, tombstonesById) {
  if (!activeIdentity?.claimId) return null;
  if (
    activeIdentity.status === "rejected" ||
    tombstonesById.has(activeIdentity.claimId)
  ) {
    return null;
  }
  const current = claimsById.get(activeIdentity.claimId);
  if (current?.status === "rejected") return null;
  const normalized =
    current || {
      ...activeIdentity,
      status: "verified",
    };
  return isHexPubkey(normalized.pubkey) ? normalized : null;
}

function selectActiveIdentity(existingActive, verifiedClaims) {
  let active = existingActive;
  for (const candidate of [...verifiedClaims].sort(compareClaimsNewestFirst)) {
    if (!isHexPubkey(candidate.pubkey)) continue;
    if (!active) {
      active = candidate;
      continue;
    }
    if (candidate.claimId === active.claimId) {
      active = candidate;
      continue;
    }
    if (claimRecency(candidate) > claimRecency(active)) active = candidate;
  }
  return active || null;
}

function projectionSchedule(pendingClaims, now) {
  if (!pendingClaims.length) {
    return { status: "complete", nextAttemptAt: null };
  }
  const retryTimes = pendingClaims
    .map((claim) => Date.parse(claim.retryAt || ""))
    .filter(Number.isFinite);
  const hasReadyClaim = pendingClaims.some((claim) => {
    const retryAt = Date.parse(claim.retryAt || "");
    return !Number.isFinite(retryAt) || retryAt <= now.getTime();
  });
  if (hasReadyClaim) {
    return { status: "pending", nextAttemptAt: now };
  }
  return {
    status: "retry_later",
    nextAttemptAt: new Date(Math.min(...retryTimes)),
  };
}

function projectableState(value) {
  return {
    activeIdentity: value?.activeIdentity || null,
    claims: value?.claims || [],
    rejectedClaimTombstones: value?.rejectedClaimTombstones || [],
    pendingClaimCount: Number(value?.pendingClaimCount || 0),
    projectionStatus: value?.projectionStatus || null,
    nextAttemptAt: firestoreTimestampToMs(value?.nextAttemptAt),
  };
}

function retryAtMs(
  result,
  now,
  retryDelayMs,
  maxExternalRetryMs = DEFAULT_MAX_EXTERNAL_RETRY_MS,
) {
  const nowMs = now.getTime();
  const candidates = [nowMs + retryDelayMs];
  const retryAfter = String(result.retryAfter || "").trim();
  if (/^\d+$/.test(retryAfter)) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds)) {
      candidates.push(nowMs + retryAfterSeconds * 1000);
    }
  } else {
    const retryAfterDate = Date.parse(retryAfter);
    if (Number.isFinite(retryAfterDate)) candidates.push(retryAfterDate);
  }

  const reset = Number(result.rateLimitResetAt);
  if (Number.isFinite(reset) && reset > 0) {
    candidates.push(reset < 1_000_000_000_000 ? reset * 1000 : reset);
  }
  const maxRetryMs = Math.max(retryDelayMs, maxExternalRetryMs);
  return Math.min(Math.max(...candidates), nowMs + maxRetryMs);
}

function sameValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
