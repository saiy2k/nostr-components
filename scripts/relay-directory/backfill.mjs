#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  buildBackfillCheckpointWrite,
  buildBackfillGapWrite,
  isValidSignedEvent,
  queryRelay,
} from "./ingestion.mjs";
import {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  DEFAULT_MAX_PENDING_CLAIMS,
  DEFAULT_MAX_REJECTION_TOMBSTONES,
  extractIdentityClaims,
  planDirectoryHandleWrites,
} from "./directory-state.mjs";
import {
  DEFAULT_RELAYS,
  IDENTITY_KINDS,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  logRunSummary,
  runCli,
  takeOptionValue,
  writeJson,
} from "./runtime.mjs";
import {
  canSpendFirestoreWrites,
  createFirestoreWriteBudget,
  estimateFirestoreWrites,
  remainingFirestoreWrites,
  spendFirestoreWrites,
} from "./write-budget.mjs";

const DEFAULT_BACKFILL_WRITE_BUDGET = 8000;
const EMERGENCY_CHECKPOINT_WRITE_RESERVE = 1;

export function parseBackfillArgs(argv) {
  const args = {
    ...firestoreConfigFromEnv(),
    relays: DEFAULT_RELAYS,
    out: null,
    timeoutMs: 12000,
    backfillPageLimit: Number(process.env.BACKFILL_PAGE_LIMIT || 500),
    backfillMaxPageLimit: Number(process.env.BACKFILL_MAX_PAGE_LIMIT || 2000),
    backfillMaxPages: Number(process.env.BACKFILL_MAX_PAGES || 25),
    backfillUntil: process.env.BACKFILL_UNTIL
      ? Number(process.env.BACKFILL_UNTIL)
      : Math.floor(Date.now() / 1000),
    backfillSince: process.env.BACKFILL_SINCE
      ? Number(process.env.BACKFILL_SINCE)
      : 0,
    backfillResume: process.env.BACKFILL_RESUME !== "0",
    backfillStatePrefix: process.env.BACKFILL_STATE_PREFIX || "backfill",
    backfillWriteBudget: Number(
      process.env.BACKFILL_WRITE_BUDGET || DEFAULT_BACKFILL_WRITE_BUDGET,
    ),
    backfillCheckpointInterval: Number(
      process.env.BACKFILL_CHECKPOINT_INTERVAL || 10,
    ),
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const take = () => {
      const result = takeOptionValue(argv, index, flag);
      index = result.nextIndex;
      return result.value;
    };

    if (flag === "--backfill") continue;
    if (flag === "--relays")
      args.relays = take()
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    else if (flag === "--out") args.out = take();
    else if (flag === "--no-json") args.out = null;
    else if (flag === "--timeout-ms") args.timeoutMs = Number(take());
    else if (flag === "--firestore-project") args.firestoreProject = take();
    else if (flag === "--firestore-database") args.firestoreDatabase = take();
    else if (flag === "--firestore-handles-collection")
      args.firestoreHandlesCollection = take();
    else if (flag === "--firestore-state-collection")
      args.firestoreStateCollection = take();
    else if (flag === "--firestore-gaps-collection")
      args.firestoreGapsCollection = take();
    else if (flag === "--backfill-page-limit")
      args.backfillPageLimit = Number(take());
    else if (flag === "--backfill-max-page-limit")
      args.backfillMaxPageLimit = Number(take());
    else if (flag === "--backfill-max-pages")
      args.backfillMaxPages = Number(take());
    else if (flag === "--backfill-until") args.backfillUntil = Number(take());
    else if (flag === "--backfill-since") args.backfillSince = Number(take());
    else if (flag === "--no-backfill-resume") args.backfillResume = false;
    else if (flag === "--backfill-state-prefix")
      args.backfillStatePrefix = take();
    else if (flag === "--backfill-write-budget")
      args.backfillWriteBudget = Number(take());
    else if (flag === "--no-backfill-write-budget")
      args.backfillWriteBudget = 0;
    else if (flag === "--backfill-checkpoint-interval")
      args.backfillCheckpointInterval = Number(take());
    else if (flag === "--max-pending-claims")
      args.maxPendingClaims = Number(take());
    else if (flag === "--max-inactive-verified-claims")
      args.maxInactiveVerifiedClaims = Number(take());
    else if (flag === "--max-rejection-tombstones")
      args.maxRejectionTombstones = Number(take());
    else if (flag === "--help" || flag === "-h") {
      printBackfillHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown backfill argument: ${flag}`);
    }
  }

  validateBackfillArgs(args);
  return args;
}

function validateBackfillArgs(args) {
  if (!args.firestoreProject) {
    throw new Error("--firestore-project or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!args.relays.length) throw new Error("At least one relay is required.");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be positive.");
  }
  if (!Number.isFinite(args.backfillPageLimit) || args.backfillPageLimit <= 0) {
    throw new Error("--backfill-page-limit must be positive.");
  }
  if (
    !Number.isFinite(args.backfillMaxPageLimit) ||
    args.backfillMaxPageLimit < args.backfillPageLimit
  ) {
    throw new Error(
      "--backfill-max-page-limit must be >= --backfill-page-limit.",
    );
  }
  if (!Number.isFinite(args.backfillMaxPages) || args.backfillMaxPages <= 0) {
    throw new Error("--backfill-max-pages must be positive.");
  }
  if (!Number.isFinite(args.backfillUntil) || args.backfillUntil <= 0) {
    throw new Error("--backfill-until must be a positive unix timestamp.");
  }
  if (!Number.isFinite(args.backfillSince) || args.backfillSince < 0) {
    throw new Error("--backfill-since must be a unix timestamp >= 0.");
  }
  if (!args.backfillStatePrefix || /[\/#?]/.test(args.backfillStatePrefix)) {
    throw new Error(
      "--backfill-state-prefix must be non-empty and must not contain /, #, or ?.",
    );
  }
  if (
    !Number.isFinite(args.backfillWriteBudget) ||
    args.backfillWriteBudget < 0
  ) {
    throw new Error("--backfill-write-budget must be >= 0.");
  }
  if (
    !Number.isFinite(args.backfillCheckpointInterval) ||
    args.backfillCheckpointInterval <= 0
  ) {
    throw new Error("--backfill-checkpoint-interval must be positive.");
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
}

function printBackfillHelp() {
  console.log(`Usage: npm run crawl:directory:backfill -- [options]

Backfill X-linked Nostr identity claims into Firestore directory handles.

Options:
  --relays <csv>                    Relays to query.
  --firestore-project <id>          GCP project. Defaults to GOOGLE_CLOUD_PROJECT.
  --firestore-database <id>         Firestore database. Default: (default)
  --firestore-handles-collection <name>
                                    Directory handle collection.
  --backfill-page-limit <n>         Events per relay/kind page. Default: 500
  --backfill-max-page-limit <n>     Largest retry page. Default: 2000
  --backfill-max-pages <n>          Max pages per relay/kind. Default: 25
  --backfill-until <unix>           Starting cursor. Default: now
  --backfill-since <unix>           Stop cursor. Default: 0
  --no-backfill-resume              Ignore stored cursor state.
  --backfill-state-prefix <value>   Checkpoint namespace. Default: backfill
  --backfill-write-budget <n>       Maximum writes per run. Default: 8000; 0 disables.
  --backfill-checkpoint-interval <n>
                                    Write cursor checkpoints every n pages. Default: 10
  --max-pending-claims <n>          Pending claims retained per handle. Default: 20
  --max-inactive-verified-claims <n>
                                    Historical verified claims retained. Default: 10
  --max-rejection-tombstones <n>    Compact rejected IDs retained. Default: 100
  --out <file>                      Optional JSON run summary.
`);
}

export async function runBackfill(args, FirestoreCtor) {
  const runMetrics = createRunMetrics("backfill");
  const db = await createFirestore(args, FirestoreCtor);
  const startedAt = new Date().toISOString();
  const totals = {
    relayKindCursors: 0,
    pages: 0,
    relayEvents: 0,
    validEvents: 0,
    identityClaimsDiscovered: 0,
    directoryHandleWrites: 0,
    claimsSkippedExisting: 0,
    claimsSkippedRejected: 0,
    duplicateEventsSkipped: 0,
    completedCursors: 0,
    gapsWritten: 0,
    estimatedFirestoreWrites: 0,
  };
  const cursorSummaries = [];
  const runContext = {
    eventIdsSeenThisRun: new Set(),
    handleStateCache: new Map(),
    writeBudget: createFirestoreWriteBudget(args.backfillWriteBudget),
    quotaPaused: false,
  };

  console.log(
    `Backfilling ${IDENTITY_KINDS.join(",")} from ${args.relays.length} relays into ${args.firestoreProject}/${args.firestoreDatabase}...`,
  );
  if (args.backfillWriteBudget > 0) {
    console.log(
      `  Firestore write budget: ${args.backfillWriteBudget} per run`,
    );
  }

  relayLoop: for (const relay of args.relays) {
    for (const kind of IDENTITY_KINDS) {
      totals.relayKindCursors += 1;
      const summary = await runBackfillCursor(
        db,
        relay,
        kind,
        args,
        runContext,
      );
      totals.pages += summary.pages;
      totals.relayEvents += summary.relayEvents;
      totals.validEvents += summary.validEvents;
      totals.identityClaimsDiscovered += summary.identityClaimsDiscovered;
      totals.directoryHandleWrites += summary.directoryHandleWrites;
      totals.claimsSkippedExisting += summary.claimsSkippedExisting;
      totals.claimsSkippedRejected += summary.claimsSkippedRejected;
      totals.duplicateEventsSkipped += summary.duplicateEventsSkipped;
      totals.gapsWritten += summary.gapsWritten;
      totals.estimatedFirestoreWrites = runContext.writeBudget.used;
      if (summary.completed) totals.completedCursors += 1;
      cursorSummaries.push(summary);
      if (runContext.quotaPaused) break relayLoop;
    }
  }

  totals.estimatedFirestoreWrites = runContext.writeBudget.used;

  const output = {
    mode: "backfill",
    run: finishRunMetrics(runMetrics, totals),
    startedAt,
    finishedAt: new Date().toISOString(),
    relays: args.relays,
    kinds: IDENTITY_KINDS,
    stats: totals,
    cursors: cursorSummaries,
    firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      handlesCollection: args.firestoreHandlesCollection,
      stateCollection: args.firestoreStateCollection,
      gapsCollection: args.firestoreGapsCollection,
    },
    controls: {
      writeBudget: args.backfillWriteBudget,
      checkpointInterval: args.backfillCheckpointInterval,
      maxPendingClaims: args.maxPendingClaims,
      maxInactiveVerifiedClaims: args.maxInactiveVerifiedClaims,
      maxRejectionTombstones: args.maxRejectionTombstones,
      quotaPaused: runContext.quotaPaused,
    },
  };

  logRunSummary(output.run);

  if (args.out) await writeJson(args.out, output);
  printBackfillSummary(output, args);
  return output;
}

async function runBackfillCursor(db, relay, kind, args, context) {
  const stateRef = db
    .collection(args.firestoreStateCollection)
    .doc(backfillStateId(relay, kind, args.backfillStatePrefix));
  const previousState = args.backfillResume
    ? await readBackfillState(stateRef)
    : null;

  if (previousState?.status === "complete") {
    console.log(
      `  ${relay} kind:${kind} already complete; use --no-backfill-resume to recrawl.`,
    );
    return {
      relay,
      kind,
      pages: 0,
      relayEvents: 0,
      validEvents: 0,
      identityClaimsDiscovered: 0,
      directoryHandleWrites: 0,
      claimsSkippedExisting: 0,
      claimsSkippedRejected: 0,
      duplicateEventsSkipped: 0,
      gapsWritten: 0,
      cursorUntil: previousState.cursorUntil,
      oldestSeenAt: previousState.oldestSeenAt,
      completed: true,
      lastReason: previousState.lastReason || "already-complete",
    };
  }

  let until = previousState?.cursorUntil || args.backfillUntil;
  let pageLimit = previousState?.pageLimit || args.backfillPageLimit;
  let boundaryTimestamp = previousState?.boundaryTimestamp || null;
  let boundarySeenIds = new Set(previousState?.boundarySeenIds || []);
  let stuckCount = previousState?.stuckCount || 0;
  let completed = false;
  let lastReason = null;
  let oldestSeenAt = previousState?.oldestSeenAt || null;
  let pages = 0;
  let relayEvents = 0;
  let validEvents = 0;
  let identityClaimsDiscovered = 0;
  let directoryHandleWrites = 0;
  let claimsSkippedExisting = 0;
  let claimsSkippedRejected = 0;
  let duplicateEventsSkipped = 0;
  let gapsWritten = 0;
  let retryPaused = false;
  const pendingCheckpoint = createPendingCheckpoint();

  console.log(`  ${relay} kind:${kind} starting until=${until}`);

  while (pages < args.backfillMaxPages && until > args.backfillSince) {
    const stateBeforePage = {
      cursorUntil: until,
      oldestSeenAt,
      pageLimit,
      boundaryTimestamp,
      boundarySeenIds: [...boundarySeenIds],
      stuckCount,
    };
    const page = await queryRelay(
      relay,
      { kinds: [kind], since: args.backfillSince, until },
      { timeoutMs: args.timeoutMs, max: pageLimit },
    );
    pages += 1;
    lastReason = page.reason;
    relayEvents += page.events.length;

    if (!isSuccessfulRelayPage(page.reason)) {
      retryPaused = true;
      console.warn(
        `    ${relay} kind:${kind} ${page.reason}; keeping cursor=${until} for retry.`,
      );
      await flushCursorCheckpoint({
        db,
        relay,
        kind,
        args,
        context,
        state: stateBeforePage,
        pendingCheckpoint,
        completed: false,
        status: "retry_later",
        lastReason: page.reason,
      });
      break;
    }

    const valid = dedupeEvents(page.events).filter(isValidSignedEvent);
    validEvents += valid.length;
    const fresh = filterEventsNotSeenThisRun(
      valid,
      context.eventIdsSeenThisRun,
    );
    const claims = extractIdentityClaims(fresh.events, relay);
    identityClaimsDiscovered += claims.length;
    const planned = await planDirectoryHandleWrites(db, claims, {
      ...args,
      handleStateCache: context.handleStateCache,
    });
    claimsSkippedExisting += planned.stats.claimsSkippedExisting;
    claimsSkippedRejected += planned.stats.claimsSkippedRejected;

    const pageOldest = oldestCreatedAt(page.events);
    if (page.reason === "eose" || pageOldest <= args.backfillSince) {
      const terminalState = {
        cursorUntil: pageOldest
          ? Math.max(pageOldest - 1, args.backfillSince)
          : until,
        oldestSeenAt: pageOldest
          ? Math.min(oldestSeenAt || pageOldest, pageOldest)
          : oldestSeenAt,
        pageLimit,
        boundaryTimestamp,
        boundarySeenIds: [...boundarySeenIds],
        stuckCount,
      };
      const currentPageCounters = createPageCheckpointCounters(
        page.events.length,
        valid.length,
      );
      const checkpointWrites = [
        buildBackfillCheckpointWrite(
          {
            relay,
            kind,
            ...terminalState,
            ...combineCheckpointCounters(
              pendingCheckpoint,
              currentPageCounters,
            ),
            lastReason,
            completed: true,
            status: "complete",
          },
          args,
        ),
      ];
      const committed = await commitCursorPageWritesOrPause({
        db,
        candidateWrites: planned.writes,
        cursorWrites: checkpointWrites,
        relay,
        kind,
        args,
        context,
        safeState: stateBeforePage,
        pendingCheckpoint,
        lastReason: "write-budget-exhausted",
      });
      if (!committed) {
        lastReason = "write-budget-exhausted";
        break;
      }
      markEventsSeenThisRun(fresh.events, context.eventIdsSeenThisRun);
      duplicateEventsSkipped += fresh.duplicateCount;
      directoryHandleWrites += planned.writes.length;
      resetPendingCheckpoint(pendingCheckpoint);
      until = terminalState.cursorUntil;
      oldestSeenAt = terminalState.oldestSeenAt;
      completed = true;
      break;
    }

    const decision = decideBackfillCursor({
      cursorUntil: until,
      pageOldest,
      pageEvents: page.events,
      boundaryTimestamp,
      boundarySeenIds,
      stuckCount,
      pageLimit,
      defaultPageLimit: args.backfillPageLimit,
      maxPageLimit: args.backfillMaxPageLimit,
    });
    const nextState = {
      cursorUntil: decision.cursorUntil,
      oldestSeenAt: Math.min(oldestSeenAt || pageOldest, pageOldest),
      pageLimit: decision.pageLimit,
      boundaryTimestamp: decision.boundaryTimestamp,
      boundarySeenIds: decision.boundarySeenIds,
      stuckCount: decision.stuckCount,
    };
    const currentPageCounters = createPageCheckpointCounters(
      page.events.length,
      valid.length,
    );
    const shouldCheckpoint =
      pendingCheckpoint.pagesProcessed + currentPageCounters.pagesProcessed >=
        args.backfillCheckpointInterval || Boolean(decision.gap);
    const cursorWrites = [];

    if (decision.gap) {
      cursorWrites.push(
        buildBackfillGapWrite({ ...decision.gap, relay, kind }, args),
      );
    }

    if (shouldCheckpoint) {
      cursorWrites.push(
        buildBackfillCheckpointWrite(
          {
            relay,
            kind,
            ...nextState,
            ...combineCheckpointCounters(
              pendingCheckpoint,
              currentPageCounters,
            ),
            lastReason: decision.reason || lastReason,
            completed: false,
            status: "running",
          },
          args,
        ),
      );
    }

    const committed = await commitCursorPageWritesOrPause({
      db,
      candidateWrites: planned.writes,
      cursorWrites,
      relay,
      kind,
      args,
      context,
      safeState: stateBeforePage,
      pendingCheckpoint,
      lastReason: "write-budget-exhausted",
    });
    if (!committed) {
      lastReason = "write-budget-exhausted";
      break;
    }

    markEventsSeenThisRun(fresh.events, context.eventIdsSeenThisRun);
    duplicateEventsSkipped += fresh.duplicateCount;
    directoryHandleWrites += planned.writes.length;
    if (decision.gap) gapsWritten += 1;
    until = nextState.cursorUntil;
    pageLimit = nextState.pageLimit;
    boundaryTimestamp = nextState.boundaryTimestamp;
    boundarySeenIds = new Set(nextState.boundarySeenIds);
    stuckCount = nextState.stuckCount;
    oldestSeenAt = nextState.oldestSeenAt;

    if (shouldCheckpoint) {
      resetPendingCheckpoint(pendingCheckpoint);
    } else {
      addPendingCheckpoint(pendingCheckpoint, currentPageCounters);
    }
  }

  if (!completed && !context.quotaPaused && until <= args.backfillSince) {
    await flushCursorCheckpoint({
      db,
      relay,
      kind,
      args,
      context,
      state: {
        cursorUntil: until,
        oldestSeenAt,
        pageLimit,
        boundaryTimestamp,
        boundarySeenIds: [...boundarySeenIds],
        stuckCount,
      },
      pendingCheckpoint,
      completed: true,
      status: "complete",
      lastReason: lastReason || "reached-since",
    });
    completed = true;
  } else if (
    !completed &&
    !context.quotaPaused &&
    !retryPaused &&
    pages >= args.backfillMaxPages &&
    until > args.backfillSince
  ) {
    await flushCursorCheckpoint({
      db,
      relay,
      kind,
      args,
      context,
      state: {
        cursorUntil: until,
        oldestSeenAt,
        pageLimit,
        boundaryTimestamp,
        boundarySeenIds: [...boundarySeenIds],
        stuckCount,
      },
      pendingCheckpoint,
      completed: false,
      status: "paused",
      lastReason: lastReason || "max-pages",
    });
    console.log(`    paused after ${pages} page(s), resume cursor=${until}`);
  }

  console.log(
    `    pages=${pages} relayEvents=${relayEvents} validEvents=${validEvents} claims=${identityClaimsDiscovered} handleWrites=${directoryHandleWrites} status=${completed ? "complete" : retryPaused ? "retry_later" : "paused"}`,
  );

  return {
    relay,
    kind,
    pages,
    relayEvents,
    validEvents,
    identityClaimsDiscovered,
    directoryHandleWrites,
    claimsSkippedExisting,
    claimsSkippedRejected,
    duplicateEventsSkipped,
    gapsWritten,
    cursorUntil: until,
    oldestSeenAt,
    completed,
    lastReason,
  };
}

async function commitCursorPageWritesOrPause({
  db,
  candidateWrites,
  cursorWrites,
  relay,
  kind,
  args,
  context,
  safeState,
  pendingCheckpoint,
  lastReason,
}) {
  const estimatedWrites =
    estimateFirestoreWrites(candidateWrites) +
    estimateFirestoreWrites(cursorWrites);
  if (
    canSpendFirestoreWrites(context.writeBudget, estimatedWrites, {
      reserve: EMERGENCY_CHECKPOINT_WRITE_RESERVE,
    })
  ) {
    await commitBudgetedFirestoreWrites(db, candidateWrites, context);
    await commitBudgetedFirestoreWrites(db, cursorWrites, context);
    return true;
  }

  context.quotaPaused = true;
  console.log(
    `    pausing before ${estimatedWrites} Firestore write(s); ${remainingFirestoreWrites(context.writeBudget, { reserve: EMERGENCY_CHECKPOINT_WRITE_RESERVE })} write(s) remain before the emergency-checkpoint reserve.`,
  );

  await flushCursorCheckpoint({
    db,
    relay,
    kind,
    args,
    context,
    state: safeState,
    pendingCheckpoint,
    completed: false,
    status: "paused",
    lastReason,
  });
  return false;
}

async function flushCursorCheckpoint({
  db,
  relay,
  kind,
  args,
  context,
  state,
  pendingCheckpoint,
  completed,
  status,
  lastReason,
}) {
  const writes = [
    buildBackfillCheckpointWrite(
      {
        relay,
        kind,
        ...state,
        ...pendingCheckpoint,
        lastReason,
        completed,
        status,
      },
      args,
    ),
  ];

  if (!canSpendFirestoreWrites(context.writeBudget, writes)) {
    context.quotaPaused = true;
    return false;
  }

  await commitBudgetedFirestoreWrites(db, writes, context);
  resetPendingCheckpoint(pendingCheckpoint);
  return true;
}

async function commitBudgetedFirestoreWrites(db, writes, context) {
  if (!writes.length) return 0;
  await commitFirestoreWrites(db, writes);
  return spendFirestoreWrites(context.writeBudget, writes);
}

function filterEventsNotSeenThisRun(events, seenEventIds) {
  const freshEvents = [];
  let duplicateCount = 0;
  for (const event of events) {
    if (seenEventIds.has(event.id)) {
      duplicateCount += 1;
    } else {
      freshEvents.push(event);
    }
  }
  return { events: freshEvents, duplicateCount };
}

function markEventsSeenThisRun(events, seenEventIds) {
  for (const event of events) seenEventIds.add(event.id);
}

function createPendingCheckpoint() {
  return {
    pagesProcessed: 0,
    pageEvents: 0,
    validPageEvents: 0,
  };
}

function createPageCheckpointCounters(pageEvents, validPageEvents) {
  return {
    pagesProcessed: 1,
    pageEvents,
    validPageEvents,
  };
}

function combineCheckpointCounters(left, right) {
  return {
    pagesProcessed: left.pagesProcessed + right.pagesProcessed,
    pageEvents: left.pageEvents + right.pageEvents,
    validPageEvents: left.validPageEvents + right.validPageEvents,
  };
}

function addPendingCheckpoint(pendingCheckpoint, counters) {
  pendingCheckpoint.pagesProcessed += counters.pagesProcessed;
  pendingCheckpoint.pageEvents += counters.pageEvents;
  pendingCheckpoint.validPageEvents += counters.validPageEvents;
}

function resetPendingCheckpoint(pendingCheckpoint) {
  pendingCheckpoint.pagesProcessed = 0;
  pendingCheckpoint.pageEvents = 0;
  pendingCheckpoint.validPageEvents = 0;
}

async function readBackfillState(stateRef) {
  const snapshot = await stateRef.get();
  return snapshot.exists ? snapshot.data() || null : null;
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
      relay: null,
      kind: null,
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

function backfillStateId(relay, kind, prefix) {
  return `${prefix}:${relay}:kind:${kind}`.replace(/[/.#[\]]/g, "_");
}

function printBackfillSummary(output, args) {
  console.log("\nBackfill complete.");
  console.log(`  relay/kind cursors:   ${output.stats.relayKindCursors}`);
  console.log(`  pages:                ${output.stats.pages}`);
  console.log(`  relay events:         ${output.stats.relayEvents}`);
  console.log(`  valid events:         ${output.stats.validEvents}`);
  console.log(
    `  identity claims:      ${output.stats.identityClaimsDiscovered}`,
  );
  console.log(`  handle docs written:  ${output.stats.directoryHandleWrites}`);
  console.log(`  duplicate skips:      ${output.stats.duplicateEventsSkipped}`);
  console.log(`  existing skips:       ${output.stats.claimsSkippedExisting}`);
  console.log(`  rejected skips:       ${output.stats.claimsSkippedRejected}`);
  console.log(`  gaps written:         ${output.stats.gapsWritten}`);
  console.log(`  completed cursors:    ${output.stats.completedCursors}`);
  console.log(
    `  estimated writes:     ${output.stats.estimatedFirestoreWrites}`,
  );
  console.log(
    `  write budget:         ${output.controls.writeBudget || "unlimited"}`,
  );
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore handles:    ${args.firestoreHandlesCollection}`);
  console.log(`  firestore state:      ${args.firestoreStateCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

runCli(import.meta.url, parseBackfillArgs, runBackfill);
