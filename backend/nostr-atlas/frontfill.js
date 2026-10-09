#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  commitHandleWritesBestEffort,
  decideBackfillCursor,
  isPermanentRelayKindUnsupported,
  processBackfillPage,
  resolveRelays,
} from "./backfill.js";
import { queryRelay as defaultQueryRelay } from "./ingestion.js";
import {
  IDENTITY_KINDS,
  createFirestore,
  runMain,
  terminateFirestore,
} from "./runtime.js";
import { backfillStateId, numberFromEnv } from "./utils.js";

export const FRONTFILL_STATE_PREFIX = "frontfill";
export const FRONTFILL_RUN_DOC_ID = "frontfill-run";
export const FRONTFILL_PAGE_LIMIT = 250;
export const FRONTFILL_MAX_PAGE_LIMIT = 1000;
export const FRONTFILL_LIVE_MAX_PAGES = 4;
export const FRONTFILL_GAP_MAX_PAGES = 2;
export const FRONTFILL_TIMEOUT_MS = 12000;
export const FRONTFILL_OVERLAP_SECONDS = 15 * 60;
export const FRONTFILL_LIVE_WINDOW_SECONDS = 60 * 60;
export const FRONTFILL_INITIAL_LOOKBACK_SECONDS = 90 * 24 * 60 * 60;
export const FRONTFILL_RUN_DEADLINE_MS = 20 * 60 * 1000;

const LIVE_IN_PROGRESS = new Set(["running", "retry_later", "failed"]);

export function loadFrontfillConfig(
  env = process.env,
  nowSec = Math.floor(Date.now() / 1000),
  options = {},
) {
  const config = {
    firestoreProject:
      env.FIRESTORE_PROJECT || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || null,
    firestoreDatabase: env.FIRESTORE_DATABASE || "(default)",
    firestoreHandlesCollection:
      env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
    firestoreStateCollection: env.FIRESTORE_STATE_COLLECTION || "relayCrawlerState",
    firestoreHandleWriteFailuresCollection:
      env.FIRESTORE_HANDLE_WRITE_FAILURES_COLLECTION ||
      "nostrDirectoryHandleWriteFailures",
    relays: options.relays || resolveRelays(env, options),
    kinds: IDENTITY_KINDS,
    nowSec,
    statePrefix: env.FRONTFILL_STATE_PREFIX || FRONTFILL_STATE_PREFIX,
    pageLimit: numberFromEnv(env, "FRONTFILL_PAGE_LIMIT", FRONTFILL_PAGE_LIMIT),
    maxPageLimit: numberFromEnv(env, "FRONTFILL_MAX_PAGE_LIMIT", FRONTFILL_MAX_PAGE_LIMIT),
    liveMaxPages: numberFromEnv(env, "FRONTFILL_LIVE_MAX_PAGES", FRONTFILL_LIVE_MAX_PAGES),
    gapMaxPages: numberFromEnv(env, "FRONTFILL_GAP_MAX_PAGES", FRONTFILL_GAP_MAX_PAGES),
    timeoutMs: numberFromEnv(env, "FRONTFILL_TIMEOUT_MS", FRONTFILL_TIMEOUT_MS),
    overlapSeconds: numberFromEnv(env, "FRONTFILL_OVERLAP_SECONDS", FRONTFILL_OVERLAP_SECONDS),
    liveWindowSeconds: numberFromEnv(
      env,
      "FRONTFILL_LIVE_WINDOW_SECONDS",
      FRONTFILL_LIVE_WINDOW_SECONDS,
    ),
    initialLookbackSeconds: numberFromEnv(
      env,
      "FRONTFILL_INITIAL_LOOKBACK_SECONDS",
      FRONTFILL_INITIAL_LOOKBACK_SECONDS,
    ),
    runDeadlineMs: numberFromEnv(env, "FRONTFILL_RUN_DEADLINE_MS", FRONTFILL_RUN_DEADLINE_MS),
    maxPendingClaims: numberFromEnv(env, "MAX_PENDING_CLAIMS", 20),
    maxInactiveVerifiedClaims: numberFromEnv(env, "MAX_INACTIVE_VERIFIED_CLAIMS", 10),
    maxRejectionTombstones: numberFromEnv(env, "MAX_REJECTION_TOMBSTONES", 100),
    xMentionCheckTimeoutMs: numberFromEnv(env, "X_MENTION_CHECK_TIMEOUT_MS", 5000),
  };
  validateFrontfillConfig(config);
  return config;
}

