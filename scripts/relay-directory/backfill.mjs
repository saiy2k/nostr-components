#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import {
  buildBackfillCheckpointWrite,
  buildBackfillGapWrite,
  buildRawEventIngestionWrites,
  isValidSignedEvent,
  queryRelay,
} from "./ingestion.mjs";
import {
  DEFAULT_RELAYS,
  IDENTITY_KINDS,
  buildRunSummaryWrite,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  logRunSummary,
  runCli,
  stripUndefined,
  takeOptionValue,
  writeJson,
} from "./runtime.mjs";

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
    else if (flag === "--firestore-backfill-runs-collection")
      args.firestoreBackfillRunsCollection = take();
    else if (flag === "--firestore-events-collection")
      args.firestoreEventsCollection = take();
    else if (flag === "--firestore-queue-collection")
      args.firestoreQueueCollection = take();
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
}

function printBackfillHelp() {
  console.log(`Usage: npm run crawl:directory:backfill -- [options]

Backfill signed Nostr kind:10011 and kind:0 events into Firestore.

Options:
  --relays <csv>                    Relays to query.
  --firestore-project <id>          GCP project. Defaults to GOOGLE_CLOUD_PROJECT.
  --firestore-database <id>         Firestore database. Default: (default)
  --backfill-page-limit <n>         Events per relay/kind page. Default: 500
  --backfill-max-page-limit <n>     Largest retry page. Default: 2000
  --backfill-max-pages <n>          Max pages per relay/kind. Default: 25
  --backfill-until <unix>           Starting cursor. Default: now
  --backfill-since <unix>           Stop cursor. Default: 0
  --no-backfill-resume              Ignore stored cursor state.
  --backfill-state-prefix <value>   Checkpoint namespace. Default: backfill
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
    uniqueEventsWritten: 0,
    completedCursors: 0,
    gapsWritten: 0,
  };
  const cursorSummaries = [];

  console.log(
    `Backfilling ${IDENTITY_KINDS.join(",")} from ${args.relays.length} relays into ${args.firestoreProject}/${args.firestoreDatabase}...`,
  );

  for (const relay of args.relays) {
    for (const kind of IDENTITY_KINDS) {
      totals.relayKindCursors += 1;
      const summary = await runBackfillCursor(db, relay, kind, args);
      totals.pages += summary.pages;
      totals.relayEvents += summary.relayEvents;
      totals.validEvents += summary.validEvents;
      totals.uniqueEventsWritten += summary.uniqueEventsWritten;
      totals.gapsWritten += summary.gapsWritten;
      if (summary.completed) totals.completedCursors += 1;
      cursorSummaries.push(summary);
    }
  }

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
      eventsCollection: args.firestoreEventsCollection,
      queueCollection: args.firestoreQueueCollection,
      stateCollection: args.firestoreStateCollection,
      gapsCollection: args.firestoreGapsCollection,
    },
  };

  await commitFirestoreWrites(db, [
    buildRunSummaryWrite(
      output.run,
      output,
      args.firestoreBackfillRunsCollection,
    ),
  ]);
  logRunSummary(output.run);

  if (args.out) await writeJson(args.out, output);
  printBackfillSummary(output, args);
  return output;
}

async function runBackfillCursor(db, relay, kind, args) {
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
      uniqueEventsWritten: 0,
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
  let uniqueEventsWritten = 0;
  let gapsWritten = 0;

  console.log(`  ${relay} kind:${kind} starting until=${until}`);

  while (pages < args.backfillMaxPages && until > args.backfillSince) {
    const page = await queryRelay(
      relay,
      { kinds: [kind], until },
      { timeoutMs: args.timeoutMs, max: pageLimit },
    );
    pages += 1;
    lastReason = page.reason;
    relayEvents += page.events.length;

    const valid = dedupeEvents(page.events).filter(isValidSignedEvent);
    validEvents += valid.length;
    uniqueEventsWritten += valid.length;

    const pageOldest = oldestCreatedAt(page.events);
    if (
      !page.events.length ||
      !pageOldest ||
      pageOldest <= args.backfillSince
    ) {
      await commitFirestoreWrites(db, [
        ...valid.flatMap((event) =>
          buildRawEventIngestionWrites(event, relay, "backfill", args),
        ),
        buildBackfillCheckpointWrite(
          {
            relay,
            kind,
            cursorUntil: pageOldest
              ? Math.max(pageOldest - 1, args.backfillSince)
              : until,
            oldestSeenAt: pageOldest
              ? Math.min(oldestSeenAt || pageOldest, pageOldest)
              : oldestSeenAt,
            pageEvents: page.events.length,
            validPageEvents: valid.length,
            lastReason,
            completed: true,
            pageLimit,
            boundaryTimestamp,
            boundarySeenIds: [...boundarySeenIds],
            stuckCount,
          },
          args,
        ),
      ]);
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
    until = decision.cursorUntil;
    pageLimit = decision.pageLimit;
    boundaryTimestamp = decision.boundaryTimestamp;
    boundarySeenIds = new Set(decision.boundarySeenIds);
    stuckCount = decision.stuckCount;
    oldestSeenAt = Math.min(oldestSeenAt || pageOldest, pageOldest);

    const writes = [
      ...valid.flatMap((event) =>
        buildRawEventIngestionWrites(event, relay, "backfill", args),
      ),
      buildBackfillCheckpointWrite(
        {
          relay,
          kind,
          cursorUntil: until,
          oldestSeenAt,
          pageEvents: page.events.length,
          validPageEvents: valid.length,
          lastReason: decision.reason || lastReason,
          completed: false,
          pageLimit,
          boundaryTimestamp,
          boundarySeenIds: [...boundarySeenIds],
          stuckCount,
        },
        args,
      ),
    ];

    if (decision.gap) {
      writes.push(
        buildBackfillGapWrite({ ...decision.gap, relay, kind }, args),
      );
      gapsWritten += 1;
    }

    await commitFirestoreWrites(db, writes);
  }

  if (pages >= args.backfillMaxPages && until > args.backfillSince) {
    console.log(`    paused after ${pages} page(s), resume cursor=${until}`);
  } else {
    completed = true;
  }

  await stateRef.set(
    stripUndefined({
      relay,
      kind,
      mode: "backfill",
      statePrefix: args.backfillStatePrefix,
      cursorUntil: until,
      oldestSeenAt,
      pageLimit,
      boundaryTimestamp,
      boundarySeenIds: [...boundarySeenIds],
      stuckCount,
      completed,
      status: completed ? "complete" : "paused",
      lastReason,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );

  console.log(
    `    pages=${pages} relayEvents=${relayEvents} validEvents=${validEvents} status=${completed ? "complete" : "paused"}`,
  );

  return {
    relay,
    kind,
    pages,
    relayEvents,
    validEvents,
    uniqueEventsWritten,
    gapsWritten,
    cursorUntil: until,
    oldestSeenAt,
    completed,
    lastReason,
  };
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
  console.log(`  event docs written:   ${output.stats.uniqueEventsWritten}`);
  console.log(`  gaps written:         ${output.stats.gapsWritten}`);
  console.log(`  completed cursors:    ${output.stats.completedCursors}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore events:     ${args.firestoreEventsCollection}`);
  console.log(`  firestore state:      ${args.firestoreStateCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

runCli(import.meta.url, parseBackfillArgs, runBackfill);
