#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { randomUUID } from "node:crypto";
import {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  DEFAULT_MAX_PENDING_CLAIMS,
  DEFAULT_MAX_REJECTION_TOMBSTONES,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  applyProjectionResults,
  buildHandleProjectionWrites,
  pendingClaimsForHandle,
  projectionHandleIsDue,
} from "./projection-state.js";
import {
  isOlderKind0,
  kind0ProfileMetadata,
  mergeProfileMetadata,
} from "./handle-state.js";
import {
  PROJECTION_KIND0_RELAY_LIMIT,
  fetchKind0s,
  metadataFromKind0,
  relaysForKind0Lookup,
} from "./kind0.js";
import {
  buildRunSummaryWrite,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  DEFAULT_COLLECTIONS,
  finishRunMetrics,
  firestoreConfigFromEnv,
  loadRelaysFromFile,
  logRunSummary,
  runMain,
  writeJson,
} from "./runtime.js";
import {
  discoverXBioIdentities,
  verifyTweetCandidate,
} from "./x-identity.js";
import { fetchPublicHttps } from "./public-network.js";
import {
  flushRelayHealth,
  refreshProfiles,
  runDueProfilePass,
} from "./profile-store.js";
import { mergeRelayHints } from "./relay-hints.js";
import {
  isHexPubkey,
  isPublicHostname,
  normalizeTwitterHandle,
  numberFromEnv,
} from "./utils.js";

export function loadProjectionConfig(env = process.env) {
  const args = {
    ...firestoreConfigFromEnv(env),
    out: env.PROJECTION_OUT || null,
    timeoutMs: numberFromEnv(env, "PROJECTION_TIMEOUT_MS", 12000),
    maxProofs: numberFromEnv(env, "MAX_PROOFS", 250),
    verifyTweets: env.VERIFY_TWEETS !== "0",
    checkZaps: env.CHECK_ZAPS !== "0",
    projectionLimit: numberFromEnv(env, "PROJECTION_LIMIT", 1000),
    projectionExternalRetryMs: numberFromEnv(
      env,
      "PROJECTION_EXTERNAL_RETRY_MS",
      15 * 60 * 1000,
    ),
    runDeadlineMs: numberFromEnv(env, "PROJECTION_RUN_DEADLINE_MS", 0),
    maxPendingClaims: numberFromEnv(
      env,
      "MAX_PENDING_CLAIMS",
      DEFAULT_MAX_PENDING_CLAIMS,
    ),
    maxInactiveVerifiedClaims: numberFromEnv(
      env,
      "MAX_INACTIVE_VERIFIED_CLAIMS",
      DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
    ),
    maxRejectionTombstones: numberFromEnv(
      env,
      "MAX_REJECTION_TOMBSTONES",
      DEFAULT_MAX_REJECTION_TOMBSTONES,
    ),
    maxRetryAttempts: numberFromEnv(
      env,
      "MAX_RETRY_ATTEMPTS",
      DEFAULT_MAX_RETRY_ATTEMPTS,
    ),
    relays: projectionRelays(env),
    profileLookup: true,
    profileRefresh: true,
    profileRefreshLimit: numberFromEnv(env, "PROFILE_REFRESH_LIMIT", 40),
    profileScanLimit: numberFromEnv(env, "PROFILE_SCAN_LIMIT", 500),
  };
  validateProjectionArgs(args);
  return args;
}

