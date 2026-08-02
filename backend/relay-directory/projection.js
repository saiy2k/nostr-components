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
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  logRunSummary,
  runCli,
  takeOptionValue,
  writeJson,
} from "./runtime.js";
import {
  discoverXBioIdentities,
  normalizeTwitterHandle,
  verifyTweetCandidate,
} from "./x-identity.js";
import { isHexPubkey, isPublicHostname } from "./utils.js";

export function parseProjectionArgs(argv) {
  const args = {
    ...firestoreConfigFromEnv(),
    out: null,
    timeoutMs: Number(process.env.PROJECTION_TIMEOUT_MS || 12000),
    maxProofs: Number(process.env.MAX_PROOFS || 250),
    verifyTweets: process.env.VERIFY_TWEETS !== "0",
    checkZaps: process.env.CHECK_ZAPS !== "0",
    projectionLimit: Number(process.env.PROJECTION_LIMIT || 1000),
    projectionExternalRetryMs: Number(
      process.env.PROJECTION_EXTERNAL_RETRY_MS || 15 * 60 * 1000,
    ),
    runDeadlineMs: Number(process.env.PROJECTION_RUN_DEADLINE_MS || 0),
    maxPendingClaims: Number(
      process.env.MAX_PENDING_CLAIMS || DEFAULT_MAX_PENDING_CLAIMS,
    ),
    maxInactiveVerifiedClaims: Number(
      process.env.MAX_INACTIVE_VERIFIED_CLAIMS ||
        DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
    ),
    maxRejectionTombstones: Number(
      process.env.MAX_REJECTION_TOMBSTONES || DEFAULT_MAX_REJECTION_TOMBSTONES,
    ),
    maxRetryAttempts: Number(
      process.env.MAX_RETRY_ATTEMPTS || DEFAULT_MAX_RETRY_ATTEMPTS,
    ),
    scanXProfiles: process.env.SCAN_X_PROFILES === "1",
    xProfileMax: Number(process.env.X_PROFILE_MAX || 100),
    xBearerToken:
      process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const take = () => {
      const result = takeOptionValue(argv, index, flag);
      index = result.nextIndex;
      return result.value;
    };

    if (flag === "--project-directory") continue;
    if (flag === "--out") args.out = take();
    else if (flag === "--no-json") args.out = null;
    else if (flag === "--timeout-ms") args.timeoutMs = Number(take());
    else if (flag === "--max-proofs") args.maxProofs = Number(take());
    else if (flag === "--no-tweet-verify") args.verifyTweets = false;
    else if (flag === "--no-zap-check") args.checkZaps = false;
    else if (flag === "--scan-x-profiles") args.scanXProfiles = true;
    else if (flag === "--no-x-profile-scan") args.scanXProfiles = false;
    else if (flag === "--x-profile-max") args.xProfileMax = Number(take());
    else if (flag === "--firestore-project") {
      args.firestoreProject = take();
    } else if (flag === "--firestore-database") {
      args.firestoreDatabase = take();
    } else if (flag === "--firestore-entries-collection") {
      args.firestoreEntriesCollection = take();
    } else if (flag === "--firestore-handles-collection") {
      args.firestoreHandlesCollection = take();
    } else if (flag === "--projection-limit") {
      args.projectionLimit = Number(take());
    } else if (flag === "--projection-external-retry-ms") {
      args.projectionExternalRetryMs = Number(take());
    } else if (flag === "--run-deadline-ms") {
      args.runDeadlineMs = Number(take());
    } else if (flag === "--max-pending-claims") {
      args.maxPendingClaims = Number(take());
    } else if (flag === "--max-inactive-verified-claims") {
      args.maxInactiveVerifiedClaims = Number(take());
    } else if (flag === "--max-rejection-tombstones") {
      args.maxRejectionTombstones = Number(take());
    } else if (flag === "--max-retry-attempts") {
      args.maxRetryAttempts = Number(take());
    } else if (flag === "--help" || flag === "-h") {
      printProjectionHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown projection argument: ${flag}`);
    }
  }

  validateProjectionArgs(args);
  return args;
}

function validateProjectionArgs(args) {
  if (!args.firestoreProject) {
    throw new Error("--firestore-project or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be positive.");
  }
  if (!Number.isInteger(args.maxProofs) || args.maxProofs < 0) {
    throw new Error("--max-proofs must be an integer >= 0.");
  }
  if (!Number.isInteger(args.projectionLimit) || args.projectionLimit <= 0) {
    throw new Error("--projection-limit must be a positive integer.");
  }
  if (
    !Number.isFinite(args.projectionExternalRetryMs) ||
    args.projectionExternalRetryMs <= 0
  ) {
    throw new Error("--projection-external-retry-ms must be positive.");
  }
  if (!Number.isInteger(args.runDeadlineMs) || args.runDeadlineMs < 0) {
    throw new Error("--run-deadline-ms must be an integer >= 0.");
  }
  if (!Number.isInteger(args.xProfileMax) || args.xProfileMax < 0) {
    throw new Error("--x-profile-max must be an integer >= 0.");
  }
  if (args.scanXProfiles && !args.xBearerToken) {
    throw new Error(
      "--scan-x-profiles requires X_BEARER_TOKEN or TWITTER_BEARER_TOKEN.",
    );
  }
  for (const [name, value] of [
    ["--max-pending-claims", args.maxPendingClaims],
    ["--max-inactive-verified-claims", args.maxInactiveVerifiedClaims],
    ["--max-rejection-tombstones", args.maxRejectionTombstones],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be an integer >= 0.`);
    }
  }
  if (!Number.isInteger(args.maxRetryAttempts) || args.maxRetryAttempts <= 0) {
    throw new Error("--max-retry-attempts must be a positive integer.");
  }
}

