#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  buildBackfillCheckpointWrite,
  buildBackfillGapWrite,
  buildHandleWriteFailureWrite,
  createNdkRelayClient,
  isValidSignedEvent,
  queryRelay,
} from "./ingestion.js";
import {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  DEFAULT_MAX_PENDING_CLAIMS,
  DEFAULT_MAX_REJECTION_TOMBSTONES,
  extractIdentityClaims,
  planDirectoryHandleWrites,
} from "./directory-state.js";
import {
  DEFAULT_RELAYS_FILE,
  IDENTITY_KINDS,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  loadRelaysFromFile,
  logRunSummary,
  runMain,
  terminateFirestore,
  writeJson,
} from "./runtime.js";
import { backfillStateId } from "./utils.js";

export function loadBackfillConfig(
  env = process.env,
  nowSeconds = Math.floor(Date.now() / 1000),
  options = {},
) {
  const config = {
    ...firestoreConfigFromEnv(env),
    relays: resolveRelays(env, options),
    out: env.BACKFILL_OUT || null,
    timeoutMs: numberFromEnv(env, "BACKFILL_TIMEOUT_MS", 12000),
    backfillPageLimit: numberFromEnv(env, "BACKFILL_PAGE_LIMIT", 250),
    backfillMaxPageLimit: numberFromEnv(env, "BACKFILL_MAX_PAGE_LIMIT", 1000),
    backfillMaxPages: numberFromEnv(env, "BACKFILL_MAX_PAGES", 4),
    backfillUntil: numberFromEnv(env, "BACKFILL_UNTIL", nowSeconds),
    backfillSince: numberFromEnv(env, "BACKFILL_SINCE", 0),
    backfillResume: env.BACKFILL_RESUME !== "0",
    backfillStatePrefix: env.BACKFILL_STATE_PREFIX || "backfill",
    backfillCacheLimit: numberFromEnv(env, "BACKFILL_CACHE_LIMIT", 5000),
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
    xMentionCheckTimeoutMs: numberFromEnv(
      env,
      "X_MENTION_CHECK_TIMEOUT_MS",
      5000,
    ),
  };
  validateBackfillConfig(config);
  return config;
}

