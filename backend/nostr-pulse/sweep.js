#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideBackfillCursor, isPermanentRelayKindUnsupported } from "../nostr-atlas/backfill.js";
import { queryRelay as defaultQueryRelay } from "../nostr-atlas/ingestion.js";
import { flushRelayHealth } from "../nostr-atlas/profile-store.js";
import { normalizeRelayUrl } from "../nostr-atlas/relay-hints.js";
import {
  createFirestore,
  runMain,
  terminateFirestore,
} from "../nostr-atlas/runtime.js";
import { backfillStateId, numberFromEnv } from "../nostr-atlas/utils.js";
import { URL_ACTIVITY_COLLECTION, backfillReactionPubkeys, ingestUrlEvent } from "./ingest.js";

const here = dirname(fileURLToPath(import.meta.url));

export const SWEEP_STATE_COLLECTION = "nostrPulseSweepState";
export const SWEEP_KINDS = Object.freeze([17, 9735]);
export const SWEEP_PAGE_LIMIT = 500;
export const SWEEP_MAX_PAGE_LIMIT = 2000;
export const SWEEP_MAX_PAGES = 4;
export const SWEEP_OVERLAP_SECONDS = 15 * 60;
export const SWEEP_INITIAL_LOOKBACK_SECONDS = 7 * 24 * 60 * 60;
export const SWEEP_TRANSIENT_RETRIES = 3;

function loadRelayRoles() {
  return JSON.parse(readFileSync(join(here, "../relay-roles.json"), "utf8"));
}

export function sweepRelaysFromRoles(roles) {
  const relays = [];
  const seen = new Set();
  for (const url of [...(roles?.rendezvous || []), ...(roles?.sweepExtra || [])]) {
    const normalized = normalizeRelayUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    relays.push(normalized);
  }
  return relays;
}