function printProjectionHelp() {
  console.log(`Usage: npm run project -- [options]

Verify pending X/Nostr identity claims and project verified directory users.

Options:
  --firestore-project <id>               GCP project.
  --projection-limit <n>                 Maximum handle docs. Default: 1000
  --projection-external-retry-ms <n>     External retry delay. Default: 900000
  --run-deadline-ms <n>                   Graceful run deadline; 0 disables it.
  --max-proofs <n>                       Proof tweets per run; 0 means all.
  --no-tweet-verify                      Skip proof tweet verification.
  --no-zap-check                         Skip NIP-57 capability checks.
  --scan-x-profiles                      Scan official X profile bios.
  --x-profile-max <n>                    Maximum X profiles. Default: 100
  --max-pending-claims <n>               Pending claims retained. Default: 20
  --max-inactive-verified-claims <n>     Inactive verified claims. Default: 10
  --max-rejection-tombstones <n>         Rejected IDs retained. Default: 100
  --max-retry-attempts <n>                Attempts before rejection. Default: 5
  --out <file>                           Optional JSON run summary.

X bio scanning requires X_BEARER_TOKEN or TWITTER_BEARER_TOKEN. It recognizes
npub, nprofile, and NIP-05 identifiers and can verify users without kind 10011.
`);
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
  let profilesRemaining = args.xProfileMax;
  const deadlineAt =
    args.runDeadlineMs > 0 ? now() + args.runDeadlineMs : Infinity;

  console.log(
    `Projecting pending claims from ${handleDocs.length} handle document(s)...`,
  );

  for (const handleDoc of handleDocs) {
    if (now() >= deadlineAt) {
      stats.stoppedReason = "run_deadline_reached";
      break;
    }
    if (!projectionHandleIsDue(handleDoc.data)) continue;
    stats.handlesDue += 1;

    const verification = await verifyClaims(handleDoc.data, args, {
      proofsRemaining,
      profilesRemaining,
    });
    proofsRemaining -= verification.proofTweetsAttempted;
    profilesRemaining -= verification.xProfilesAttempted;
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
    if (verification.stopRun) {
      stats.stoppedReason = verification.stoppedReason;
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
      scanXProfiles: args.scanXProfiles,
      xProfileMax: args.xProfileMax,
      runDeadlineMs: args.runDeadlineMs,
    },
    stats,
  };
  output.run = finishRunMetrics(runMetrics, stats);
  logRunSummary(output.run);
  if (args.out) await writeJson(args.out, output);
  printProjectionSummary(output, args);
  return output;
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
  const profilesRemaining = limits.profilesRemaining ?? Infinity;

  if (args.scanXProfiles && profilesRemaining > 0 && pending.length > 0) {
    const bioDiscovery = await discoverXBioIdentities({
      handleSeeds: pending,
      additionalHandles: [],
      bearerToken: args.xBearerToken,
      timeoutMs: args.timeoutMs,
      maxProfiles: Math.min(1, profilesRemaining),
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
  if (args.out) console.log(`  output:               ${args.out}`);
}

runCli(import.meta.url, parseProjectionArgs, runProjection);
