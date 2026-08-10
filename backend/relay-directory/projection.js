#!/usr/bin/env node
// SPDX-License-Identifier: MIT

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
  buildRunSummaryWrite,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  DEFAULT_COLLECTIONS,
  finishRunMetrics,
  firestoreConfigFromEnv,
  logRunSummary,
  runMain,
  writeJson,
} from "./runtime.js";
import {
  discoverXBioIdentities,
  verifyTweetCandidate,
} from "./x-identity.js";
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
    projectionLimit: numberFromEnv(env, "PROJECTION_LIMIT", 100),
    projectionExternalRetryMs: Number(
      env.PROJECTION_EXTERNAL_RETRY_MS || 15 * 60 * 1000,
    ),
    runDeadlineMs: numberFromEnv(env, "PROJECTION_RUN_DEADLINE_MS", 0),
    maxPendingClaims: Number(
      env.MAX_PENDING_CLAIMS || DEFAULT_MAX_PENDING_CLAIMS,
    ),
    maxInactiveVerifiedClaims: Number(
      env.MAX_INACTIVE_VERIFIED_CLAIMS || DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
    ),
    maxRejectionTombstones: Number(
      env.MAX_REJECTION_TOMBSTONES || DEFAULT_MAX_REJECTION_TOMBSTONES,
    ),
    maxRetryAttempts: Number(
      env.MAX_RETRY_ATTEMPTS || DEFAULT_MAX_RETRY_ATTEMPTS,
    ),
    xBearerToken:
      env.X_BEARER_TOKEN || env.TWITTER_BEARER_TOKEN || null,
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

export async function runProjection(args, FirestoreCtor, dependencies = {}) {
  const runMetrics = createRunMetrics("projection");
  const db =
    dependencies.db ?? (await createFirestore(args, FirestoreCtor));
  const verifyClaims = dependencies.verifyHandleClaims || verifyHandleClaims;
  const now = dependencies.now || Date.now;
  const handleDocs = await readPendingHandleDocs(db, args);
  const stats = {
    handleDocsRead: handleDocs.length,
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
    pendingDropped: 0,
    firestoreWrites: 0,
    stoppedReason: null,
  };
  let proofsRemaining = args.maxProofs === 0 ? Infinity : args.maxProofs;
  const deadlineAt =
    args.runDeadlineMs > 0 ? now() + args.runDeadlineMs : Infinity;

  logProjectionEvent("projection_run_begin", {
    handleDocsRead: handleDocs.length,
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

    const transition = applyProjectionResults(
      handleDoc.data,
      verification.results,
      {
        retryDelayMs: args.projectionExternalRetryMs,
        maxPendingClaims: args.maxPendingClaims,
        maxInactiveVerifiedClaims: args.maxInactiveVerifiedClaims,
        maxRejectionTombstones: args.maxRejectionTombstones,
        maxRetryAttempts: args.maxRetryAttempts,
      },
    );
    const writes = buildHandleProjectionWrites(handleDoc, transition, args);
    if (writes.length) {
      await commitFirestoreWrites(db, writes);
      stats.firestoreWrites += writes.length;
      stats.handlesChanged += 1;
      stats.verified += transition.stats.verified;
      stats.rejected += transition.stats.rejected;
      stats.retryLater += transition.stats.retryLater;
      stats.pendingDropped += transition.stats.pendingDropped;
    }

    logProjectionEvent("projection_handle_result", {
      handleDocId: handleDoc.id,
      handle,
      durationMs: Math.max(0, now() - handleStartedMs),
      changed: transition.changed,
      activeChanged: transition.activeChanged,
      firestoreWrites: writes.length,
      writeTargets: writes.map((write) => ({
        collection: write.collection,
        id: write.id,
        identityStatus: write.data?.identityStatus || null,
        directoryStatus: write.data?.directoryStatus || null,
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

  const output = {
    generatedAt: new Date().toISOString(),
    mode: "projection",
    source: "directory-handle-claims",
    firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      entriesCollection: args.firestoreEntriesCollection,
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
  await persistRunSummary(db, output, args);
  if (args.out) await writeJson(args.out, output);
  printProjectionSummary(output, args);
  return output;
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
  const results = [];
  const completedClaimIds = new Set();
  let proofTweetsAttempted = 0;
  let xProfilesAttempted = 0;
  let xProfilesFailed = 0;
  let xProfileFailures = {};
  let xBioIdentifiersResolved = 0;
  let stopRun = false;
  let stoppedReason = null;
  const proofsRemaining = limits.proofsRemaining ?? Infinity;

  if (pending.length > 0) {
    const bioDiscovery = await discoverXBioIdentities({
      handleSeeds: pending,
      additionalHandles: [],
      timeoutMs: args.timeoutMs,
      maxProfiles: 1,
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
      const verified = await enrichVerifiedResult(
        {
          ...record,
          claimId: claim.claimId,
          claim: existing ? undefined : claim,
          proofPublishedAt: Math.floor(Date.now() / 1000),
        },
        claim.metadata,
        args,
      );
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
    if (bioDiscovery.stoppedReason === "x_rate_limited") {
      stopRun = true;
      stoppedReason = "x_rate_limited";
    }
  }

  if (args.verifyTweets && !stopRun) {
    for (const claim of pending) {
      if (completedClaimIds.has(claim.claimId) || !claim.proofTweetId) continue;
      if (proofTweetsAttempted >= proofsRemaining) break;
      proofTweetsAttempted += 1;
      let result = await verifyTweetCandidate(claim, args.timeoutMs, {
        bearerToken: args.xBearerToken,
      });
      if (result.identityStatus === "verified") {
        result = await enrichVerifiedResult(result, claim.metadata, args);
      }
      results.push({ ...result, claimId: claim.claimId });
      completedClaimIds.add(claim.claimId);
      if (result.retryRateLimited) {
        stopRun = true;
        stoppedReason = result.retryReason || "x_rate_limited";
        break;
      }
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
  };
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

async function readPendingHandleDocs(db, args) {
  const snapshot = await db
    .collection(args.firestoreHandlesCollection)
    .where("pendingClaimCount", ">", 0)
    .orderBy("nextAttemptAt")
    .limit(args.projectionLimit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
}

export async function checkZapSupport(
  result,
  metadata,
  timeoutMs,
  fetchImpl = fetch,
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
  console.log(`  rejected:             ${output.stats.rejected}`);
  console.log(`  retry later:          ${output.stats.retryLater}`);
  console.log(`  pending dropped:      ${output.stats.pendingDropped}`);
  console.log(`  Firestore writes:     ${output.stats.firestoreWrites}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  if (output.stats.stoppedReason) {
    console.log(`  stopped reason:       ${output.stats.stoppedReason}`);
  }
  if (args.out) console.log(`  output:               ${args.out}`);
}

function logProjectionEvent(message, fields = {}) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message,
      module: "projection",
      ...fields,
    }),
  );
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