function validateBackfillConfig(config) {
  if (!config.firestoreProject) {
    throw new Error("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!config.relays.length) throw new Error("RELAYS must not be empty.");
  positiveInteger(config.timeoutMs, "BACKFILL_TIMEOUT_MS");
  positiveInteger(config.backfillPageLimit, "BACKFILL_PAGE_LIMIT");
  positiveInteger(config.backfillMaxPageLimit, "BACKFILL_MAX_PAGE_LIMIT");
  if (config.backfillMaxPageLimit < config.backfillPageLimit) {
    throw new Error("BACKFILL_MAX_PAGE_LIMIT must be >= BACKFILL_PAGE_LIMIT.");
  }
  positiveInteger(config.backfillMaxPages, "BACKFILL_MAX_PAGES");
  positiveInteger(config.backfillUntil, "BACKFILL_UNTIL");
  nonNegativeInteger(config.backfillSince, "BACKFILL_SINCE");
  if (config.backfillSince > config.backfillUntil) {
    throw new Error("BACKFILL_SINCE must be <= BACKFILL_UNTIL.");
  }
  positiveInteger(config.backfillCacheLimit, "BACKFILL_CACHE_LIMIT");
  positiveInteger(config.xMentionCheckTimeoutMs, "X_MENTION_CHECK_TIMEOUT_MS");
  if (
    !config.backfillStatePrefix ||
    /[\/#?]/.test(config.backfillStatePrefix)
  ) {
    throw new Error(
      "BACKFILL_STATE_PREFIX must be non-empty and must not contain /, #, or ?.",
    );
  }
  for (const [name, value] of [
    ["MAX_PENDING_CLAIMS", config.maxPendingClaims],
    ["MAX_INACTIVE_VERIFIED_CLAIMS", config.maxInactiveVerifiedClaims],
    ["MAX_REJECTION_TOMBSTONES", config.maxRejectionTombstones],
  ]) {
    nonNegativeInteger(value, name);
  }
}

export async function runBackfill(config, FirestoreCtor, dependencies = {}) {
  const runMetrics = createRunMetrics("backfill");
  const db =
    dependencies.db ?? (await createFirestore(config, FirestoreCtor));
  const startedAt = new Date().toISOString();

  try {
    console.log(
      `Backfilling ${IDENTITY_KINDS.join(",")} from ${config.relays.length} relays into ${config.firestoreProject}/${config.firestoreDatabase}...`,
    );

    const { totals, cursorSummaries } = await runBackfillCursors(
      db,
      config,
      dependencies,
    );

    const output = {
      mode: "backfill",
      run: finishRunMetrics(runMetrics, totals),
      startedAt,
      finishedAt: new Date().toISOString(),
      relays: config.relays,
      kinds: IDENTITY_KINDS,
      stats: totals,
      cursors: cursorSummaries,
      firestore: {
        project: config.firestoreProject,
        database: config.firestoreDatabase,
        handlesCollection: config.firestoreHandlesCollection,
        stateCollection: config.firestoreStateCollection,
        gapsCollection: config.firestoreGapsCollection,
        handleWriteFailuresCollection:
          config.firestoreHandleWriteFailuresCollection,
      },
      controls: {
        pageLimit: config.backfillPageLimit,
        maxPageLimit: config.backfillMaxPageLimit,
        maxPages: config.backfillMaxPages,
        cacheLimit: config.backfillCacheLimit,
        maxPendingClaims: config.maxPendingClaims,
        maxInactiveVerifiedClaims: config.maxInactiveVerifiedClaims,
        maxRejectionTombstones: config.maxRejectionTombstones,
      },
    };

    logRunSummary(output.run);
    if (config.out) await writeJson(config.out, output);
    printBackfillSummary(output, config);
    return output;
  } finally {
    await terminateFirestore(db);
  }
}

export async function runBackfillCursors(db, config, dependencies = {}) {
  const totals = createBackfillTotals();
  const cursorSummaries = [];
  const sharedContext = {
    handleStateCache:
      dependencies.sharedContext?.handleStateCache ||
      createBoundedCache(config.backfillCacheLimit),
    mentionValidationCache:
      dependencies.sharedContext?.mentionValidationCache ||
      createBoundedCache(config.backfillCacheLimit),
  };

  for (const relay of config.relays) {
    let relayClient = null;
    const ownsRelayClient = !dependencies.queryRelay;

    if (ownsRelayClient) {
      try {
        relayClient = (dependencies.createRelayClient || createNdkRelayClient)(
          relay,
        );
        await relayClient.connect(config.timeoutMs);
      } catch (error) {
        safeCloseRelayClient(relayClient);
        for (const kind of IDENTITY_KINDS) {
          totals.relayKindCursors += 1;
          const summary = failedCursorSummary(relay, kind, error);
          addCursorSummary(totals, summary);
          cursorSummaries.push(summary);
        }
        continue;
      }
    }

    try {
      for (const kind of IDENTITY_KINDS) {
        totals.relayKindCursors += 1;
        let summary;
        try {
          summary = await runBackfillCursor(
            db,
            relay,
            kind,
            config,
            { ...dependencies, relayClient },
            sharedContext,
          );
        } catch (error) {
          summary = failedCursorSummary(relay, kind, error);
        }
        addCursorSummary(totals, summary);
        cursorSummaries.push(summary);
      }
    } finally {
      if (ownsRelayClient) safeCloseRelayClient(relayClient);
    }
  }

  return { totals, cursorSummaries };
}

export async function runBackfillCursor(
  db,
  relay,
  kind,
  config,
  dependencies = {},
  sharedContext = {},
) {
  let relayClient = dependencies.relayClient || null;
  const ownsRelayClient = !dependencies.queryRelay && !relayClient;
  if (ownsRelayClient) {
    relayClient = (dependencies.createRelayClient || createNdkRelayClient)(
      relay,
    );
    await relayClient.connect(config.timeoutMs);
  }
  const cursorDependencies = dependencies.queryRelay
    ? dependencies
    : {
        ...dependencies,
        queryRelay: (url, filter, options) =>
          queryRelay(url, filter, { ...options, client: relayClient }),
      };

  try {
    return await executeBackfillCursor(
      db,
      relay,
      kind,
      config,
      cursorDependencies,
      sharedContext,
    );
  } finally {
    if (ownsRelayClient) safeCloseRelayClient(relayClient);
  }
}

async function executeBackfillCursor(
  db,
  relay,
  kind,
  config,
  dependencies,
  sharedContext,
) {
  const stateRef = db
    .collection(config.firestoreStateCollection)
    .doc(backfillStateId(relay, kind, config.backfillStatePrefix));
  const previousState = config.backfillResume
    ? await readBackfillState(stateRef)
    : null;
  if (previousState?.status === "complete") {
    return completedCursorSummary(relay, kind, previousState);
  }

  const cursor = createCursorState(previousState, config);
  const stats = createCursorStats(relay, kind);
  const context = {
    eventIdsSeen: new Set(),
    handleStateCache:
      sharedContext.handleStateCache ||
      createBoundedCache(config.backfillCacheLimit),
    mentionValidationCache:
      sharedContext.mentionValidationCache ||
      createBoundedCache(config.backfillCacheLimit),
  };
  const queryRelayFn = dependencies.queryRelay || queryRelay;

  console.log(`  ${relay} kind:${kind} starting until=${cursor.cursorUntil}`);

  while (
    stats.pages < config.backfillMaxPages &&
    cursor.cursorUntil > config.backfillSince
  ) {
    const safeState = snapshotCursorState(cursor);
    const page = await fetchBackfillPage(
      queryRelayFn,
      relay,
      kind,
      cursor,
      config,
    );
    stats.pages += 1;
    stats.relayEvents += page.events.length;
    stats.lastReason = page.reason;

    if (!isSuccessfulRelayPage(page.reason)) {
      printPageProgress({
        page: stats.pages,
        maxPages: config.backfillMaxPages,
        events: page.events.length,
        reason: page.reason,
        cursorUntil: safeState.cursorUntil,
        pageLimit: safeState.pageLimit,
      });
      await writeCursorCheckpoint(db, relay, kind, safeState, config, {
        status: "retry_later",
        completed: false,
        lastReason: page.reason,
      });
      stats.retryPaused = true;
      break;
    }

    const processed = await processBackfillPage(
      db,
      page,
      relay,
      config,
      context,
    );
    addProcessedPageStats(stats, processed);
    if (page.reason === "max" && processed.validEvents.length === 0) {
      printPageProgress({
        page: stats.pages,
        maxPages: config.backfillMaxPages,
        events: page.events.length,
        valid: 0,
        reason: "page-contained-no-valid-events",
        cursorUntil: safeState.cursorUntil,
        pageLimit: safeState.pageLimit,
      });
      await writeCursorCheckpoint(db, relay, kind, safeState, config, {
        status: "retry_later",
        completed: false,
        lastReason: "page-contained-no-valid-events",
      });
      stats.lastReason = "page-contained-no-valid-events";
      stats.retryPaused = true;
      break;
    }
    const pageOldest = oldestCreatedAt(processed.validEvents);
    const pageResult = decidePageResult({
      page,
      pageOldest,
      relay,
      kind,
      cursor,
      config,
      cursorEvents: processed.validEvents,
    });

    const commitResult = await commitProcessedPage(
      db,
      processed,
      pageResult,
      relay,
      kind,
      page,
      config,
      context,
      safeState,
      cursor,
    );
    stats.directoryHandleWrites += commitResult.handlesWritten;
    stats.handleWriteFailures += commitResult.handlesFailed;
    stats.handleWriteDeadLetters += commitResult.handlesDeadLettered;
    printPageProgress({
      page: stats.pages,
      maxPages: config.backfillMaxPages,
      events: page.events.length,
      valid: processed.validEvents.length,
      oldest: pageOldest,
      claims: processed.claims.length,
      writes: commitResult.handlesWritten,
      reason: commitResult.retryPaused
        ? commitResult.lastReason
        : pageResult.reason || page.reason,
      cursorUntil: pageResult.nextState.cursorUntil,
      pageLimit: pageResult.nextState.pageLimit,
    });
    if (commitResult.retryPaused) {
      stats.retryPaused = true;
      stats.lastReason = commitResult.lastReason;
      break;
    }
    markEventsSeen(processed.freshEvents, context.eventIdsSeen);
    if (pageResult.gap) stats.gapsWritten += 1;
    Object.assign(cursor, pageResult.nextState);

    if (pageResult.completed) {
      stats.completed = true;
      break;
    }
  }

  await finalizePausedCursor(db, relay, kind, cursor, stats, config);
  printCursorSummary(stats);
  return {
    ...stats,
    cursorUntil: cursor.cursorUntil,
    oldestSeenAt: cursor.oldestSeenAt,
  };
}

export async function processBackfillPage(db, page, relay, config, context) {
  const validEvents = dedupeEvents(page.events).filter(isValidSignedEvent);
  const fresh = filterEventsNotSeen(validEvents, context.eventIdsSeen);
  const claims = await extractIdentityClaims(fresh.events, relay, new Date(), {
    mentionValidationCache: context.mentionValidationCache,
    xMentionCheckTimeoutMs: config.xMentionCheckTimeoutMs,
  });
  const planned = await planDirectoryHandleWrites(db, claims, {
    ...config,
    handleStateCache: context.handleStateCache,
  });
  return {
    validEvents,
    freshEvents: fresh.events,
    duplicateEventsSkipped: fresh.duplicateCount,
    claims,
    writes: planned.writes,
    planStats: planned.stats,
  };
}

async function fetchBackfillPage(queryRelayFn, relay, kind, cursor, config) {
  return queryRelayFn(
    relay,
    {
      kinds: [kind],
      since: config.backfillSince,
      until: cursor.cursorUntil,
    },
    { timeoutMs: config.timeoutMs, max: cursor.pageLimit },
  );
}

function decidePageResult({
  page,
  pageOldest,
  relay,
  kind,
  cursor,
  config,
  cursorEvents,
}) {
  if (
    page.reason === "eose" ||
    !pageOldest ||
    pageOldest <= config.backfillSince
  ) {
    return {
      completed: true,
      gap: null,
      reason: page.reason,
      nextState: {
        ...snapshotCursorState(cursor),
        cursorUntil: pageOldest
          ? Math.max(pageOldest - 1, config.backfillSince)
          : cursor.cursorUntil,
        oldestSeenAt: pageOldest
          ? Math.min(cursor.oldestSeenAt || pageOldest, pageOldest)
          : cursor.oldestSeenAt,
      },
    };
  }

  const decision = decideBackfillCursor({
    cursorUntil: cursor.cursorUntil,
    pageOldest,
    pageEvents: cursorEvents,
    boundaryTimestamp: cursor.boundaryTimestamp,
    boundarySeenIds: cursor.boundarySeenIds,
    stuckCount: cursor.stuckCount,
    pageLimit: cursor.pageLimit,
    defaultPageLimit: config.backfillPageLimit,
    maxPageLimit: config.backfillMaxPageLimit,
  });
  return {
    completed: false,
    reason: decision.reason || page.reason,
    gap: decision.gap ? { ...decision.gap, relay, kind } : null,
    nextState: {
      cursorUntil: decision.cursorUntil,
      oldestSeenAt: Math.min(cursor.oldestSeenAt || pageOldest, pageOldest),
      pageLimit: decision.pageLimit,
      boundaryTimestamp: decision.boundaryTimestamp,
      boundarySeenIds: decision.boundarySeenIds,
      stuckCount: decision.stuckCount,
    },
  };
}

async function commitProcessedPage(
  db,
  processed,
  pageResult,
  relay,
  kind,
  page,
  config,
  context,
  safeState,
  cursor,
) {
  const handleResult = await commitHandleWritesBestEffort(
    db,
    processed.writes,
    context.handleStateCache,
    { relay, kind, config, cursorUntil: cursor.cursorUntil },
  );

  // Pause only when a failed handle could not be dead-lettered (e.g. outage).
  // Poison-pill / schema failures are preserved as stringified payloadJson and
  // the cursor advances so one bad doc cannot stall the relay/kind forever.
  if (handleResult.deadLetterFailed > 0) {
    await writeCursorCheckpoint(db, relay, kind, safeState, config, {
      status: "retry_later",
      completed: false,
      lastReason: "handle-write-dead-letter-failed",
    });
    return {
      retryPaused: true,
      lastReason: "handle-write-dead-letter-failed",
      handlesWritten: handleResult.succeeded,
      handlesFailed: handleResult.failed,
      handlesDeadLettered: handleResult.deadLettered,
    };
  }

  if (pageResult.gap) {
    await commitFirestoreWrites(db, [
      buildBackfillGapWrite(pageResult.gap, config),
    ]);
  }
  await writeCursorCheckpoint(db, relay, kind, pageResult.nextState, config, {
    status: pageResult.completed ? "complete" : "running",
    completed: pageResult.completed,
    lastReason: pageResult.reason,
    pagesProcessed: 1,
    pageEvents: page.events.length,
    validPageEvents: processed.validEvents.length,
  });
  return {
    retryPaused: false,
    lastReason: pageResult.reason,
    handlesWritten: handleResult.succeeded,
    handlesFailed: handleResult.failed,
    handlesDeadLettered: handleResult.deadLettered,
  };
}

const HANDLE_WRITE_BATCH_SIZE = 50;

async function commitHandleWritesBestEffort(
  db,
  writes,
  handleStateCache,
  failureContext = {},
) {
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;
  let deadLetterFailed = 0;

  for (let i = 0; i < writes.length; i += HANDLE_WRITE_BATCH_SIZE) {
    const chunk = writes.slice(i, i + HANDLE_WRITE_BATCH_SIZE);
    const chunkResult = await commitHandleWriteChunk(
      db,
      chunk,
      handleStateCache,
      failureContext,
    );
    succeeded += chunkResult.succeeded;
    failed += chunkResult.failed;
    deadLettered += chunkResult.deadLettered;
    deadLetterFailed += chunkResult.deadLetterFailed;
  }

  return { succeeded, failed, deadLettered, deadLetterFailed };
}

async function commitHandleWriteChunk(
  db,
  writes,
  handleStateCache,
  failureContext,
) {
  if (!writes.length) {
    return { succeeded: 0, failed: 0, deadLettered: 0, deadLetterFailed: 0 };
  }

  try {
    await commitFirestoreWrites(
      db,
      writes.map((write) => ({
        collection: write.collection,
        id: write.id,
        data: write.data,
      })),
    );
    for (const write of writes) {
      if (handleStateCache && write.handle) {
        handleStateCache.set(write.handle, write.nextCacheState);
      }
    }
    return {
      succeeded: writes.length,
      failed: 0,
      deadLettered: 0,
      deadLetterFailed: 0,
    };
  } catch {
    // Batch failed — isolate poison docs by splitting / falling back.
    if (writes.length === 1) {
      return commitSingleHandleWrite(
        db,
        writes[0],
        handleStateCache,
        failureContext,
      );
    }
    const mid = Math.ceil(writes.length / 2);
    const left = await commitHandleWriteChunk(
      db,
      writes.slice(0, mid),
      handleStateCache,
      failureContext,
    );
    const right = await commitHandleWriteChunk(
      db,
      writes.slice(mid),
      handleStateCache,
      failureContext,
    );
    return {
      succeeded: left.succeeded + right.succeeded,
      failed: left.failed + right.failed,
      deadLettered: left.deadLettered + right.deadLettered,
      deadLetterFailed: left.deadLetterFailed + right.deadLetterFailed,
    };
  }
}

async function commitSingleHandleWrite(
  db,
  write,
  handleStateCache,
  failureContext,
) {
  try {
    await commitFirestoreWrites(db, [
      {
        collection: write.collection,
        id: write.id,
        data: write.data,
      },
    ]);
    if (handleStateCache && write.handle) {
      handleStateCache.set(write.handle, write.nextCacheState);
    }
    return { succeeded: 1, failed: 0, deadLettered: 0, deadLetterFailed: 0 };
  } catch (error) {
    if (handleStateCache && write.handle) {
      handleStateCache.delete(write.handle);
    }
    console.warn(
      `Handle write failed for ${write.id}: ${error?.message || error}`,
    );
    try {
      await commitFirestoreWrites(db, [
        buildHandleWriteFailureWrite(
          {
            write,
            error,
            relay: failureContext.relay,
            kind: failureContext.kind,
            cursorUntil: failureContext.cursorUntil,
          },
          failureContext.config || {},
        ),
      ]);
      return { succeeded: 0, failed: 1, deadLettered: 1, deadLetterFailed: 0 };
    } catch (deadLetterError) {
      console.warn(
        `Dead-letter write failed for ${write.id}: ${deadLetterError?.message || deadLetterError}`,
      );
      return { succeeded: 0, failed: 1, deadLettered: 0, deadLetterFailed: 1 };
    }
  }
}

async function writeCursorCheckpoint(db, relay, kind, state, config, details) {
  await commitFirestoreWrites(db, [
    buildBackfillCheckpointWrite({ relay, kind, ...state, ...details }, config),
  ]);
}

async function finalizePausedCursor(db, relay, kind, cursor, stats, config) {
  if (stats.completed || stats.retryPaused) return;
  if (cursor.cursorUntil <= config.backfillSince) {
    stats.completed = true;
    stats.lastReason ||= "reached-since";
    await writeCursorCheckpoint(db, relay, kind, cursor, config, {
      status: "complete",
      completed: true,
      lastReason: stats.lastReason,
    });
    return;
  }
  if (stats.pages >= config.backfillMaxPages) {
    stats.lastReason ||= "max-pages";
    await writeCursorCheckpoint(db, relay, kind, cursor, config, {
      status: "paused",
      completed: false,
      lastReason: stats.lastReason,
    });
  }
}

function createCursorState(previousState, config) {
  return {
    cursorUntil: previousState?.cursorUntil || config.backfillUntil,
    oldestSeenAt: previousState?.oldestSeenAt || null,
    pageLimit: previousState?.pageLimit || config.backfillPageLimit,
    boundaryTimestamp: previousState?.boundaryTimestamp || null,
    boundarySeenIds: previousState?.boundarySeenIds || [],
    stuckCount: previousState?.stuckCount || 0,
  };
}

function snapshotCursorState(cursor) {
  return {
    cursorUntil: cursor.cursorUntil,
    oldestSeenAt: cursor.oldestSeenAt,
    pageLimit: cursor.pageLimit,
    boundaryTimestamp: cursor.boundaryTimestamp,
    boundarySeenIds: [...cursor.boundarySeenIds],
    stuckCount: cursor.stuckCount,
  };
}

function createCursorStats(relay, kind) {
  return {
    relay,
    kind,
    pages: 0,
    relayEvents: 0,
    validEvents: 0,
    identityClaimsDiscovered: 0,
    directoryHandleWrites: 0,
    handleWriteFailures: 0,
    handleWriteDeadLetters: 0,
    claimsSkippedExisting: 0,
    claimsSkippedRejected: 0,
    duplicateEventsSkipped: 0,
    gapsWritten: 0,
    completed: false,
    retryPaused: false,
    lastReason: null,
  };
}

function completedCursorSummary(relay, kind, previousState) {
  return {
    ...createCursorStats(relay, kind),
    cursorUntil: previousState.cursorUntil,
    oldestSeenAt: previousState.oldestSeenAt,
    completed: true,
    lastReason: previousState.lastReason || "already-complete",
  };
}

function addProcessedPageStats(stats, processed) {
  stats.validEvents += processed.validEvents.length;
  stats.identityClaimsDiscovered += processed.claims.length;
  stats.claimsSkippedExisting += processed.planStats.claimsSkippedExisting;
  stats.claimsSkippedRejected += processed.planStats.claimsSkippedRejected;
  stats.duplicateEventsSkipped += processed.duplicateEventsSkipped;
}

function createBackfillTotals() {
  return {
    relayKindCursors: 0,
    pages: 0,
    relayEvents: 0,
    validEvents: 0,
    identityClaimsDiscovered: 0,
    directoryHandleWrites: 0,
    handleWriteFailures: 0,
    handleWriteDeadLetters: 0,
    claimsSkippedExisting: 0,
    claimsSkippedRejected: 0,
    duplicateEventsSkipped: 0,
    completedCursors: 0,
    failedCursors: 0,
    gapsWritten: 0,
  };
}

function addCursorSummary(totals, summary) {
  for (const key of [
    "pages",
    "relayEvents",
    "validEvents",
    "identityClaimsDiscovered",
    "directoryHandleWrites",
    "handleWriteFailures",
    "handleWriteDeadLetters",
    "claimsSkippedExisting",
    "claimsSkippedRejected",
    "duplicateEventsSkipped",
    "gapsWritten",
  ]) {
    totals[key] += summary[key] || 0;
  }
  if (summary.completed) totals.completedCursors += 1;
  if (summary.failed) totals.failedCursors += 1;
}

function failedCursorSummary(relay, kind, error) {
  return {
    ...createCursorStats(relay, kind),
    failed: true,
    lastReason: "cursor-error",
    error: error?.message || String(error),
    cursorUntil: null,
    oldestSeenAt: null,
  };
}

export function createBoundedCache(limit) {
  return new BoundedMap(limit);
}

class BoundedMap extends Map {
  constructor(limit) {
    super();
    this.limit = limit;
  }

  set(key, value) {
    if (this.has(key)) this.delete(key);
    super.set(key, value);
    while (this.size > this.limit) {
      this.delete(this.keys().next().value);
    }
    return this;
  }
}

function safeCloseRelayClient(client) {
  try {
    client?.close?.();
  } catch {}
}

async function readBackfillState(stateRef) {
  const snapshot = await stateRef.get();
  return snapshot.exists ? snapshot.data() || null : null;
}

function filterEventsNotSeen(events, seenEventIds) {
  const freshEvents = [];
  let duplicateCount = 0;
  for (const event of events) {
    if (seenEventIds.has(event.id)) duplicateCount += 1;
    else freshEvents.push(event);
  }
  return { events: freshEvents, duplicateCount };
}

function markEventsSeen(events, seenEventIds) {
  for (const event of events) seenEventIds.add(event.id);
}

function dedupeEvents(events) {
  const byId = new Map();
  for (const event of events) {
    if (event?.id) byId.set(event.id, event);
  }
  return [...byId.values()];
}

function oldestCreatedAt(events) {
  let oldest = null;
  for (const event of events) {
    if (!Number.isFinite(event?.created_at)) continue;
    oldest =
      oldest === null ? event.created_at : Math.min(oldest, event.created_at);
  }
  return oldest;
}

export function isSuccessfulRelayPage(reason) {
  return reason === "eose" || reason === "max";
}

export function decideBackfillCursor({
  cursorUntil,
  pageOldest,
  pageEvents,
  boundaryTimestamp,
  boundarySeenIds,
  stuckCount,
  pageLimit,
  defaultPageLimit,
  maxPageLimit,
}) {
  if (pageOldest < cursorUntil) {
    return {
      action: "progress",
      reason: "older-events-found",
      cursorUntil: pageOldest,
      pageLimit: defaultPageLimit,
      boundaryTimestamp: pageOldest,
      boundarySeenIds: eventIdsAtTimestamp(pageEvents, pageOldest),
      stuckCount: 0,
      gap: null,
    };
  }

  const currentBoundaryIds = eventIdsAtTimestamp(pageEvents, cursorUntil);
  const previousBoundaryIds =
    boundaryTimestamp === cursorUntil
      ? new Set(boundarySeenIds || [])
      : new Set();
  const mergedBoundaryIds = new Set([
    ...previousBoundaryIds,
    ...currentBoundaryIds,
  ]);
  const newBoundaryIds = currentBoundaryIds.filter(
    (id) => !previousBoundaryIds.has(id),
  );

  if (newBoundaryIds.length) {
    return {
      action: "drain-boundary",
      reason: "new-boundary-events-found",
      cursorUntil,
      pageLimit,
      boundaryTimestamp: cursorUntil,
      boundarySeenIds: [...mergedBoundaryIds],
      stuckCount: 0,
      gap: null,
    };
  }
  if (pageLimit < maxPageLimit) {
    return {
      action: "increase-limit",
      reason: "same-boundary-no-new-events",
      cursorUntil,
      pageLimit: Math.min(pageLimit * 2, maxPageLimit),
      boundaryTimestamp: cursorUntil,
      boundarySeenIds: [...mergedBoundaryIds],
      stuckCount: stuckCount + 1,
      gap: null,
    };
  }
  return {
    action: "skip-gap",
    reason: "stuck-same-timestamp",
    cursorUntil: cursorUntil - 1,
    pageLimit: defaultPageLimit,
    boundaryTimestamp: null,
    boundarySeenIds: [],
    stuckCount: 0,
    gap: {
      timestamp: cursorUntil,
      reason: "stuck_same_timestamp",
      pageLimit,
      seenEventIds: [...mergedBoundaryIds],
    },
  };
}

function eventIdsAtTimestamp(events, timestamp) {
  return dedupeEvents(events)
    .filter((event) => event.created_at === timestamp)
    .map((event) => event.id)
    .sort();
}

function numberFromEnv(env, name, fallback) {
  if (env[name] === undefined || env[name] === "") return fallback;
  return Number(env[name]);
}

/**
 * Resolve relay URLs: explicit RELAYS env wins; otherwise load from
 * RELAYS_FILE / relays.json (injectable via options for tests).
 */
export function resolveRelays(env = process.env, options = {}) {
  if (env.RELAYS) {
    const relays = String(env.RELAYS)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!relays.length) {
      throw new Error("RELAYS must not be empty when set.");
    }
    return relays;
  }

  const filePath =
    options.relaysFile || env.RELAYS_FILE || DEFAULT_RELAYS_FILE;
  const load = options.loadRelaysFromFile || loadRelaysFromFile;
  return load(filePath);
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be an integer >= 0.`);
  }
}

function printPageProgress({
  page,
  maxPages,
  events,
  valid,
  oldest,
  claims,
  writes,
  reason,
  cursorUntil,
  pageLimit,
}) {
  const parts = [
    `page=${page}/${maxPages}`,
    `events=${events}`,
    `limit=${pageLimit}`,
  ];
  if (valid !== undefined) parts.push(`valid=${valid}`);
  if (oldest != null) parts.push(`oldest=${oldest}`);
  if (claims !== undefined) parts.push(`claims=${claims}`);
  if (writes !== undefined) parts.push(`writes=${writes}`);
  if (cursorUntil != null) parts.push(`until=${cursorUntil}`);
  parts.push(`reason=${reason}`);
  console.log(`    ${parts.join(" ")}`);
}

function printCursorSummary(stats) {
  console.log(
    `    pages=${stats.pages} relayEvents=${stats.relayEvents} validEvents=${stats.validEvents} claims=${stats.identityClaimsDiscovered} handleWrites=${stats.directoryHandleWrites} status=${stats.completed ? "complete" : stats.retryPaused ? "retry_later" : "paused"}`,
  );
}

function printBackfillSummary(output, config) {
  console.log("\nBackfill complete.");
  console.log(`  relay/kind cursors:   ${output.stats.relayKindCursors}`);
  console.log(`  pages:                ${output.stats.pages}`);
  console.log(`  relay events:         ${output.stats.relayEvents}`);
  console.log(`  valid events:         ${output.stats.validEvents}`);
  console.log(
    `  identity claims:      ${output.stats.identityClaimsDiscovered}`,
  );
  console.log(`  handle docs written:  ${output.stats.directoryHandleWrites}`);
  console.log(`  handle write failures:${output.stats.handleWriteFailures}`);
  console.log(`  handle dead letters:  ${output.stats.handleWriteDeadLetters}`);
  console.log(`  duplicate skips:      ${output.stats.duplicateEventsSkipped}`);
  console.log(`  existing skips:       ${output.stats.claimsSkippedExisting}`);
  console.log(`  rejected skips:       ${output.stats.claimsSkippedRejected}`);
  console.log(`  gaps written:         ${output.stats.gapsWritten}`);
  console.log(`  completed cursors:    ${output.stats.completedCursors}`);
  console.log(`  failed cursors:       ${output.stats.failedCursors}`);
  console.log(`  firestore project:    ${config.firestoreProject}`);
  console.log(`  firestore handles:    ${config.firestoreHandlesCollection}`);
  console.log(`  firestore state:      ${config.firestoreStateCollection}`);
  if (config.out) console.log(`  output:               ${config.out}`);
}

runMain(import.meta.url, () => runBackfill(loadBackfillConfig()));