function validateProjectionArgs(args) {
  if (!args.firestoreProject) {
    throw new Error("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("PROJECTION_TIMEOUT_MS must be positive.");
  }
  if (!Number.isInteger(args.maxProofs) || args.maxProofs < 0) {
    throw new Error("MAX_PROOFS must be an integer >= 0.");
  }
  if (!Number.isInteger(args.projectionLimit) || args.projectionLimit <= 0) {
    throw new Error("PROJECTION_LIMIT must be a positive integer.");
  }
  if (
    !Number.isFinite(args.projectionExternalRetryMs) ||
    args.projectionExternalRetryMs <= 0
  ) {
    throw new Error("PROJECTION_EXTERNAL_RETRY_MS must be positive.");
  }
  if (!Number.isInteger(args.runDeadlineMs) || args.runDeadlineMs < 0) {
    throw new Error("PROJECTION_RUN_DEADLINE_MS must be an integer >= 0.");
  }
  for (const [name, value] of [
    ["MAX_PENDING_CLAIMS", args.maxPendingClaims],
    ["MAX_INACTIVE_VERIFIED_CLAIMS", args.maxInactiveVerifiedClaims],
    ["MAX_REJECTION_TOMBSTONES", args.maxRejectionTombstones],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be an integer >= 0.`);
    }
  }
  if (!Number.isInteger(args.maxRetryAttempts) || args.maxRetryAttempts <= 0) {
    throw new Error("MAX_RETRY_ATTEMPTS must be a positive integer.");
  }
}

function projectionRelays(env) {
  const configured = String(env.RELAYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  if (env.RELAYS === "") return [];
  try {
    return loadRelaysFromFile(env.RELAYS_FILE || undefined);
  } catch {
    return [];
  }
}

export const PROJECTION_LEASE_DOC_ID = "lease";
export const PROJECTION_LEASE_MS = 10 * 60 * 1000;

export function projectionLeaseIsCurrent(data, nowMs) {
  const until = Date.parse(data?.until || "");
  return Boolean(data?.token) && Number.isFinite(until) && until > nowMs;
}

/** Renew only while this run still owns the token, including after its expiry. */
export function renewedProjectionLease(data, lease, nowMs) {
  if (!lease?.token || data?.token !== lease.token) {
    throw new Error("projection-lease-lost");
  }
  return {
    owner: lease.owner,
    token: lease.token,
    until: new Date(nowMs + lease.leaseMs).toISOString(),
  };
}

function projectionLeaseRef(db, args) {
  return db
    .collection(
      args.firestoreProjectionRunsCollection || DEFAULT_COLLECTIONS.projectionRuns,
    )
    .doc(PROJECTION_LEASE_DOC_ID);
}

export async function acquireProjectionLease(db, args, options = {}) {
  const now = options.now || Date.now;
  const lease = {
    owner: "projection",
    token: `projection:${randomUUID()}`,
    leaseMs: options.leaseMs ?? PROJECTION_LEASE_MS,
  };
  const acquired = await db.runTransaction(async (tx) => {
    const ref = projectionLeaseRef(db, args);
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    if (projectionLeaseIsCurrent(data, now()) && data.token !== lease.token) return false;
    tx.set(
      ref,
      {
        owner: lease.owner,
        token: lease.token,
        until: new Date(now() + lease.leaseMs).toISOString(),
      },
      { merge: true },
    );
    return true;
  });
  return acquired ? lease : null;
}

export async function renewProjectionLease(db, args, lease, options = {}) {
  const now = options.now || Date.now;
  try {
    return await db.runTransaction(async (tx) => {
      const ref = projectionLeaseRef(db, args);
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      tx.set(ref, renewedProjectionLease(data, lease, now()), { merge: true });
      return true;
    });
  } catch (error) {
    if (error?.message === "projection-lease-lost") return false;
    throw error;
  }
}

export async function releaseProjectionLease(db, args, lease) {
  await db.runTransaction(async (tx) => {
    const ref = projectionLeaseRef(db, args);
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.token === lease.token) {
      tx.set(ref, { owner: null, token: null, until: null }, { merge: true });
    }
  });
}

export async function runProjection(args, FirestoreCtor, dependencies = {}) {
  const runMetrics = createRunMetrics("projection");
  const db =
    dependencies.db ?? (await createFirestore(args, FirestoreCtor));
  const leaseNow = dependencies.leaseNow || Date.now;
  const lease = await acquireProjectionLease(db, args, { now: leaseNow });
  if (!lease) {
    logProjectionEvent("projection_run_skipped", { reason: "lease-held" });
    return { skipped: true, stats: { stoppedReason: "lease-held" } };
  }
  const touchLease = async () => {
    const renewed = await renewProjectionLease(db, args, lease, { now: leaseNow });
    if (!renewed) throw new Error("projection-lease-lost");
  };
  const readLease = async (tx) => {
    const ref = projectionLeaseRef(db, args);
    const snap = await tx.get(ref);
    return {
      ref,
      data: renewedProjectionLease(
        snap.exists ? snap.data() || {} : {},
        lease,
        leaseNow(),
      ),
    };
  };
  try {
    return await executeProjection(
      db,
      args,
      dependencies,
      runMetrics,
      lease,
      leaseNow,
      touchLease,
      readLease,
    );
  } finally {
    await releaseProjectionLease(db, args, lease);
  }
}

async function executeProjection(
  db,
  args,
  dependencies,
  runMetrics,
  lease,
  leaseNow,
  touchLease,
  readLease,
) {
  const verifyClaims = dependencies.verifyHandleClaims || verifyHandleClaims;
  const now = dependencies.now || Date.now;
  const [handleDocs, pendingHandleCount] = await Promise.all([
    readPendingHandleDocs(db, args),
    countPendingHandleDocs(db, args),
  ]);
  const stats = {
    handleDocsRead: handleDocs.length,
    pendingHandleCount,
    projectionLimitSaturated: handleDocs.length >= args.projectionLimit,
    handlesDue: 0,
    handlesSkippedNotDue: 0,
    handlesChanged: 0,
    claimsConsidered: 0,
    proofTweetsAttempted: 0,
    xProfilesAttempted: 0,
    xProfilesFailed: 0,
    xProfileFailures: {},
    xBioIdentifiersResolved: 0,
    verified: 0,
    rejected: 0,
    retryLater: 0,
    handlesDeferred: 0,
    deferReasons: {},
    pendingDropped: 0,
    firestoreWrites: 0,
    profilesRefreshed: 0,
    profilesScanned: 0,
    stoppedReason: null,
  };
  const verifiedProfiles = [];
  let proofsRemaining = args.maxProofs === 0 ? Infinity : args.maxProofs;
  const deadlineAt =
    args.runDeadlineMs > 0 ? now() + args.runDeadlineMs : Infinity;

  logProjectionEvent("projection_run_begin", {
    handleDocsRead: handleDocs.length,
    pendingHandleCount: stats.pendingHandleCount,
    projectionLimitSaturated: stats.projectionLimitSaturated,
    projectionLimit: args.projectionLimit,
    maxProofs: args.maxProofs,
    runDeadlineMs: args.runDeadlineMs,
    checkZaps: args.checkZaps,
    verifyTweets: args.verifyTweets,
  });

  for (const handleDoc of handleDocs) {
    if (now() >= deadlineAt) {
      stats.stoppedReason = "run_deadline_reached";
      logProjectionEvent("projection_run_stopped", {
        reason: stats.stoppedReason,
        handlesDue: stats.handlesDue,
        handlesChanged: stats.handlesChanged,
      });
      break;
    }
    try {
      await touchLease();
    } catch (error) {
      if (error?.message !== "projection-lease-lost") throw error;
      stats.stoppedReason = "lease-lost";
      logProjectionEvent("projection_run_stopped", {
        reason: stats.stoppedReason,
        handlesDue: stats.handlesDue,
        handlesChanged: stats.handlesChanged,
      });
      break;
    }
    if (!projectionHandleIsDue(handleDoc.data)) {
      stats.handlesSkippedNotDue += 1;
      continue;
    }
    stats.handlesDue += 1;

    const handle = handleDoc.data?.handle || null;
    const pending = pendingClaimsForHandle(handleDoc.data);
    const handleStartedMs = now();
    logProjectionEvent("projection_handle_begin", {
      handleDocId: handleDoc.id,
      handle,
      handlesDueIndex: stats.handlesDue,
      pendingClaimCount: pending.length,
      projectionStatus: handleDoc.data?.projectionStatus || null,
      nextAttemptAt: timestampForLog(handleDoc.data?.nextAttemptAt),
      activePubkey: handleDoc.data?.activeIdentity?.pubkey || null,
      pendingClaims: pending.map(summarizePendingClaimForLog),
      proofsRemaining:
        proofsRemaining === Infinity ? null : proofsRemaining,
    });

    const verification = await verifyClaims(handleDoc.data, args, {
      proofsRemaining,
    });
    proofsRemaining -= verification.proofTweetsAttempted;
    stats.claimsConsidered += verification.claimsConsidered;
    stats.proofTweetsAttempted += verification.proofTweetsAttempted;
    stats.xProfilesAttempted += verification.xProfilesAttempted;
    stats.xProfilesFailed += verification.xProfilesFailed || 0;
    mergeFailureCounts(
      stats.xProfileFailures,
      verification.xProfileFailures,
    );
    stats.xBioIdentifiersResolved += verification.xBioIdentifiersResolved;

    const projectionOptions = {
      retryDelayMs: args.projectionExternalRetryMs,
      maxPendingClaims: args.maxPendingClaims,
      maxInactiveVerifiedClaims: args.maxInactiveVerifiedClaims,
      maxRejectionTombstones: args.maxRejectionTombstones,
      maxRetryAttempts: args.maxRetryAttempts,
      deferReason: verification.deferReason,
      attemptedClaimIds: verification.attemptedClaimIds,
    };
    let transition = applyProjectionResults(
      handleDoc.data,
      verification.results,
      projectionOptions,
    );
    let writes = buildHandleProjectionWrites(handleDoc, transition, args);
    if (writes.length) {
      let committed;
      try {
        committed = await db.runTransaction(async (tx) => {
          const leaseRef = projectionLeaseRef(db, args);
          const leaseSnap = await tx.get(leaseRef);
          const ref = db.collection(args.firestoreHandlesCollection).doc(handleDoc.id);
          const snap = await tx.get(ref);
          tx.set(
            leaseRef,
            renewedProjectionLease(
              leaseSnap.exists ? leaseSnap.data() || {} : {},
              lease,
              leaseNow(),
            ),
            { merge: true },
          );
          const fresh = snap.exists ? snap.data() || {} : {};
          const freshTransition = applyProjectionResults(
            fresh,
            verification.results,
            projectionOptions,
          );
          const freshWrites = buildHandleProjectionWrites(
            handleDoc,
            freshTransition,
            args,
          );
          for (const write of freshWrites) {
            tx.set(db.collection(write.collection).doc(write.id), write.data, {
              merge: true,
            });
          }
          return { writes: freshWrites, transition: freshTransition };
        });
      } catch (error) {
        if (error?.message !== "projection-lease-lost") throw error;
        stats.stoppedReason = "lease-lost";
        logProjectionEvent("projection_run_stopped", {
          reason: stats.stoppedReason,
          handleDocId: handleDoc.id,
          handle,
          handlesDue: stats.handlesDue,
          handlesChanged: stats.handlesChanged,
        });
        break;
      }
      writes = committed.writes;
      transition = committed.transition;
      if (writes.length) {
        stats.firestoreWrites += writes.length;
        stats.handlesChanged += 1;
        stats.verified += transition.stats.verified;
        stats.rejected += transition.stats.rejected;
        stats.retryLater += transition.stats.retryLater;
        stats.pendingDropped += transition.stats.pendingDropped;
      }
    }

    const deferredPendingClaim =
      transition.state.projectionStatus === "retry_later"
        ? transition.state.claims.find((claim) => claim.status === "pending")
        : null;
    const deferredReason = deferredPendingClaim
      ? verification.deferReason || deferredPendingClaim.retryReason || "unknown"
      : null;
    if (deferredReason) {
      stats.handlesDeferred += 1;
      stats.deferReasons[deferredReason] =
        (stats.deferReasons[deferredReason] || 0) + 1;
    }

    logProjectionEvent("projection_handle_result", {
      handleDocId: handleDoc.id,
      handle,
      durationMs: Math.max(0, now() - handleStartedMs),
      changed: transition.changed,
      deferredReason,
      activeChanged: transition.activeChanged,
      firestoreWrites: writes.length,
      writeTargets: writes.map((write) => ({
        collection: write.collection,
        id: write.id,
      })),
      verification: {
        claimsConsidered: verification.claimsConsidered,
        proofTweetsAttempted: verification.proofTweetsAttempted,
        xProfilesAttempted: verification.xProfilesAttempted,
        xProfilesFailed: verification.xProfilesFailed || 0,
        xProfileFailures: verification.xProfileFailures || {},
        xBioIdentifiersResolved: verification.xBioIdentifiersResolved,
        stopRun: verification.stopRun,
        stoppedReason: verification.stoppedReason,
      },
      results: (verification.results || []).map(summarizeResultForLog),
      transition: {
        verified: transition.stats.verified,
        rejected: transition.stats.rejected,
        retryLater: transition.stats.retryLater,
        pendingDropped: transition.stats.pendingDropped,
        projectionStatus: transition.state.projectionStatus,
        pendingClaimCount: transition.state.pendingClaimCount,
        nextAttemptAt: timestampForLog(transition.state.nextAttemptAt),
        activePubkey: transition.state.activeIdentity?.pubkey || null,
        activeClaimId: transition.state.activeIdentity?.claimId || null,
      },
    });

    if (args.profileRefresh === true) {
      collectVerifiedProfiles(verifiedProfiles, handleDoc, verification.results);
    }

    if (verification.stopRun) {
      stats.stoppedReason = verification.stoppedReason;
      logProjectionEvent("projection_run_stopped", {
        reason: stats.stoppedReason,
        handleDocId: handleDoc.id,
        handle,
        handlesDue: stats.handlesDue,
        handlesChanged: stats.handlesChanged,
      });
      break;
    }
  }

  if (args.profileRefresh === true && stats.stoppedReason !== "lease-lost") {
    let profileStats;
    try {
      profileStats = await refreshProjectionProfiles(
        db,
        args,
        verifiedProfiles,
        now,
        { touchLease, readLease },
      );
    } catch (error) {
      if (error?.message !== "projection-lease-lost") throw error;
      stats.stoppedReason = "lease-lost";
      profileStats = { refreshed: 0, scanned: 0, writes: 0 };
    }
    stats.profilesRefreshed = profileStats.refreshed;
    stats.profilesScanned = profileStats.scanned;
    stats.firestoreWrites += profileStats.writes;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    mode: "projection",
    source: "directory-handle-claims",
    firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      handlesCollection: args.firestoreHandlesCollection,
    },
    controls: {
      projectionLimit: args.projectionLimit,
      maxProofs: args.maxProofs,
      scanXProfiles: true,
      runDeadlineMs: args.runDeadlineMs,
    },
    stats,
  };
  output.run = finishRunMetrics(runMetrics, stats);
  logRunSummary(output.run);
  if (stats.stoppedReason !== "lease-lost") await persistRunSummary(db, output, args);
  if (args.out) await writeJson(args.out, output);
  printProjectionSummary(output, args);
  return output;
}

function collectVerifiedProfiles(targets, handleDoc, results) {
  for (const result of results || []) {
    if (result?.identityStatus !== "verified") continue;
    const pubkey = String(
      result.pubkey || result.claim?.pubkey || "",
    ).toLowerCase();
    if (!isHexPubkey(pubkey)) continue;
    targets.push({
      pubkey,
      hints: mergeRelayHints(result.relayHints, result.claim?.relayHints),
      handleId: handleDoc.id,
      handle: handleDoc.data?.handle || result.handle,
      role: "directory",
    });
  }
}

async function refreshProjectionProfiles(db, args, verifiedProfiles, now, leaseOptions = {}) {
  const health = new Map();
  const nowMs = now();
  let refreshed = 0;
  let writes = 0;
  if (verifiedProfiles.length) {
    const immediate = await refreshProfiles(db, verifiedProfiles, {
      health,
      nowMs,
      timeoutMs: args.timeoutMs,
      fetchImpl: args.fetchImpl,
      handlesCollection: args.firestoreHandlesCollection,
      flushHealth: false,
      ...leaseOptions,
    });
    refreshed += immediate.refreshed;
    writes += immediate.refreshed + immediate.handlesChanged;
  }
  const due = await runDueProfilePass(db, args, {
    health,
    nowMs,
    timeoutMs: args.timeoutMs,
    fetchImpl: args.fetchImpl,
    skipPubkeys: new Set(verifiedProfiles.map((target) => target.pubkey)),
    ...leaseOptions,
  });
  refreshed += due.refreshed;
  writes += due.refreshed + due.handlesChanged + 1;
  const healthWrites = await flushRelayHealth(db, health, leaseOptions);
  return {
    refreshed,
    scanned: due.scanned,
    writes: writes + healthWrites,
  };
}

/** Best-effort: run summaries aid debugging but must not fail a healthy run. */
async function persistRunSummary(db, output, args) {
  try {
    await commitFirestoreWrites(db, [
      buildRunSummaryWrite(
        output.run,
        output,
        args.firestoreProjectionRunsCollection ||
          DEFAULT_COLLECTIONS.projectionRuns,
      ),
    ]);
  } catch (error) {
    console.warn(
      `Projection run summary write failed: ${error?.message || error}`,
    );
  }
}

export async function verifyHandleClaims(handleData, args, limits = {}) {
  const pending = pendingClaimsForHandle(handleData);
  const fetchImpl = args.fetchImpl || fetchPublicHttps;
  const results = [];
  const completedClaimIds = new Set();
  const attemptedClaimIds = new Set();
  let proofTweetsAttempted = 0;
  let xProfilesAttempted = 0;
  let xProfilesFailed = 0;
  let xProfileFailures = {};
  let xBioIdentifiersResolved = 0;
  let stopRun = false;
  let stoppedReason = null;
  let deferReason = null;
  const proofsRemaining = limits.proofsRemaining ?? Infinity;

  if (pending.length > 0) {
    const bioDiscovery = await discoverXBioIdentities({
      handleSeeds: pending,
      additionalHandles: [],
      timeoutMs: args.timeoutMs,
      maxProfiles: 1,
      fetchImpl,
    });
    xProfilesAttempted = bioDiscovery.profilesAttempted;
    xProfilesFailed = bioDiscovery.profilesFailed;
    xProfileFailures = bioDiscovery.profileFailures;
    xBioIdentifiersResolved = bioDiscovery.identifiersResolved;
    const distinctBioPubkeys = new Set(
      bioDiscovery.records.map((record) => record.pubkey),
    );
    for (const record of bioDiscovery.records) {
      const existing = findClaimForBioRecord(handleData, record);
      if (!existing && distinctBioPubkeys.size !== 1) continue;
      const claim = existing || syntheticBioClaim(handleData, record);
      let verified = await enrichVerifiedResult(
        {
          ...record,
          claimId: claim.claimId,
          claim: existing ? undefined : claim,
          proofPublishedAt: Math.floor(Date.now() / 1000),
        },
        claim.metadata,
        args,
      );
      if (record.xAvatarUrl) {
        verified = {
          ...verified,
          metadata: mergeProfileMetadata(verified.metadata || claim.metadata, {
            xPicture: record.xAvatarUrl,
          }),
        };
      }
      if (record.relayHints?.length) {
        verified = { ...verified, relayHints: record.relayHints };
      }
      results.push(verified);
      completedClaimIds.add(claim.claimId);
    }
    const normalizedHandle = normalizeTwitterHandle(handleData?.handle);
    if (bioDiscovery.checkedHandles?.includes(normalizedHandle)) {
      for (const claim of pending) {
        if (completedClaimIds.has(claim.claimId) || claim.proofTweetId)
          continue;
        results.push({
          claimId: claim.claimId,
          identityStatus: "rejected",
          rejectionReason: "x_bio_does_not_link_claimed_pubkey",
        });
        completedClaimIds.add(claim.claimId);
      }
    }
    const profileFailure = bioDiscovery.failedHandles?.[normalizedHandle];
    if (profileFailure) deferReason = profileFailure.reason;
    // Only a missing profile is terminal. Other failures (including
    // non-retryable 4xx like 403, which can mean suspended or blocked rather
    // than deleted) defer and count toward the retry cap instead.
    const profileMissing =
      profileFailure?.reason === "http_404" ||
      profileFailure?.reason === "profile_unavailable";
    if (profileFailure && !profileMissing) {
      // The profile fetch was attempted and failed. Count the attempt only
      // for proofless claims, which the bio path decides; proof claims are
      // marked attempted when their tweet check starts.
      for (const claim of pending) {
        if (!claim.proofTweetId) attemptedClaimIds.add(claim.claimId);
      }
    }
    if (profileMissing) {
      // A missing X profile is terminal for proofless claims. Claims with a
      // proof tweet still fall through to the tweet check below.
      for (const claim of pending) {
        if (completedClaimIds.has(claim.claimId) || claim.proofTweetId)
          continue;
        results.push({
          claimId: claim.claimId,
          identityStatus: "rejected",
          rejectionReason: "x_profile_not_found",
        });
        completedClaimIds.add(claim.claimId);
      }
    }
    if (bioDiscovery.stoppedReason === "x_rate_limited") {
      stopRun = true;
      stoppedReason = "x_rate_limited";
      deferReason = deferReason || "x_rate_limited";
      for (const claim of pending) {
        if (!claim.proofTweetId) attemptedClaimIds.add(claim.claimId);
      }
    }
  }

  const kind0Metadata =
    args.verifyTweets && !stopRun
      ? await kind0MetadataByPubkey(pending, args)
      : new Map();

  if (args.verifyTweets && !stopRun) {
    for (const claim of pending) {
      if (completedClaimIds.has(claim.claimId) || !claim.proofTweetId) continue;
      if (proofTweetsAttempted >= proofsRemaining) break;
      proofTweetsAttempted += 1;
      attemptedClaimIds.add(claim.claimId);
      let result = await verifyTweetCandidate(claim, args.timeoutMs, {
        fetchImpl,
      });
      if (result.identityStatus === "verified") {
        let metadata = claim.metadata;
        const profile = kind0Metadata.get(
          String(claim.pubkey || "").toLowerCase(),
        );
        if (
          profile?.fields &&
          !isOlderKind0(claim.kind0CreatedAt, profile.createdAt)
        ) {
          metadata = mergeProfileMetadata(claim.metadata, profile.fields);
          if (profile.createdAt != null) {
            result = { ...result, kind0CreatedAt: profile.createdAt };
          }
        }
        if (metadata) result = { ...result, metadata };
        result = await enrichVerifiedResult(
          result,
          metadata || claim.metadata,
          args,
        );
      }
      results.push({ ...result, claimId: claim.claimId });
      if (result.identityStatus === "retry_later") {
        // The proof check is the freshest deferral cause for this handle.
        deferReason =
          result.retryReason || "temporary_verification_failure";
      }
      completedClaimIds.add(claim.claimId);
      if (result.retryRateLimited) {
        stopRun = true;
        stoppedReason = result.retryReason || "x_rate_limited";
        break;
      }
    }
  }

  if (!deferReason && !stopRun) {
    const uncheckedProofClaim = pending.find(
      (claim) => claim.proofTweetId && !completedClaimIds.has(claim.claimId),
    );
    if (uncheckedProofClaim) {
      deferReason = args.verifyTweets
        ? "proof_budget_exhausted"
        : "tweet_verification_disabled";
    }
  }

  return {
    results,
    claimsConsidered: pending.length,
    proofTweetsAttempted,
    xProfilesAttempted,
    xProfilesFailed,
    xProfileFailures,
    xBioIdentifiersResolved,
    stopRun,
    stoppedReason,
    deferReason,
    attemptedClaimIds: [...attemptedClaimIds],
  };
}

async function kind0MetadataByPubkey(claims, args) {
  // Production refreshes the signed profile after verification and rebuilds
  // listing metadata there, so this lookup does not open a second set of sockets.
  if (args?.profileRefresh === true) return new Map();
  const pubkeys = [
    ...new Set(
      (claims || [])
        .filter((claim) => claim?.proofTweetId && isHexPubkey(claim.pubkey))
        .map((claim) => String(claim.pubkey).toLowerCase()),
    ),
  ];
  if (!pubkeys.length) return new Map();
  if (typeof args?.fetchKind0s !== "function" && !args?.relays?.length) {
    return new Map();
  }
  try {
    const loadKind0s = args.fetchKind0s || fetchKind0s;
    const relays = relaysForKind0Lookup(
      args.relays || [],
      PROJECTION_KIND0_RELAY_LIMIT,
    );
    const profiles = await loadKind0s(pubkeys, relays, { newest: true });
    const metadata = new Map();
    for (const pubkey of pubkeys) {
      const event = profiles?.get?.(pubkey)?.event;
      if (!event || String(event.pubkey || "").toLowerCase() !== pubkey) {
        continue;
      }
      const fields = kind0ProfileMetadata(pubkey, metadataFromKind0(event));
      const createdAt = Number(event.created_at);
      if (fields) {
        metadata.set(pubkey, {
          fields,
          createdAt: Number.isFinite(createdAt) ? createdAt : null,
        });
      }
    }
    return metadata;
  } catch (error) {
    console.warn(`Kind-0 metadata lookup failed: ${error?.message || error}`);
    return new Map();
  }
}

async function enrichVerifiedResult(result, metadata, args) {
  if (!args.checkZaps) {
    return { ...result, zapReason: "zap-check-skipped" };
  }
  return checkZapSupport(result, metadata || {}, args.timeoutMs);
}

function mergeFailureCounts(target, additions = {}) {
  for (const [reason, count] of Object.entries(additions || {})) {
    target[reason] = (target[reason] || 0) + Number(count || 0);
  }
}

function findClaimForBioRecord(handleData, record) {
  return (
    pendingClaimsForHandle(handleData).find(
      (claim) => claim.pubkey === record.pubkey,
    ) ||
    (handleData?.claims || []).find(
      (claim) =>
        claim?.status !== "rejected" && claim?.pubkey === record.pubkey,
    )
  );
}

function syntheticBioClaim(handleData, record, now = new Date()) {
  return {
    claimId: `x-bio:${record.handle}:${record.pubkey}`,
    platform: "twitter",
    handle: record.handle || handleData?.handle,
    pubkey: record.pubkey,
    npub: record.npub,
    sources: ["x_profile.bio"],
    status: "verified",
    sourceCreatedAt: Math.floor(now.getTime() / 1000),
    discoveredAt: now.toISOString(),
  };
}

/** Best-effort queue depth; a failed count must not fail a healthy run. */
async function countPendingHandleDocs(db, args) {
  try {
    const snapshot = await db
      .collection(args.firestoreHandlesCollection)
      .where("pendingClaimCount", ">", 0)
      .count()
      .get();
    const count = snapshot.data()?.count;
    return Number.isInteger(count) ? count : null;
  } catch (error) {
    console.warn(`Pending handle count failed: ${error?.message || error}`);
    return null;
  }
}

async function readPendingHandleDocs(db, args) {
  const collection = db.collection(args.firestoreHandlesCollection);
  const limit = args.projectionLimit;
  const orderedSnap = await collection
    .where("pendingClaimCount", ">", 0)
    .orderBy("nextAttemptAt")
    .limit(limit)
    .get();

  // Docs missing nextAttemptAt are excluded from orderBy; surface them via an
  // unordered pending query so legacy backfill rows can be healed.
  const unorderedSnap = await collection
    .where("pendingClaimCount", ">", 0)
    .limit(limit)
    .get();

  const merged = [];
  const seen = new Set();
  for (const doc of unorderedSnap.docs) {
    const data = doc.data() || {};
    if (data.nextAttemptAt != null) continue;
    merged.push({ id: doc.id, data });
    seen.add(doc.id);
    if (merged.length >= limit) return merged;
  }
  for (const doc of orderedSnap.docs) {
    if (seen.has(doc.id)) continue;
    merged.push({ id: doc.id, data: doc.data() || {} });
    seen.add(doc.id);
    if (merged.length >= limit) break;
  }
  return merged;
}

export async function checkZapSupport(
  result,
  metadata,
  timeoutMs,
  fetchImpl = fetchPublicHttps,
) {
  const zapCheckedAt = new Date().toISOString();
  const lightningAddress = metadata?.lud16 || null;
  if (!lightningAddress) {
    return {
      ...result,
      lud16: null,
      zappable: false,
      zapReason: "missing-lud16",
      zapCheckedAt,
      zapCheckTransient: false,
    };
  }
  const lnurlp = lightningAddressToLnurlp(lightningAddress);
  if (!lnurlp) {
    return {
      ...result,
      lud16: lightningAddress,
      zappable: false,
      zapReason: "invalid-lud16",
      zapCheckedAt,
      zapCheckTransient: false,
    };
  }
  try {
    const response = await fetchImpl(lnurlp, {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return {
        ...result,
        lud16: lightningAddress,
        lnurlp,
        zappable: false,
        zapReason: `lnurl-http-${response.status}`,
        zapCheckedAt,
        zapCheckTransient: response.status === 429 || response.status >= 500,
      };
    }
    const json = await response.json();
    const zappable = json.allowsNostr === true && isHexPubkey(json.nostrPubkey);
    return {
      ...result,
      lud16: lightningAddress,
      lnurlp,
      zappable,
      zapReason: zappable ? "nip57-ready" : "lnurl-does-not-allow-nostr",
      lnurlAllowsNostr: json.allowsNostr === true,
      lnurlNostrPubkey: isHexPubkey(json.nostrPubkey) ? json.nostrPubkey : null,
      zapCheckedAt,
      zapCheckTransient: false,
    };
  } catch {
    return {
      ...result,
      lud16: lightningAddress,
      lnurlp,
      zappable: false,
      zapReason: "lnurl-fetch-failed",
      zapCheckedAt,
      zapCheckTransient: true,
    };
  }
}

export function lightningAddressToLnurlp(lud16) {
  const parts = String(lud16 || "")
    .trim()
    .split("@");
  const localName = parts[0];
  const hostname = parts[1]?.toLowerCase();
  if (
    parts.length !== 2 ||
    !/^[a-z0-9._-]+$/i.test(localName) ||
    localName === "." ||
    localName === ".." ||
    !isPublicHostname(hostname)
  ) {
    return null;
  }
  return `https://${hostname}/.well-known/lnurlp/${encodeURIComponent(localName)}`;
}

function printProjectionSummary(output, args) {
  console.log("\nDirectory projection complete.");
  console.log(`  handle docs read:     ${output.stats.handleDocsRead}`);
  console.log(
    `  pending handles:      ${output.stats.pendingHandleCount}${
      output.stats.projectionLimitSaturated ? " (limit saturated)" : ""
    }`,
  );
  console.log(`  handles due:          ${output.stats.handlesDue}`);
  console.log(
    `  handles skipped:      ${output.stats.handlesSkippedNotDue || 0}`,
  );
  console.log(`  handles changed:      ${output.stats.handlesChanged}`);
  console.log(`  proof tweets checked: ${output.stats.proofTweetsAttempted}`);
  console.log(`  X profiles scanned:   ${output.stats.xProfilesAttempted}`);
  console.log(`  X profile failures:   ${output.stats.xProfilesFailed}`);
  console.log(
    `  X bio ids resolved:   ${output.stats.xBioIdentifiersResolved}`,
  );
  console.log(`  verified:             ${output.stats.verified}`);
  console.log(`  profiles refreshed:   ${output.stats.profilesRefreshed || 0}`);
  console.log(`  profiles scanned:     ${output.stats.profilesScanned || 0}`);
  console.log(`  rejected:             ${output.stats.rejected}`);
  console.log(`  retry later:          ${output.stats.retryLater}`);
  console.log(`  handles deferred:     ${output.stats.handlesDeferred}`);
  console.log(`  pending dropped:      ${output.stats.pendingDropped}`);
  console.log(`  Firestore writes:     ${output.stats.firestoreWrites}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  if (output.stats.stoppedReason) {
    console.log(`  stopped reason:       ${output.stats.stoppedReason}`);
  }
  if (args.out) console.log(`  output:               ${args.out}`);
}

// Cloud Run's log list shows jsonPayload.message only. Handle events put the
// scan line there; `event` stays the stable name for log queries.
function logProjectionEvent(event, fields = {}) {
  const details = { ...fields };
  delete details.message;
  const entry = {
    event,
    module: "projection",
    ...details,
  };
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: projectionEventMessage(event, entry),
      ...entry,
    }),
  );
}

function projectionEventMessage(event, fields) {
  if (event === "projection_handle_begin") {
    return formatHandleBeginMessage(fields);
  }
  if (event === "projection_handle_result") {
    return formatHandleResultMessage(fields);
  }
  return event;
}

function formatHandleBeginMessage(fields) {
  const parts = [
    "projection_handle_begin",
    `handle=${logToken(fields.handle)}`,
    `index=${fields.handlesDueIndex}`,
    `pending=${fields.pendingClaimCount}`,
    `withProof=${countClaimsWithProof(fields.pendingClaims)}`,
    `status=${logToken(fields.projectionStatus)}`,
  ];
  const pubkeys = formatPubkeyPrefixes(fields.pendingClaims);
  if (pubkeys) parts.push(`pubkeys=${pubkeys}`);
  if (fields.activePubkey) {
    parts.push(`active=${logToken(String(fields.activePubkey).slice(0, 8))}`);
  }
  if (fields.proofsRemaining != null) {
    parts.push(`proofsLeft=${fields.proofsRemaining}`);
  }
  return parts.join(" ");
}

function formatHandleResultMessage(fields) {
  const transition = fields.transition || {};
  const verification = fields.verification || {};
  const parts = [
    "projection_handle_result",
    `handle=${logToken(fields.handle)}`,
    `durationMs=${fields.durationMs}`,
    `changed=${fields.changed === true}`,
    `writes=${fields.firestoreWrites}`,
    `verified=${transition.verified ?? 0}`,
    `rejected=${transition.rejected ?? 0}`,
    `retryLater=${transition.retryLater ?? 0}`,
    `status=${logToken(transition.projectionStatus)}`,
    `xFailed=${verification.xProfilesFailed || 0}`,
  ];
  if (transition.pendingDropped) {
    parts.push(`pendingDropped=${transition.pendingDropped}`);
  }
  if (fields.activeChanged) parts.push("activeChanged=true");
  if (verification.xBioIdentifiersResolved) {
    parts.push(`bioIds=${verification.xBioIdentifiersResolved}`);
  }
  if (fields.deferredReason) {
    parts.push(`defer=${logToken(fields.deferredReason)}`);
  }
  const xFail = formatCountMap(verification.xProfileFailures);
  if (xFail) parts.push(`xFail=${xFail}`);
  const outcomes = formatResultOutcomes(fields.results);
  if (outcomes) parts.push(`outcomes=${outcomes}`);
  if (verification.stoppedReason) {
    parts.push(`stopped=${logToken(verification.stoppedReason)}`);
  }
  return parts.join(" ");
}

function countClaimsWithProof(claims) {
  return (claims || []).filter((claim) => claim?.proofTweetId).length;
}

function formatPubkeyPrefixes(claims) {
  const prefixes = (claims || [])
    .map((claim) => claim?.pubkey)
    .filter(Boolean)
    .map((pubkey) => String(pubkey).slice(0, 8));
  if (!prefixes.length) return "";
  const shown = prefixes.slice(0, 3).map((prefix) => logToken(prefix));
  const extra = prefixes.length - shown.length;
  return extra > 0 ? `${shown.join(",")} +${extra}` : shown.join(",");
}

function formatResultOutcomes(results) {
  const counts = {};
  for (const result of results || []) {
    const status = result.identityStatus || "unknown";
    const reason =
      result.rejectionReason ||
      result.retryReason ||
      result.verificationMethod ||
      "";
    const key = reason ? `${status}:${reason}` : status;
    counts[key] = (counts[key] || 0) + 1;
  }
  return formatCountMap(counts);
}

function formatCountMap(counts) {
  return Object.entries(counts || {})
    .filter(([, count]) => count)
    .map(([key, count]) =>
      count > 1 ? `${logToken(key)}*${count}` : logToken(key),
    )
    .join(",");
}

function logToken(value) {
  if (value == null || value === "") return "-";
  const text = String(value);
  return /^[A-Za-z0-9_.:@+-]+$/.test(text) ? text : JSON.stringify(text);
}

function summarizePendingClaimForLog(claim) {
  return {
    claimId: claim.claimId,
    pubkey: claim.pubkey || null,
    proofTweetId: claim.proofTweetId || null,
    attemptCount: Number(claim.attemptCount || 0),
    retryReason: claim.retryReason || null,
    sourceKind: claim.sourceKind ?? null,
  };
}

function summarizeResultForLog(result) {
  return {
    claimId: result.claimId || result.claim?.claimId || null,
    identityStatus: result.identityStatus || null,
    rejectionReason: result.rejectionReason || null,
    retryReason: result.retryReason || null,
    verificationMethod: result.verificationMethod || null,
    proofSource: result.proofSource || null,
    zapReason: result.zapReason || null,
    zappable: result.zappable === true,
    pubkey: result.pubkey || result.claim?.pubkey || null,
  };
}

function timestampForLog(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value.toMillis === "function") {
    try {
      return new Date(value.toMillis()).toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : String(value);
  }
  return null;
}

runMain(import.meta.url, () => runProjection(loadProjectionConfig()));