export function loadSweepConfig(
  env = process.env,
  nowSec = Math.floor(Date.now() / 1000),
  options = {},
) {
  const roles = options.roles || loadRelayRoles();
  const config = {
    firestoreProject:
      env.FIRESTORE_PROJECT || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || null,
    firestoreDatabase: env.FIRESTORE_DATABASE || "(default)",
    relays: options.relays || sweepRelaysFromRoles(roles),
    kinds: SWEEP_KINDS,
    nowSec,
    nowMs: nowSec * 1000,
    pageLimit: numberFromEnv(env, "SWEEP_PAGE_LIMIT", SWEEP_PAGE_LIMIT),
    maxPageLimit: numberFromEnv(env, "SWEEP_MAX_PAGE_LIMIT", SWEEP_MAX_PAGE_LIMIT),
    maxPages: numberFromEnv(env, "SWEEP_MAX_PAGES", SWEEP_MAX_PAGES),
    timeoutMs: numberFromEnv(env, "SWEEP_TIMEOUT_MS", 12000),
    overlapSeconds: numberFromEnv(env, "SWEEP_OVERLAP_SECONDS", SWEEP_OVERLAP_SECONDS),
    initialLookbackSeconds: numberFromEnv(
      env,
      "SWEEP_INITIAL_LOOKBACK_SECONDS",
      SWEEP_INITIAL_LOOKBACK_SECONDS,
    ),
    transientRetries: numberFromEnv(
      env,
      "SWEEP_TRANSIENT_RETRIES",
      SWEEP_TRANSIENT_RETRIES,
    ),
    profileTimeoutMs: numberFromEnv(env, "SWEEP_PROFILE_TIMEOUT_MS", 8000),
  };
  if (!config.firestoreProject) {
    throw new Error("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!config.relays.length) throw new Error("Sweep relays must not be empty.");
  positiveInteger(config.pageLimit, "SWEEP_PAGE_LIMIT");
  positiveInteger(config.maxPageLimit, "SWEEP_MAX_PAGE_LIMIT");
  if (config.maxPageLimit < config.pageLimit) {
    throw new Error("SWEEP_MAX_PAGE_LIMIT must be >= SWEEP_PAGE_LIMIT.");
  }
  positiveInteger(config.maxPages, "SWEEP_MAX_PAGES");
  positiveInteger(config.timeoutMs, "SWEEP_TIMEOUT_MS");
  positiveInteger(config.overlapSeconds, "SWEEP_OVERLAP_SECONDS");
  positiveInteger(config.initialLookbackSeconds, "SWEEP_INITIAL_LOOKBACK_SECONDS");
  positiveInteger(config.transientRetries, "SWEEP_TRANSIENT_RETRIES");
  positiveInteger(config.profileTimeoutMs, "SWEEP_PROFILE_TIMEOUT_MS");
  return config;
}

export function sweepFilter(kind, { since, until }) {
  const filter = { kinds: [kind], since, until };
  if (kind === 17) filter["#k"] = ["web"];
  return filter;
}

/**
 * First window starts 7 days back. Later windows overlap the previous
 * cursor by 15 minutes. An in-progress window is resumed as saved.
 */
export function resumeSweep(state, nowSec, config) {
  if (state?.status === "unsupported") {
    return { skip: true, reason: "unsupported" };
  }
  const inProgress =
    (state?.status === "running" ||
      state?.status === "retry_later" ||
      state?.status === "failed") &&
    Number.isInteger(state.windowEnd);
  const windowEnd = inProgress ? state.windowEnd : nowSec;
  let windowStart = inProgress ? state.windowStart : null;
  if (!Number.isInteger(windowStart)) {
    windowStart =
      state?.syncedUntil == null
        ? windowEnd - config.initialLookbackSeconds
        : state.syncedUntil - config.overlapSeconds;
  }
  if (windowEnd < windowStart) windowStart = windowEnd;
  const cursor = inProgress
    ? {
        cursorUntil: Number.isInteger(state.cursorUntil) ? state.cursorUntil : windowEnd,
        pageLimit: state.pageLimit || config.pageLimit,
        boundaryTimestamp: state.boundaryTimestamp ?? null,
        boundarySeenIds: state.boundarySeenIds || [],
        stuckCount: state.stuckCount || 0,
        transientAttempts: state.transientAttempts || 0,
      }
    : freshCursor(windowEnd, config.pageLimit);
  return { skip: false, windowStart, windowEnd, cursor };
}

export function planSweepCursor({
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
  // A relay may cap the page below `limit` and still send EOSE. Keep paging
  // until the page is empty or its oldest event is already before the window.
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
      transientAttempts: 0,
    },
  };
}

export async function runSweep(config, options = {}) {
  const db = options.db ?? (await createFirestore(config));
  const ownsDb = !options.db;
  const health = options.health || new Map();
  const summaries = [];
  try {
    logSweep("sweep_run_begin", {
      relays: config.relays.length,
      kinds: config.kinds,
      maxPages: config.maxPages,
      windowEnd: config.nowSec,
    });
    try {
      await repairReactionPubkeys(db);
    } catch (error) {
      logSweep("sweep_reaction_pubkey_repair_failed", {
        severity: "ERROR",
        lastError: error?.message || String(error),
      });
    }
    for (const relay of config.relays) {
      for (const kind of config.kinds) {
        try {
          summaries.push(
            await sweepRelayKind(db, relay, kind, config, { ...options, health }),
          );
        } catch (error) {
          const summary = {
            relay,
            kind,
            status: "failed",
            lastError: error?.message || String(error),
          };
          summaries.push(summary);
          logSweep("sweep_cursor_result", summary);
        }
      }
    }
    if (options.flushHealth !== false) await flushRelayHealth(db, health);
  } finally {
    if (ownsDb) await terminateFirestore(db);
  }
  const failed = summaries.filter((summary) => summary.status === "failed").length;
  logSweep("sweep_run_end", {
    cursors: summaries.length,
    failed,
  });
  if (failed) {
    throw new Error(`pulse sweep failed for ${failed} relay/kind cursors`);
  }
  return { summaries };
}

async function repairReactionPubkeys(db) {
  const urls = db.collection(URL_ACTIVITY_COLLECTION);
  if (typeof urls.orderBy !== "function") return;
  const ref = db.collection(SWEEP_STATE_COLLECTION).doc("reaction-pubkey");
  const snap = await ref.get();
  const state = snap.exists ? snap.data() || {} : {};
  if (state.done === true) return;
  const result = await backfillReactionPubkeys(db, {
    afterId: state.afterId || null,
    limit: 400,
  });
  await saveCursor(
    db,
    ref,
    {
      afterId: result.done ? null : result.afterId || null,
      done: result.done === true,
      updated: Number(state.updated || 0) + result.updated,
      lastRunAt: new Date().toISOString(),
    },
    snap.exists ? Number(state.revision) || 0 : 0,
  );
}

async function sweepRelayKind(db, relay, kind, config, options) {
  const ref = db.collection(SWEEP_STATE_COLLECTION).doc(
    backfillStateId(relay, kind, "pulse-sweep"),
  );
  const snap = await ref.get();
  const state = snap.exists ? snap.data() || {} : {};
  const resumed = resumeSweep(state, config.nowSec, config);
  if (resumed.skip) {
    return { relay, kind, status: "unsupported", lastError: state.lastError || null };
  }
  let cursor = resumed.cursor;
  let window = { windowStart: resumed.windowStart, windowEnd: resumed.windowEnd };
  let revision = snap.exists ? Number(state.revision) || 0 : 0;
  const persist = async (fields) => {
    const next = await saveCursor(db, ref, fields, revision);
    if (next == null) return false;
    revision = next;
    return true;
  };
  if (!(await persist(stateFields({
    relay,
    kind,
    state,
    window,
    cursor,
    status: "running",
    config,
  })))) {
    return { relay, kind, status: "yielded", pages: 0 };
  }

  let pages = 0;
  let lastReason = "running";
  while (pages < config.maxPages) {
    let page;
    try {
      page = await (options.queryRelay || defaultQueryRelay)(
        relay,
        sweepFilter(kind, { since: window.windowStart, until: cursor.cursorUntil }),
        { timeoutMs: config.timeoutMs, max: cursor.pageLimit },
      );
    } catch (error) {
      lastReason = error?.message || String(error);
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor,
        status: "retry_later",
        lastError: lastReason,
        config,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      return { relay, kind, status: "retry_later", lastError: lastReason, pages };
    }
    pages += 1;
    const plan = planSweepCursor({
      page,
      cursor,
      windowStart: window.windowStart,
      defaultPageLimit: config.pageLimit,
      maxPageLimit: config.maxPageLimit,
    });
    if (plan.action === "unsupported") {
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor,
        status: "unsupported",
        lastError: plan.reason,
        config,
        clearWindow: true,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      return { relay, kind, status: "unsupported", lastError: plan.reason, pages };
    }
    if (plan.action === "pause") {
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor,
        status: "retry_later",
        lastError: plan.reason,
        config,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      return { relay, kind, status: "retry_later", lastError: plan.reason, pages };
    }

    const outcome = await ingestPage(
      db,
      page.events,
      { relay, kind, windowStart: window.windowStart, config, options, cursor },
    );
    if (outcome.failed) {
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor,
        status: "failed",
        lastError: outcome.error,
        config,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      return { relay, kind, status: "failed", lastError: outcome.error, pages };
    }
    if (outcome.retry) {
      const attempts = (cursor.transientAttempts || 0) + 1;
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor: { ...cursor, transientAttempts: attempts },
        status: "retry_later",
        lastError: "provider-unavailable",
        config,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      return {
        relay,
        kind,
        status: "retry_later",
        lastError: "provider-unavailable",
        pages,
      };
    }

    lastReason = plan.reason;
    if (plan.completed) {
      if (!(await persist(stateFields({
        relay,
        kind,
        state,
        window,
        cursor: freshCursor(window.windowEnd, config.pageLimit),
        status: "complete",
        syncedUntil: window.windowEnd,
        lastError: null,
        lastGap: plan.gap,
        config,
        clearWindow: true,
      })))) {
        return { relay, kind, status: "yielded", pages };
      }
      logSweep("sweep_cursor_result", {
        relay,
        kind,
        status: "complete",
        pages,
        syncedUntil: window.windowEnd,
      });
      return { relay, kind, status: "complete", pages, syncedUntil: window.windowEnd };
    }
    cursor = { ...plan.cursor, transientAttempts: 0 };
    if (!(await persist(stateFields({
      relay,
      kind,
      state,
      window,
      cursor,
      status: "running",
      lastError: null,
      lastGap: plan.gap,
      config,
    })))) {
      return { relay, kind, status: "yielded", pages };
    }
  }
  logSweep("sweep_cursor_result", {
    relay,
    kind,
    status: "running",
    pages,
    cursorUntil: cursor.cursorUntil,
  });
  return { relay, kind, status: "running", pages, cursorUntil: cursor.cursorUntil, lastReason };
}

async function ingestPage(db, events, { relay, windowStart, config, options, cursor }) {
  const seen = new Set();
  for (const event of events || []) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    if (!Number.isInteger(event.created_at) || event.created_at < windowStart) continue;
    let result;
    try {
      result = await (options.ingestUrlEvent || ingestUrlEvent)(
        db,
        event,
        { relay, source: "sweep" },
        {
          nowMs: config.nowMs,
          giveUpOnProvider:
            (cursor.transientAttempts || 0) >= config.transientRetries - 1,
          health: options.health,
          queryRelay: options.queryRelay,
          profileTimeoutMs: config.profileTimeoutMs,
        },
      );
    } catch (error) {
      return { failed: true, error: error?.message || String(error) };
    }
    if (result?.retry) return { retry: true };
  }
  return { retry: false };
}