function validateFrontfillConfig(config) {
  if (!config.firestoreProject) {
    throw new Error("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!config.relays.length) throw new Error("RELAYS must not be empty.");
  if (!config.statePrefix || /[/ #?]/.test(config.statePrefix)) {
    throw new Error(
      "FRONTFILL_STATE_PREFIX must be non-empty and must not contain /, #, or ?.",
    );
  }
  positiveInteger(config.pageLimit, "FRONTFILL_PAGE_LIMIT");
  positiveInteger(config.maxPageLimit, "FRONTFILL_MAX_PAGE_LIMIT");
  if (config.maxPageLimit < config.pageLimit) {
    throw new Error("FRONTFILL_MAX_PAGE_LIMIT must be >= FRONTFILL_PAGE_LIMIT.");
  }
  positiveInteger(config.liveMaxPages, "FRONTFILL_LIVE_MAX_PAGES");
  positiveInteger(config.gapMaxPages, "FRONTFILL_GAP_MAX_PAGES");
  positiveInteger(config.timeoutMs, "FRONTFILL_TIMEOUT_MS");
  positiveInteger(config.overlapSeconds, "FRONTFILL_OVERLAP_SECONDS");
  positiveInteger(config.liveWindowSeconds, "FRONTFILL_LIVE_WINDOW_SECONDS");
  nonNegativeInteger(config.initialLookbackSeconds, "FRONTFILL_INITIAL_LOOKBACK_SECONDS");
  nonNegativeInteger(config.runDeadlineMs, "FRONTFILL_RUN_DEADLINE_MS");
  positiveInteger(config.xMentionCheckTimeoutMs, "X_MENTION_CHECK_TIMEOUT_MS");
  for (const [name, value] of [
    ["MAX_PENDING_CLAIMS", config.maxPendingClaims],
    ["MAX_INACTIVE_VERIFIED_CLAIMS", config.maxInactiveVerifiedClaims],
    ["MAX_REJECTION_TOMBSTONES", config.maxRejectionTombstones],
  ]) {
    nonNegativeInteger(value, name);
  }
}

/**
 * Live windows stay about an hour long. A saved in-progress window keeps its
 * own end so a page budget does not jump ahead, and the next finished window
 * overlaps `syncedUntil` by 15 minutes.
 */
export function resumeLive(state, nowSec, config) {
  if (state?.status === "unsupported") {
    return { skip: true, reason: "unsupported" };
  }
  const inProgress =
    state?.liveInProgress === true &&
    LIVE_IN_PROGRESS.has(state.status) &&
    Number.isInteger(state.windowEnd);
  const windowEnd = inProgress ? state.windowEnd : nowSec;
  let windowStart = inProgress ? state.windowStart : null;
  if (!Number.isInteger(windowStart)) {
    windowStart =
      state?.syncedUntil == null
        ? windowEnd - config.liveWindowSeconds
        : state.syncedUntil - config.overlapSeconds;
  }
  if (windowEnd < windowStart) windowStart = windowEnd;
  const cursor = inProgress
    ? cursorFrom(state, windowEnd, config.pageLimit)
    : freshCursor(windowEnd, config.pageLimit);
  return { skip: false, windowStart, windowEnd, cursor };
}

/** Gap fields are written once, on the first cursor create. Lookback 0 stores none. */
export function gapSeed(nowSec, windowStart, lookbackSeconds) {
  if (!Number.isInteger(lookbackSeconds) || lookbackSeconds <= 0) return {};
  const gapFloor = nowSec - lookbackSeconds;
  const gapUntil = windowStart;
  if (gapUntil <= gapFloor) return { gapDone: true };
  return {
    gapDone: false,
    gapFloor,
    gapUntil,
    gapCursorUntil: gapUntil,
  };
}

export function gapIsOpen(state) {
  if (!state || state.gapDone === true) return false;
  return (
    Number.isInteger(state.gapUntil) &&
    Number.isInteger(state.gapFloor) &&
    state.gapUntil > state.gapFloor
  );
}

/** The historical walk waits until this relay/kind's live window is complete. */
export function resumeGap(state, config) {
  if (state?.status === "unsupported") return { skip: true, reason: "unsupported" };
  if (state?.liveInProgress === true || state?.status !== "complete") {
    return { skip: true, reason: "live-open" };
  }
  if (!gapIsOpen(state)) return { skip: true, reason: "gap-done" };
  const windowStart = state.gapFloor;
  const windowEnd = state.gapUntil;
  const inProgress =
    state.gapInProgress === true && Number.isInteger(state.gapCursorUntil);
  const cursor = inProgress
    ? {
        cursorUntil: state.gapCursorUntil,
        pageLimit: state.gapPageLimit || config.pageLimit,
        boundaryTimestamp: state.gapBoundaryTimestamp ?? null,
        boundarySeenIds: state.gapBoundarySeenIds || [],
        stuckCount: state.gapStuckCount || 0,
      }
    : freshCursor(
        Number.isInteger(state.gapCursorUntil) ? state.gapCursorUntil : windowEnd,
        config.pageLimit,
      );
  return { skip: false, windowStart, windowEnd, cursor };
}

export function planFrontfillCursor({
  page,
  cursor,
  windowStart,
  defaultPageLimit,
  maxPageLimit,
}) {
  const reason = page?.reason || "unknown";
  if (isPermanentRelayKindUnsupported(reason)) {
    return { action: "unsupported", reason, completed: false };
  }
  if (reason !== "eose" && reason !== "max") {
    return { action: "pause", reason, completed: false };
  }
  const events = Array.isArray(page?.events) ? page.events : [];
  const pageOldest = oldestCreatedAt(events);
  if (pageOldest == null) {
    if (reason === "eose") return { action: "complete", reason, completed: true, gap: null };
    return { action: "pause", reason: "empty-page", completed: false };
  }
  if (pageOldest < windowStart) {
    return { action: "complete", reason, completed: true, gap: null };
  }
  const decision = decideBackfillCursor({
    cursorUntil: cursor.cursorUntil,
    pageOldest,
    pageEvents: events,
    boundaryTimestamp: cursor.boundaryTimestamp,
    boundarySeenIds: cursor.boundarySeenIds,
    stuckCount: cursor.stuckCount || 0,
    pageLimit: cursor.pageLimit,
    defaultPageLimit,
    maxPageLimit,
  });
  const completed = decision.cursorUntil < windowStart;
  return {
    action: completed ? "complete" : decision.action,
    reason: decision.reason,
    completed,
    gap: decision.gap || null,
    cursor: {
      cursorUntil: decision.cursorUntil,
      pageLimit: decision.pageLimit,
      boundaryTimestamp: decision.boundaryTimestamp,
      boundarySeenIds: decision.boundarySeenIds,
      stuckCount: decision.stuckCount,
    },
  };
}

export function rotateRelays(relays, startIndex) {
  const count = relays.length;
  if (!count) return [];
  const start = normalizeIndex(startIndex, count);
  return [...relays.slice(start), ...relays.slice(0, start)];
}

export function eventsInWindow(events, windowStart) {
  return (events || []).filter(
    (event) => Number.isInteger(event?.created_at) && event.created_at >= windowStart,
  );
}

export async function runFrontfill(config, options = {}) {
  const db = options.db ?? (await createFirestore(config));
  const ownsDb = !options.db;
  const nowMs = options.now || (() => Date.now());
  const deadlineAt =
    config.runDeadlineMs > 0 ? nowMs() + config.runDeadlineMs : Infinity;
  const summaries = [];
  let stoppedReason = null;
  try {
    const runRef = db.collection(config.firestoreStateCollection).doc(FRONTFILL_RUN_DOC_ID);
    const runSnap = await runRef.get();
    const runState = runSnap.exists ? runSnap.data() || {} : {};
    let runRevision = runSnap.exists ? Number(runState.revision) || 0 : 0;
    const start = normalizeIndex(runState.nextRelayIndex, config.relays.length);
    let stopLive = false;
    for (let step = 0; step < config.relays.length && !stopLive; step += 1) {
      if (nowMs() >= deadlineAt) {
        stoppedReason = "run_deadline_reached";
        break;
      }
      const index = (start + step) % config.relays.length;
      const relay = config.relays[index];
      const nextRevision = await saveDoc(
        db,
        runRef,
        {
          mode: "frontfill",
          nextRelayIndex: (index + 1) % config.relays.length,
          updatedAt: new Date(nowMs()).toISOString(),
        },
        runRevision,
      );
      if (nextRevision == null) {
        summaries.push({ relay, status: "yielded", phase: "rotation" });
        stoppedReason = "rotation-yielded";
        break;
      }
      runRevision = nextRevision;
      for (const kind of config.kinds) {
        if (nowMs() >= deadlineAt) {
          stoppedReason = "run_deadline_reached";
          stopLive = true;
          break;
        }
        summaries.push(
          await runPhase(db, relay, kind, config, options, "live", nowMs),
        );
      }
    }
    if (nowMs() < deadlineAt && !stoppedReason) {
      for (let step = 0; step < config.relays.length; step += 1) {
        if (nowMs() >= deadlineAt) {
          stoppedReason = "run_deadline_reached";
          break;
        }
        const relay = config.relays[(start + step) % config.relays.length];
        for (const kind of config.kinds) {
          if (nowMs() >= deadlineAt) {
            stoppedReason = "run_deadline_reached";
            break;
          }
          const ref = cursorRef(db, config, relay, kind);
          const snap = await ref.get();
          const state = snap.exists ? snap.data() || {} : {};
          const resumed = resumeGap(state, config);
          if (resumed.skip) continue;
          summaries.push(
            await runPhase(db, relay, kind, config, options, "gap", nowMs),
          );
        }
      }
    }
  } finally {
    if (ownsDb) await terminateFirestore(db);
  }
  const failed = summaries.filter((summary) => summary.status === "failed");
  logFrontfill("frontfill_run_end", {
    cursors: summaries.length,
    failed: failed.length,
    stoppedReason,
  });
  if (failed.length) {
    throw new Error(`frontfill failed for ${failed.length} relay/kind cursors`);
  }
  return { summaries, stoppedReason };
}

async function runPhase(db, relay, kind, config, options, phase, nowMs) {
  const ref = cursorRef(db, config, relay, kind);
  const snap = await ref.get();
  const state = snap.exists ? snap.data() || {} : {};
  const revision = snap.exists ? Number(state.revision) || 0 : 0;
  const resumed =
    phase === "gap"
      ? resumeGap(state, config)
      : resumeLive(state, config.nowSec, config);
  if (resumed.skip) {
    return { relay, kind, phase, status: resumed.reason || "skipped" };
  }
  let cursor = resumed.cursor;
  const window = { windowStart: resumed.windowStart, windowEnd: resumed.windowEnd };
  let currentRevision = revision;
  const persist = async (fields) => {
    const next = await saveDoc(db, ref, fields, currentRevision);
    if (next == null) return false;
    currentRevision = next;
    return true;
  };
  const base = {
    relay,
    kind,
    mode: "frontfill",
    statePrefix: config.statePrefix,
    updatedAt: new Date(nowMs()).toISOString(),
  };
  const seed = snap.exists ? {} : gapSeed(config.nowSec, window.windowStart, config.initialLookbackSeconds);
  if (
    !(await persist({
      ...base,
      ...seed,
      ...phaseFields(phase, state, window, cursor, {
        status: "running",
        liveInProgress: phase === "live",
        gapInProgress: phase === "gap",
      }),
    }))
  ) {
    return { relay, kind, phase, status: "yielded", pages: 0 };
  }

  const maxPages = phase === "gap" ? config.gapMaxPages : config.liveMaxPages;
  const context = options.context || {
    eventIdsSeen: new Set(),
    handleStateCache: new Map(),
    mentionValidationCache: new Map(),
  };
  let pages = 0;
  while (pages < maxPages) {
    let page;
    try {
      page = await (options.queryRelay || defaultQueryRelay)(
        relay,
        { kinds: [kind], since: window.windowStart, until: cursor.cursorUntil },
        { timeoutMs: config.timeoutMs, max: cursor.pageLimit },
      );
    } catch (error) {
      const lastError = error?.message || String(error);
      await persist({
        ...base,
        ...phaseFields(phase, state, window, cursor, {
          status: "failed",
          liveInProgress: phase === "live",
          gapInProgress: phase === "gap",
          lastError,
        }),
      });
      return { relay, kind, phase, status: "failed", lastError, pages };
    }
    pages += 1;
    const plan = planFrontfillCursor({
      page,
      cursor,
      windowStart: window.windowStart,
      defaultPageLimit: config.pageLimit,
      maxPageLimit: config.maxPageLimit,
    });
    if (plan.action === "unsupported") {
      await persist({
        ...base,
        status: "unsupported",
        liveInProgress: false,
        gapInProgress: false,
        lastError: plan.reason,
        windowStart: null,
        windowEnd: null,
        cursorUntil: null,
      });
      return { relay, kind, phase, status: "unsupported", lastError: plan.reason, pages };
    }
    if (plan.action === "pause") {
      await persist({
        ...base,
        ...phaseFields(phase, state, window, cursor, {
          status: "retry_later",
          liveInProgress: phase === "live",
          gapInProgress: phase === "gap",
          lastError: plan.reason,
        }),
      });
      return { relay, kind, phase, status: "retry_later", lastError: plan.reason, pages };
    }

    const inWindow = eventsInWindow(page.events, window.windowStart);
    let processed;
    try {
      processed = await (options.processPage || defaultProcessPage)(
        db,
        { ...page, events: inWindow },
        relay,
        config,
        context,
      );
    } catch (error) {
      const lastError = error?.message || String(error);
      await persist({
        ...base,
        ...phaseFields(phase, state, window, cursor, {
          status: "failed",
          liveInProgress: phase === "live",
          gapInProgress: phase === "gap",
          lastError,
        }),
      });
      return { relay, kind, phase, status: "failed", lastError, pages };
    }
    const handleResult = await (options.commitHandles || commitHandleWritesBestEffort)(
      db,
      processed.writes || [],
      context.handleStateCache,
      { relay, kind, config, cursorUntil: cursor.cursorUntil },
    );
    if (handleResult.deadLetterFailed > 0) {
      await persist({
        ...base,
        ...phaseFields(phase, state, window, cursor, {
          status: "retry_later",
          liveInProgress: phase === "live",
          gapInProgress: phase === "gap",
          lastError: "handle-write-dead-letter-failed",
        }),
      });
      return {
        relay,
        kind,
        phase,
        status: "retry_later",
        lastError: "handle-write-dead-letter-failed",
        pages,
      };
    }

    const lastGap = plan.gap || null;
    if (plan.completed) {
      const doneFields =
        phase === "live"
          ? {
              status: "complete",
              liveInProgress: false,
              syncedUntil: window.windowEnd,
              windowStart: window.windowStart,
              windowEnd: window.windowEnd,
              cursorUntil: null,
              lastError: null,
              lastGap,
            }
          : {
              status: state.status === "complete" ? "complete" : state.status || "complete",
              liveInProgress: false,
              gapDone: true,
              gapInProgress: false,
              gapUntil: state.gapFloor,
              gapCursorUntil: null,
              lastError: null,
              lastGap,
            };
      if (!(await persist({ ...base, ...doneFields }))) {
        return { relay, kind, phase, status: "yielded", pages };
      }
      return {
        relay,
        kind,
        phase,
        status: "complete",
        pages,
        syncedUntil: phase === "live" ? window.windowEnd : state.syncedUntil ?? null,
      };
    }
    cursor = plan.cursor;
    if (
      !(await persist({
        ...base,
        ...phaseFields(phase, state, window, cursor, {
          status: phase === "live" ? "running" : state.status || "complete",
          liveInProgress: phase === "live",
          gapInProgress: phase === "gap",
          lastError: null,
          lastGap,
        }),
      }))
    ) {
      return { relay, kind, phase, status: "yielded", pages };
    }
  }
  return {
    relay,
    kind,
    phase,
    status: "running",
    pages,
    cursorUntil: cursor.cursorUntil,
  };
}

function phaseFields(phase, state, window, cursor, details) {
  if (phase === "gap") {
    const unsupported = details.status === "unsupported";
    return {
      status: unsupported ? "unsupported" : state.status || "complete",
      liveInProgress: false,
      gapInProgress: !unsupported && details.gapInProgress !== false,
      gapCursorUntil: cursor.cursorUntil,
      gapPageLimit: cursor.pageLimit,
      gapBoundaryTimestamp: cursor.boundaryTimestamp ?? null,
      gapBoundarySeenIds: cursor.boundarySeenIds || [],
      gapStuckCount: cursor.stuckCount || 0,
      lastError: details.lastError ?? null,
      ...(details.lastGap ? { lastGap: details.lastGap } : {}),
    };
  }
  return {
    status: details.status,
    liveInProgress: Boolean(details.liveInProgress),
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    cursorUntil: cursor.cursorUntil,
    pageLimit: cursor.pageLimit,
    boundaryTimestamp: cursor.boundaryTimestamp ?? null,
    boundarySeenIds: cursor.boundarySeenIds || [],
    stuckCount: cursor.stuckCount || 0,
    syncedUntil: state?.syncedUntil ?? null,
    lastError: details.lastError ?? null,
    ...(details.lastGap ? { lastGap: details.lastGap } : {}),
  };
}

async function defaultProcessPage(db, page, relay, config, context) {
  return processBackfillPage(db, page, relay, config, context);
}

function cursorRef(db, config, relay, kind) {
  return db
    .collection(config.firestoreStateCollection)
    .doc(backfillStateId(relay, kind, config.statePrefix));
}

function cursorFrom(state, windowEnd, pageLimit) {
  return {
    cursorUntil: Number.isInteger(state.cursorUntil) ? state.cursorUntil : windowEnd,
    pageLimit: state.pageLimit || pageLimit,
    boundaryTimestamp: state.boundaryTimestamp ?? null,
    boundarySeenIds: state.boundarySeenIds || [],
    stuckCount: state.stuckCount || 0,
  };
}

function freshCursor(windowEnd, pageLimit) {
  return {
    cursorUntil: windowEnd,
    pageLimit,
    boundaryTimestamp: null,
    boundarySeenIds: [],
    stuckCount: 0,
  };
}

function oldestCreatedAt(events) {
  let oldest = null;
  for (const event of events) {
    if (!Number.isInteger(event?.created_at)) continue;
    oldest = oldest === null ? event.created_at : Math.min(oldest, event.created_at);
  }
  return oldest;
}

function normalizeIndex(index, count) {
  if (!count) return 0;
  const parsed = Number(index);
  const start = Number.isInteger(parsed) ? parsed : 0;
  return ((start % count) + count) % count;
}

async function saveDoc(db, ref, data, revision) {
  const next = revision + 1;
  const wrote = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.revision) || 0 : 0;
    if (current !== revision) return false;
    tx.set(ref, { ...data, revision: next }, { merge: true });
    return true;
  });
  return wrote ? next : null;
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

function logFrontfill(message, fields = {}) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message,
      module: "frontfill",
      ...fields,
    }),
  );
}

runMain(import.meta.url, async () => {
  const config = loadFrontfillConfig();
  await runFrontfill(config);
});
