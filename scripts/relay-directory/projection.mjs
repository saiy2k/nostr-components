#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import os from "node:os";
import { FieldValue } from "@google-cloud/firestore";
import { nip19 } from "nostr-tools";
import { isValidSignedEvent } from "./ingestion.mjs";
import {
  DEFAULT_COLLECTIONS,
  buildRunSummaryWrite,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  firestoreSafeId,
  firestoreTimestampToMs,
  logRunSummary,
  runCli,
  stripUndefined,
  takeOptionValue,
  writeJson,
} from "./runtime.mjs";
import {
  discoverXBioIdentities,
  extractDirectoryInputs,
  verifyTweetCandidate,
} from "./x-identity.mjs";

export function parseProjectionArgs(argv) {
  const args = {
    ...firestoreConfigFromEnv(),
    out: null,
    timeoutMs: 12000,
    maxProofs: Number(process.env.MAX_PROOFS || 250),
    verifyTweets: process.env.VERIFY_TWEETS !== "0",
    checkZaps: process.env.CHECK_ZAPS !== "0",
    projectionLimit: Number(process.env.PROJECTION_LIMIT || 1000),
    projectionSource: process.env.PROJECTION_SOURCE || "queue",
    projectionWorkerId:
      process.env.PROJECTION_WORKER_ID ||
      `projection:${os.hostname()}:${process.pid}`,
    projectionLockMs: Number(process.env.PROJECTION_LOCK_MS || 10 * 60 * 1000),
    projectionExternalRetryMs: Number(
      process.env.PROJECTION_EXTERNAL_RETRY_MS || 15 * 60 * 1000,
    ),
    updateProcessingStatus: process.env.UPDATE_PROCESSING_STATUS !== "0",
    scanXProfiles: process.env.SCAN_X_PROFILES === "1",
    xProfileMax: Number(process.env.X_PROFILE_MAX || 100),
    xHandles: String(process.env.X_PROFILE_HANDLES || "")
      .split(",")
      .map((handle) => handle.trim())
      .filter(Boolean),
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
    else if (flag === "--no-processing-status") {
      args.updateProcessingStatus = false;
    } else if (flag === "--scan-x-profiles") args.scanXProfiles = true;
    else if (flag === "--no-x-profile-scan") args.scanXProfiles = false;
    else if (flag === "--x-profile-max") args.xProfileMax = Number(take());
    else if (flag === "--x-handles") {
      args.xHandles = take()
        .split(",")
        .map((handle) => handle.trim())
        .filter(Boolean);
    } else if (flag === "--firestore-project") {
      args.firestoreProject = take();
    } else if (flag === "--firestore-database") {
      args.firestoreDatabase = take();
    } else if (flag === "--firestore-entries-collection") {
      args.firestoreEntriesCollection = take();
    } else if (flag === "--firestore-handles-collection") {
      args.firestoreHandlesCollection = take();
    } else if (flag === "--firestore-projection-runs-collection") {
      args.firestoreProjectionRunsCollection = take();
    } else if (flag === "--firestore-events-collection") {
      args.firestoreEventsCollection = take();
    } else if (flag === "--firestore-queue-collection") {
      args.firestoreQueueCollection = take();
    } else if (flag === "--projection-limit") {
      args.projectionLimit = Number(take());
    } else if (flag === "--projection-source") {
      args.projectionSource = take();
    } else if (flag === "--projection-worker-id") {
      args.projectionWorkerId = take();
    } else if (flag === "--projection-lock-ms") {
      args.projectionLockMs = Number(take());
    } else if (flag === "--projection-external-retry-ms") {
      args.projectionExternalRetryMs = Number(take());
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
  if (!Number.isFinite(args.maxProofs) || args.maxProofs < 0) {
    throw new Error("--max-proofs must be >= 0.");
  }
  if (!Number.isFinite(args.projectionLimit) || args.projectionLimit <= 0) {
    throw new Error("--projection-limit must be positive.");
  }
  if (!["queue", "raw"].includes(args.projectionSource)) {
    throw new Error("--projection-source must be queue or raw.");
  }
  if (!args.projectionWorkerId) {
    throw new Error("--projection-worker-id must be non-empty.");
  }
  if (!Number.isFinite(args.projectionLockMs) || args.projectionLockMs <= 0) {
    throw new Error("--projection-lock-ms must be positive.");
  }
  if (
    !Number.isFinite(args.projectionExternalRetryMs) ||
    args.projectionExternalRetryMs <= 0
  ) {
    throw new Error("--projection-external-retry-ms must be positive.");
  }
  if (!Number.isFinite(args.xProfileMax) || args.xProfileMax < 0) {
    throw new Error("--x-profile-max must be >= 0.");
  }
}

function printProjectionHelp() {
  console.log(`Usage: npm run crawl:directory:project -- [options]

Project raw Nostr identity events into the X/Twitter -> Nostr directory.

Options:
  --firestore-project <id>                GCP project.
  --projection-limit <n>                  Maximum queue/raw docs. Default: 1000
  --projection-source <queue|raw>          Work source. Default: queue
  --projection-worker-id <value>          Queue lock owner.
  --projection-lock-ms <n>                Queue lease. Default: 600000
  --projection-external-retry-ms <n>      External retry delay. Default: 900000
  --max-proofs <n>                        Proof tweets per run; 0 means all.
  --no-tweet-verify                       Skip proof tweet verification.
  --no-zap-check                          Skip NIP-57 capability checks.
  --no-processing-status                  Do not update raw/queue status.
  --scan-x-profiles                       Use official X API profile bios.
  --x-profile-max <n>                     Maximum X profiles per run. Default: 100
  --x-handles <csv>                       Extra X handles to scan for Nostr ids.
  --out <file>                            Optional JSON run summary.

X bio scanning requires X_BEARER_TOKEN or TWITTER_BEARER_TOKEN. It recognizes
npub, nprofile, and NIP-05 identifiers. NIP-05 values are resolved through the
domain's /.well-known/nostr.json endpoint without following redirects.
`);
}

export async function runProjection(args, FirestoreCtor) {
  const runMetrics = createRunMetrics("projection");
  const db = await createFirestore(args, FirestoreCtor);

  console.log(
    `Projecting up to ${args.projectionLimit} identity events from ${args.projectionSource}...`,
  );

  const queueStatusCountsBefore =
    args.projectionSource === "queue"
      ? await countProjectionQueueStatuses(db, args)
      : null;
  const queueDocs =
    args.projectionSource === "queue"
      ? await claimProjectionQueueDocs(db, args)
      : [];
  const rawRead =
    args.projectionSource === "queue"
      ? await readRawIdentityEventDocsForQueue(db, queueDocs, args)
      : {
          rawDocs: await readRawIdentityEventDocs(db, args),
          missingQueueDocs: [],
        };
  const rawDocs = rawRead.rawDocs;
  const eventDocs = rawDocs.map((doc) => ({
    ...doc,
    event: firestoreRawDocToNostrEvent(doc.data),
  }));
  const validRawDocs = eventDocs.filter(
    (doc) => doc.event && isValidSignedEvent(doc.event),
  );
  const invalidRawDocs = eventDocs.filter(
    (doc) => !doc.event || !isValidSignedEvent(doc.event),
  );
  const events = validRawDocs.map((doc) => doc.event);

  const output = await buildDirectoryOutputFromEvents({ events, args });
  output.source = "firestore-projection";
  output.firestore = {
    project: args.firestoreProject,
    database: args.firestoreDatabase,
    eventsCollection: args.firestoreEventsCollection,
    queueCollection: args.firestoreQueueCollection,
    entriesCollection: args.firestoreEntriesCollection,
    handlesCollection: args.firestoreHandlesCollection,
  };
  output.stats.rawEventDocsRead = rawDocs.length;
  output.stats.missingRawEventDocs = rawRead.missingQueueDocs.length;
  output.stats.invalidRawEventDocs = invalidRawDocs.length;
  output.stats.queueDocsRead = queueDocs.length;
  output.stats.validRawEvents = events.length;
  output.stats.queueStatusCountsBefore = queueStatusCountsBefore;
  output.run = finishRunMetrics(runMetrics, {
    queueDocsRead: queueDocs.length,
    queueDocsClaimed: queueDocs.length,
    rawEventDocsRead: rawDocs.length,
    missingRawEventDocs: rawRead.missingQueueDocs.length,
    invalidRawEventDocs: invalidRawDocs.length,
    validRawEvents: events.length,
    directoryRecords: output.directory.length,
    rejected: output.rejected.length,
    proofRetriesScheduled: output.stats.proofRetriesScheduled,
    proofVerificationStopped: output.stats.proofVerificationStopped,
    xProfilesAttempted: output.stats.xProfilesAttempted,
    xBioIdentifiersResolved: output.stats.xBioIdentifiersResolved,
    verified: output.stats.verified,
    claimedOnly: output.stats.claimedOnly,
    ...(queueStatusCountsBefore
      ? prefixObjectKeys(queueStatusCountsBefore, "queueBefore")
      : {}),
  });

  const writes = [
    ...buildFirestoreWrites(output, args),
    ...(args.updateProcessingStatus
      ? buildProjectionProcessingWrites(validRawDocs, output, args)
      : []),
    ...(args.updateProcessingStatus
      ? buildProjectionQueueWrites(validRawDocs, output, args)
      : []),
    ...(args.updateProcessingStatus
      ? buildProjectionRawFailureWrites(invalidRawDocs, args)
      : []),
    ...(args.updateProcessingStatus
      ? buildProjectionQueueFailureWrites(
          rawRead.missingQueueDocs,
          "missing_raw_event",
          args,
        )
      : []),
    ...(args.updateProcessingStatus
      ? buildProjectionQueueFailureWrites(
          invalidRawDocs,
          "invalid_raw_event",
          args,
        )
      : []),
    buildRunSummaryWrite(
      output.run,
      output,
      args.firestoreProjectionRunsCollection,
    ),
  ];
  await commitFirestoreWrites(db, writes);
  logRunSummary(output.run);

  if (args.out) await writeJson(args.out, output);
  printProjectionSummary(output, args);
  return output;
}

export async function buildDirectoryOutputFromEvents({ events, args }) {
  const profileEvents = latestReplaceable(events);
  const { candidates, claimed, metadataByPubkey } =
    extractDirectoryInputs(profileEvents);
  const proofLimit =
    args.maxProofs === 0
      ? candidates.length
      : Math.min(args.maxProofs, candidates.length);

  console.log(`Found ${profileEvents.length} latest profile/identity events.`);
  console.log(
    `Detected ${candidates.length} proof candidates and ${claimed.length} claimed-only leads.`,
  );

  const verifiedOrRejected = [];
  const retryLater = [];
  let proofVerificationStoppedReason = null;
  let proofTweetsAttempted = 0;

  if (args.verifyTweets) {
    for (const candidate of candidates.slice(0, proofLimit)) {
      proofTweetsAttempted += 1;
      const result = await verifyTweetCandidate(candidate, args.timeoutMs);
      if (result.identityStatus === "retry_later") {
        retryLater.push(result);
        if (result.retryRateLimited) {
          proofVerificationStoppedReason = "x_rate_limited";
          break;
        }
      } else {
        verifiedOrRejected.push(result);
      }
    }
    for (const candidate of candidates.slice(proofTweetsAttempted)) {
      retryLater.push({
        ...candidate,
        identityStatus: "retry_later",
        retryReason:
          proofVerificationStoppedReason || "max_proof_limit_reached",
        retrySource: "projection",
        retryRateLimited: proofVerificationStoppedReason === "x_rate_limited",
      });
    }
  } else {
    verifiedOrRejected.push(
      ...candidates.map((candidate) => ({
        ...candidate,
        identityStatus: "candidate",
      })),
    );
  }

  const bioDiscovery = args.scanXProfiles
    ? await discoverXBioIdentities({
        handleSeeds: [...candidates, ...claimed],
        additionalHandles: args.xHandles,
        bearerToken: args.xBearerToken,
        timeoutMs: args.timeoutMs,
        maxProfiles: args.xProfileMax,
      })
    : {
        records: [],
        profilesAttempted: 0,
        profilesWithIdentifiers: 0,
        identifiersResolved: 0,
        stoppedReason: "disabled",
      };

  let verified = mergeVerifiedRecords([
    ...verifiedOrRejected.filter(
      (record) => record.identityStatus === "verified",
    ),
    ...bioDiscovery.records,
  ]);
  const rejected = verifiedOrRejected.filter(
    (record) => record.identityStatus === "rejected",
  );

  verified = verified.map((record) => ({
    ...record,
    metadata: getMetadata(metadataByPubkey, record.pubkey),
  }));

  if (args.checkZaps && verified.length) {
    const checked = [];
    for (const record of verified) {
      checked.push(
        await checkZapSupport(record, record.metadata, args.timeoutMs),
      );
    }
    verified = checked;
  }

  const verifiedKeys = new Set(
    verified.map((record) => `${record.handle}:${record.pubkey}`),
  );
  const remainingClaims = claimed.filter(
    (record) => !verifiedKeys.has(`${record.handle}:${record.pubkey}`),
  );

  const directory = [
    ...verified.map((record) => ({
      ...record,
      directoryStatus: record.zappable
        ? "verified_zappable"
        : "verified_not_zappable",
      autoZapAllowed: record.zappable === true,
    })),
    ...remainingClaims.map((record) => ({
      ...record,
      metadata: getMetadata(metadataByPubkey, record.pubkey),
      directoryStatus: "claimed_unverified",
      zappable: false,
      autoZapAllowed: false,
    })),
  ].sort(sortDirectoryRecord);

  return {
    generatedAt: new Date().toISOString(),
    mode: "projection",
    strategy: {
      identityProof:
        "NIP-39 proof tweets plus optional X profile bio identifiers; legacy kind:0 i tags accepted",
      proofVerification: args.verifyTweets
        ? "proof tweet author must match the handle and contain the exact npub"
        : "disabled",
      proofVerificationStoppedReason,
      xProfileBioScan: args.scanXProfiles ? "enabled" : "disabled",
      xProfileBioStoppedReason: bioDiscovery.stoppedReason,
      zapPolicy: "auto-zap requires verified identity and LNURL allowsNostr",
    },
    stats: {
      profileEvents: profileEvents.length,
      verifiableCandidates: candidates.length,
      proofTweetsPlanned: args.verifyTweets ? proofLimit : 0,
      proofTweetsAttempted,
      proofRetriesScheduled: retryLater.length,
      proofVerificationStopped: Boolean(proofVerificationStoppedReason),
      xProfilesAttempted: bioDiscovery.profilesAttempted,
      xProfilesWithIdentifiers: bioDiscovery.profilesWithIdentifiers,
      xBioIdentifiersResolved: bioDiscovery.identifiersResolved,
      xBioVerified: bioDiscovery.records.length,
      verified: verified.length,
      rejected: rejected.length,
      claimedOnly: remainingClaims.length,
      zappableVerified: verified.filter((record) => record.zappable).length,
      autoZapAllowed: directory.filter((record) => record.autoZapAllowed)
        .length,
    },
    directory,
    rejected,
    retryLater,
  };
}

function latestReplaceable(events) {
  const latest = new Map();
  for (const event of events) {
    if (!isValidSignedEvent(event)) continue;
    const key = `${event.kind}:${event.pubkey}`;
    const previous = latest.get(key);
    if (!previous || event.created_at > previous.created_at) {
      latest.set(key, event);
    }
  }
  return [...latest.values()];
}

function getMetadata(metadataByPubkey, pubkey) {
  return (
    metadataByPubkey.get(pubkey) || {
      pubkey,
      npub: nip19.npubEncode(pubkey),
      name: null,
      nip05: null,
      lud16: null,
      lud06: null,
      website: null,
      about: null,
    }
  );
}

function mergeVerifiedRecords(records) {
  const byIdentity = new Map();
  for (const record of records) {
    const key = `${record.handle}:${record.pubkey}`;
    const previous = byIdentity.get(key);
    const methods = [
      ...(previous?.verificationMethods || []),
      ...(record.verificationMethods || []),
      record.verificationMethod,
    ].filter(Boolean);
    byIdentity.set(key, {
      ...record,
      ...previous,
      xUserId: previous?.xUserId || record.xUserId,
      nostrIdentifier:
        previous?.nostrIdentifier || record.nostrIdentifier || null,
      verificationMethods: [...new Set(methods)],
    });
  }
  return [...byIdentity.values()];
}

async function checkZapSupport(record, metadata, timeoutMs) {
  const lightningAddress = metadata.lud16 || null;
  if (!lightningAddress) {
    return {
      ...record,
      lud16: null,
      zappable: false,
      zapReason: "missing-lud16",
    };
  }

  const lnurlp = lightningAddressToLnurlp(lightningAddress);
  if (!lnurlp) {
    return {
      ...record,
      lud16: lightningAddress,
      zappable: false,
      zapReason: "invalid-lud16",
    };
  }

  try {
    const response = await fetch(lnurlp, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return {
        ...record,
        lud16: lightningAddress,
        zappable: false,
        zapReason: `lnurl-http-${response.status}`,
      };
    }
    const json = await response.json();
    const zappable = json.allowsNostr === true && isHexPubkey(json.nostrPubkey);
    return {
      ...record,
      lud16: lightningAddress,
      lnurlp,
      zappable,
      zapReason: zappable ? "nip57-ready" : "lnurl-does-not-allow-nostr",
      lnurlAllowsNostr: json.allowsNostr === true,
      lnurlNostrPubkey: isHexPubkey(json.nostrPubkey) ? json.nostrPubkey : null,
    };
  } catch {
    return {
      ...record,
      lud16: lightningAddress,
      lnurlp,
      zappable: false,
      zapReason: "lnurl-fetch-failed",
    };
  }
}

export function lightningAddressToLnurlp(lud16) {
  const parts = String(lud16 || "")
    .trim()
    .split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return `https://${parts[1]}/.well-known/lnurlp/${encodeURIComponent(parts[0])}`;
}

function isHexPubkey(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

async function readRawIdentityEventDocs(db, args) {
  const snapshot = await db
    .collection(args.firestoreEventsCollection)
    .orderBy("createdAt", "desc")
    .limit(args.projectionLimit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function readProjectionQueueDocs(db, args) {
  const docs = [];
  const perStatusLimit = Math.ceil(args.projectionLimit / 3);

  for (const status of ["pending", "retry_later", "processing"]) {
    const snapshot = await db
      .collection(args.firestoreQueueCollection)
      .where("status", "==", status)
      .limit(perStatusLimit)
      .get();
    docs.push(
      ...snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    );
    if (docs.length >= args.projectionLimit) break;
  }

  return docs
    .sort(
      (a, b) =>
        (firestoreTimestampToMs(a.data?.createdAt) || 0) -
        (firestoreTimestampToMs(b.data?.createdAt) || 0),
    )
    .slice(0, args.projectionLimit);
}

async function countProjectionQueueStatuses(db, args) {
  const statuses = [
    "pending",
    "retry_later",
    "processing",
    "done",
    "ignored",
    "failed",
  ];
  const counts = {};
  await Promise.all(
    statuses.map(async (status) => {
      try {
        const snapshot = await db
          .collection(args.firestoreQueueCollection)
          .where("status", "==", status)
          .count()
          .get();
        counts[status] = snapshot.data().count || 0;
      } catch (error) {
        counts[status] = null;
        counts.countError = firestoreErrorSummary(error);
      }
    }),
  );
  return counts;
}

async function claimProjectionQueueDocs(db, args) {
  const candidates = await readProjectionQueueDocs(db, args);
  const claimed = [];

  for (const candidate of candidates) {
    if (claimed.length >= args.projectionLimit) break;
    const claimedDoc = await claimProjectionQueueDoc(db, candidate, args);
    if (claimedDoc) claimed.push(claimedDoc);
  }
  return claimed;
}

async function claimProjectionQueueDoc(db, candidate, args) {
  const ref = db.collection(args.firestoreQueueCollection).doc(candidate.id);
  const nowMs = Date.now();
  const lockExpiresAt = new Date(nowMs + args.projectionLockMs);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (!queueDocIsClaimable(data, nowMs)) return null;

    transaction.set(
      ref,
      buildProjectionQueueClaimData(args.projectionWorkerId, lockExpiresAt),
      { merge: true },
    );
    return {
      id: snapshot.id,
      data: {
        ...data,
        status: "processing",
        lockedBy: args.projectionWorkerId,
        lockExpiresAt,
      },
    };
  });
}

export function buildProjectionQueueClaimData(workerId, lockExpiresAt) {
  return stripUndefined({
    status: "processing",
    lockedBy: workerId,
    lockExpiresAt,
    claimedAt: FieldValue.serverTimestamp(),
    attempts: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export function queueDocIsClaimable(data, nowMs = Date.now()) {
  if (!data) return false;
  const status = data.status;
  if (!["pending", "retry_later", "processing"].includes(status)) return false;

  const nextAttemptAtMs = firestoreTimestampToMs(data.nextAttemptAt);
  if (status === "retry_later" && nextAttemptAtMs && nextAttemptAtMs > nowMs) {
    return false;
  }

  const lockExpiresAtMs = firestoreTimestampToMs(data.lockExpiresAt);
  if (lockExpiresAtMs && lockExpiresAtMs > nowMs) return false;
  if (status === "processing" && !lockExpiresAtMs) return false;
  return true;
}

async function readRawIdentityEventDocsForQueue(db, queueDocs, args) {
  const reads = queueDocs.map(async ({ id, data }) => {
    const eventId = data?.eventId || id;
    const doc = await db
      .collection(args.firestoreEventsCollection)
      .doc(firestoreSafeId(eventId))
      .get();
    if (!doc.exists) return { missing: { id, data, eventId } };
    return { id: doc.id, data: doc.data(), queueId: id };
  });
  const results = await Promise.all(reads);
  return {
    rawDocs: results.filter((result) => result && !result.missing),
    missingQueueDocs: results
      .filter((result) => result?.missing)
      .map((result) => result.missing),
  };
}

export function firestoreRawDocToNostrEvent(data) {
  if (!data) return null;
  if (data.eventJson) {
    try {
      return JSON.parse(data.eventJson);
    } catch {
      return null;
    }
  }
  if (!data.event) return null;
  return {
    ...data.event,
    tags: (data.event.tags || []).map((tag) =>
      Array.isArray(tag) ? tag : tag.values || [],
    ),
  };
}

export function buildProjectionProcessingWrites(rawDocs, output, options = {}) {
  const statusByEventId = buildProjectionStatusByEventId(output);
  return rawDocs.map(({ id, data }) => {
    const eventId = data?.id || id;
    const status = projectionStatusForOutputRawEvent(
      output,
      eventId,
      statusByEventId,
    );
    return {
      collection:
        options.firestoreEventsCollection || DEFAULT_COLLECTIONS.events,
      id,
      data: stripUndefined({
        processing: {
          status: status.processingStatus,
          reason: status.reason,
          processedAt: FieldValue.serverTimestamp(),
          projectionRunAt: output.generatedAt,
        },
        identity: {
          status: status.identityStatus,
          reason: status.reason,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }),
    };
  });
}

export function buildProjectionQueueWrites(rawDocs, output, options = {}) {
  const statusByEventId = buildProjectionStatusByEventId(output);
  return rawDocs.map(({ id, data }) => {
    const eventId = data?.id || id;
    const status = projectionStatusForOutputRawEvent(
      output,
      eventId,
      statusByEventId,
    );
    return {
      collection: options.firestoreQueueCollection || DEFAULT_COLLECTIONS.queue,
      id: firestoreSafeId(eventId),
      data: stripUndefined({
        eventId,
        status: queueStatusForProjection(status),
        reason: status.reason,
        processingStatus: status.processingStatus,
        identityStatus: status.identityStatus,
        nextAttemptAt:
          status.processingStatus === "retry_later"
            ? new Date(
                Date.now() +
                  (options.projectionExternalRetryMs || 15 * 60 * 1000),
              )
            : null,
        completedAt: FieldValue.serverTimestamp(),
        lockedBy: null,
        lockExpiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    };
  });
}

export function buildProjectionRawFailureWrites(rawDocs, options = {}) {
  return rawDocs.map(({ id, data }) => ({
    collection: options.firestoreEventsCollection || DEFAULT_COLLECTIONS.events,
    id,
    data: stripUndefined({
      processing: {
        status: "failed",
        reason: "invalid_raw_event",
        processedAt: FieldValue.serverTimestamp(),
      },
      identity: {
        status: "unknown",
        reason: "invalid_raw_event",
      },
      updatedAt: FieldValue.serverTimestamp(),
    }),
    eventId: data?.id || id,
  }));
}

export function buildProjectionQueueFailureWrites(
  queueDocs,
  reason,
  options = {},
) {
  return queueDocs.map(({ id, data, eventId }) => ({
    collection: options.firestoreQueueCollection || DEFAULT_COLLECTIONS.queue,
    id: firestoreSafeId(eventId || data?.eventId || data?.id || id),
    data: stripUndefined({
      eventId: eventId || data?.eventId || data?.id || id,
      status: "failed",
      reason,
      processingStatus: "failed",
      identityStatus: "unknown",
      completedAt: FieldValue.serverTimestamp(),
      lockedBy: null,
      lockExpiresAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  }));
}

function projectionStatusForOutputRawEvent(output, eventId, statusByEventId) {
  if (output.strategy?.proofVerificationStoppedReason) {
    return {
      processingStatus: "retry_later",
      identityStatus: "unknown",
      reason: output.strategy.proofVerificationStoppedReason,
    };
  }
  return (
    statusByEventId.get(eventId) ||
    projectionStatusForRawEvent(eventId, new Set(), new Set(), new Map())
  );
}

function buildProjectionStatusByEventId(output) {
  const usefulEventIds = new Set();
  const verifiedEventIds = new Set();
  const rejectedByEventId = new Map();
  const retryByEventId = new Map();

  for (const record of output.directory || []) {
    if (record.sourceEventId) usefulEventIds.add(record.sourceEventId);
    if (record.identityStatus === "verified" && record.sourceEventId) {
      verifiedEventIds.add(record.sourceEventId);
    }
  }
  for (const record of output.rejected || []) {
    if (!record.sourceEventId) continue;
    usefulEventIds.add(record.sourceEventId);
    rejectedByEventId.set(
      record.sourceEventId,
      record.rejectionReason || "identity_rejected",
    );
  }
  for (const record of output.retryLater || []) {
    if (!record.sourceEventId) continue;
    retryByEventId.set(
      record.sourceEventId,
      record.retryReason || "temporary_proof_fetch_failure",
    );
  }

  const eventIds = new Set([
    ...usefulEventIds,
    ...rejectedByEventId.keys(),
    ...retryByEventId.keys(),
  ]);
  const statuses = new Map();
  for (const eventId of eventIds) {
    statuses.set(
      eventId,
      projectionStatusForRawEvent(
        eventId,
        usefulEventIds,
        verifiedEventIds,
        rejectedByEventId,
        retryByEventId,
      ),
    );
  }
  return statuses;
}

export function queueStatusForProjection(status) {
  if (status.processingStatus === "retry_later") return "retry_later";
  return status.processingStatus === "ignored" ? "ignored" : "done";
}

export function projectionStatusForRawEvent(
  eventId,
  usefulEventIds,
  verifiedEventIds,
  rejectedByEventId,
  retryByEventId = new Map(),
) {
  if (retryByEventId.has(eventId)) {
    return {
      processingStatus: "retry_later",
      identityStatus: "unknown",
      reason: retryByEventId.get(eventId),
    };
  }
  if (verifiedEventIds.has(eventId)) {
    return {
      processingStatus: "processed",
      identityStatus: "verified",
      reason: "verified_identity_proof",
    };
  }
  if (rejectedByEventId.has(eventId)) {
    return {
      processingStatus: "processed",
      identityStatus: "rejected",
      reason: rejectedByEventId.get(eventId),
    };
  }
  if (usefulEventIds.has(eventId)) {
    return {
      processingStatus: "processed",
      identityStatus: "claimed",
      reason: "claimed_identity_signal",
    };
  }
  return {
    processingStatus: "ignored",
    identityStatus: "none",
    reason: "no_identity_signal",
  };
}

export function buildFirestoreWrites(output, options = {}) {
  const entriesCollection =
    options.firestoreEntriesCollection || DEFAULT_COLLECTIONS.entries;
  const handlesCollection =
    options.firestoreHandlesCollection || DEFAULT_COLLECTIONS.handles;
  const runId = firestoreSafeId(output.generatedAt);
  const writes = [];

  for (const record of output.directory) {
    writes.push({
      collection: entriesCollection,
      id: firestoreDirectoryRecordId(record),
      data: stripUndefined({
        ...record,
        runId,
        lastSeenAt: output.generatedAt,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  for (const summary of buildHandleSummaries(
    output.directory,
    output.generatedAt,
    runId,
  )) {
    writes.push({
      collection: handlesCollection,
      id: firestoreHandleId(summary.platform, summary.handle),
      data: stripUndefined({
        ...summary,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }
  return writes;
}

function buildHandleSummaries(records, generatedAt, runId) {
  const byHandle = new Map();

  for (const record of records) {
    const key = firestoreHandleId(record.platform, record.handle);
    const current = byHandle.get(key) || {
      platform: record.platform,
      handle: record.handle,
      runId,
      lastSeenAt: generatedAt,
      recordCount: 0,
      verifiedCount: 0,
      zappableVerifiedCount: 0,
      autoZapAllowedCount: 0,
      best: null,
      records: [],
    };

    current.recordCount += 1;
    if (record.identityStatus === "verified") current.verifiedCount += 1;
    if (record.identityStatus === "verified" && record.zappable === true) {
      current.zappableVerifiedCount += 1;
    }
    if (record.autoZapAllowed === true) current.autoZapAllowedCount += 1;
    current.records.push({
      pubkey: record.pubkey,
      npub: record.npub,
      directoryStatus: record.directoryStatus,
      identityStatus: record.identityStatus,
      verificationMethods: record.verificationMethods || [],
      autoZapAllowed: record.autoZapAllowed,
      zappable: record.zappable,
      entryId: firestoreDirectoryRecordId(record),
    });
    byHandle.set(key, current);
  }

  return [...byHandle.values()].map((summary) => {
    const records = summary.records.sort(sortHandleSummaryRecord);
    return { ...summary, records, best: records[0] || null };
  });
}

function sortHandleSummaryRecord(a, b) {
  return statusRank(a) - statusRank(b) || a.pubkey.localeCompare(b.pubkey);
}

function statusRank(record) {
  if (record.autoZapAllowed) return 0;
  if (record.directoryStatus === "verified_not_zappable") return 1;
  if (record.identityStatus === "verified") return 2;
  return 3;
}

function firestoreDirectoryRecordId(record) {
  return firestoreSafeId(
    `${record.platform}:${record.handle}:${record.pubkey}`,
  );
}

function firestoreHandleId(platform, handle) {
  return firestoreSafeId(`${platform}:${handle}`);
}

function sortDirectoryRecord(a, b) {
  return (
    a.handle.localeCompare(b.handle) ||
    a.directoryStatus.localeCompare(b.directoryStatus) ||
    a.pubkey.localeCompare(b.pubkey)
  );
}

function firestoreErrorSummary(error) {
  return stripUndefined({
    code: error?.code || null,
    message: String(error?.message || "unknown").slice(0, 200),
  });
}

function prefixObjectKeys(object, prefix) {
  return Object.fromEntries(
    Object.entries(object || {}).map(([key, value]) => [
      `${prefix}${key[0].toUpperCase()}${key.slice(1)}`,
      value,
    ]),
  );
}

function printProjectionSummary(output, args) {
  console.log("\nDirectory projection complete.");
  console.log(`  profile events:       ${output.stats.profileEvents}`);
  console.log(`  proof candidates:     ${output.stats.verifiableCandidates}`);
  console.log(`  proof tweets checked: ${output.stats.proofTweetsAttempted}`);
  console.log(`  X profiles scanned:   ${output.stats.xProfilesAttempted}`);
  console.log(
    `  X bio ids resolved:   ${output.stats.xBioIdentifiersResolved}`,
  );
  console.log(`  verified:             ${output.stats.verified}`);
  console.log(`  claimed-only:         ${output.stats.claimedOnly}`);
  console.log(`  auto-zap allowed:     ${output.stats.autoZapAllowed}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore entries:    ${args.firestoreEntriesCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

runCli(import.meta.url, parseProjectionArgs, runProjection);