function stateFields({
  relay,
  kind,
  state,
  window,
  cursor,
  status,
  config,
  syncedUntil,
  lastError,
  lastGap,
  clearWindow = false,
}) {
  return {
    relay,
    kind,
    syncedUntil: syncedUntil ?? state?.syncedUntil ?? null,
    windowStart: clearWindow ? null : window.windowStart,
    windowEnd: clearWindow ? null : window.windowEnd,
    cursorUntil: clearWindow ? null : cursor.cursorUntil,
    pageLimit: clearWindow ? null : cursor.pageLimit,
    boundaryTimestamp: clearWindow ? null : cursor.boundaryTimestamp ?? null,
    boundarySeenIds: clearWindow ? [] : cursor.boundarySeenIds || [],
    stuckCount: clearWindow ? 0 : cursor.stuckCount || 0,
    transientAttempts: cursor.transientAttempts || 0,
    lastRunAt: new Date(config.nowMs).toISOString(),
    status,
    lastError: lastError ?? null,
    ...(lastGap ? { lastGap } : {}),
  };
}

function freshCursor(windowEnd, pageLimit) {
  return {
    cursorUntil: windowEnd,
    pageLimit,
    boundaryTimestamp: null,
    boundarySeenIds: [],
    stuckCount: 0,
    transientAttempts: 0,
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

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

async function saveCursor(db, ref, data, revision) {
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

function logSweep(message, fields = {}) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message,
      module: "pulse-sweep",
      ...fields,
    }),
  );
}

runMain(import.meta.url, async () => {
  const config = loadSweepConfig();
  await runSweep(config);
});
