// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import roles from "../relay-roles.json";
import {
  SWEEP_INITIAL_LOOKBACK_SECONDS,
  SWEEP_OVERLAP_SECONDS,
  loadSweepConfig,
  planSweepCursor,
  resumeSweep,
  runSweep,
  sweepFilter,
  sweepRelaysFromRoles,
} from "./sweep.js";

const NOW = 1_800_000_000;
const RELAY = "wss://relay.example/";

function config(overrides = {}) {
  return {
    firestoreProject: "nostr-components",
    firestoreDatabase: "(default)",
    relays: [RELAY],
    kinds: [17, 9735],
    nowSec: NOW,
    nowMs: NOW * 1000,
    pageLimit: 500,
    maxPageLimit: 2000,
    maxPages: 4,
    timeoutMs: 1000,
    overlapSeconds: SWEEP_OVERLAP_SECONDS,
    initialLookbackSeconds: SWEEP_INITIAL_LOOKBACK_SECONDS,
    transientRetries: 3,
    profileTimeoutMs: 1000,
    ...overrides,
  };
}

function memoryDb() {
  const docs = new Map();
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              return {
                exists: docs.has(key),
                data: () => (docs.has(key) ? { ...docs.get(key) } : undefined),
              };
            },
            async set(data, options) {
              const prev = docs.get(key) || {};
              docs.set(key, options?.merge ? { ...prev, ...data } : { ...data });
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, options) => ref.set(data, options),
      });
    },
  };
}

function stateOf(db) {
  return [...db.docs.values()][0];
}

describe("sweep relays and windows", () => {
  it("reads the rendezvous relays plus sweepExtra", () => {
    const relays = sweepRelaysFromRoles(roles);
    expect(relays).toHaveLength(13);
    expect(relays.some((url) => url.includes("relay.ditto.pub"))).toBe(true);
    expect(relays.some((url) => url.includes("nos.lol"))).toBe(true);
    expect(loadSweepConfig({ FIRESTORE_PROJECT: "nostr-components" }, NOW).relays).toEqual(
      relays,
    );
  });

  it("starts the first window 7 days back and overlaps a finished window by 15 minutes", () => {
    const cfg = config();
    expect(resumeSweep(null, NOW, cfg)).toMatchObject({
      windowStart: NOW - SWEEP_INITIAL_LOOKBACK_SECONDS,
      windowEnd: NOW,
      cursor: { cursorUntil: NOW },
    });
    expect(
      resumeSweep({ status: "complete", syncedUntil: NOW - 600 }, NOW, cfg),
    ).toMatchObject({
      windowStart: NOW - 600 - SWEEP_OVERLAP_SECONDS,
      windowEnd: NOW,
    });
  });

  it("resumes an in-progress window and skips an unsupported relay", () => {
    const cfg = config();
    const saved = {
      status: "running",
      windowStart: 10,
      windowEnd: 20,
      cursorUntil: 15,
      pageLimit: 1000,
      boundaryTimestamp: 15,
      boundarySeenIds: ["aa"],
      stuckCount: 1,
      transientAttempts: 2,
    };
    expect(resumeSweep(saved, NOW, cfg)).toMatchObject({
      windowStart: 10,
      windowEnd: 20,
      cursor: { cursorUntil: 15, pageLimit: 1000, transientAttempts: 2 },
    });
    expect(resumeSweep({ status: "unsupported" }, NOW, cfg)).toMatchObject({
      skip: true,
    });
  });

  it("filters kind 17 on the web tag and leaves receipt queries unfiltered", () => {
    expect(sweepFilter(17, { since: 1, until: 2 })).toEqual({
      kinds: [17],
      "#k": ["web"],
      since: 1,
      until: 2,
    });
    expect(sweepFilter(9735, { since: 1, until: 2 })).toEqual({
      kinds: [9735],
      since: 1,
      until: 2,
    });
  });
});

describe("planSweepCursor", () => {
  const cursor = {
    cursorUntil: 800,
    pageLimit: 500,
    boundaryTimestamp: null,
    boundarySeenIds: [],
    stuckCount: 0,
  };

  it("keeps paging a nonempty eose page and finishes an empty one", () => {
    const nonempty = planSweepCursor({
      page: { reason: "eose", events: [{ id: "a", created_at: 500 }] },
      cursor,
      windowStart: 100,
      defaultPageLimit: 500,
      maxPageLimit: 2000,
    });
    expect(nonempty.completed).toBe(false);
    expect(nonempty.cursor.cursorUntil).toBe(500);
    expect(
      planSweepCursor({
        page: { reason: "eose", events: [] },
        cursor,
        windowStart: 100,
        defaultPageLimit: 500,
        maxPageLimit: 2000,
      }).completed,
    ).toBe(true);
    expect(
      planSweepCursor({
        page: { reason: "eose", events: [{ id: "old", created_at: 50 }] },
        cursor,
        windowStart: 100,
        defaultPageLimit: 500,
        maxPageLimit: 2000,
      }).completed,
    ).toBe(true);
    expect(
      planSweepCursor({
        page: { reason: "timeout", events: [] },
        cursor,
        windowStart: 100,
        defaultPageLimit: 500,
        maxPageLimit: 2000,
      }),
    ).toMatchObject({ action: "pause", completed: false });
  });

  it("pages backward with decideBackfillCursor and records a stuck second as a gap", () => {
    const moved = planSweepCursor({
      page: { reason: "max", events: [{ id: "b", created_at: 400 }] },
      cursor,
      windowStart: 100,
      defaultPageLimit: 500,
      maxPageLimit: 2000,
    });
    expect(moved.completed).toBe(false);
    expect(moved.cursor.cursorUntil).toBe(400);

    const gap = planSweepCursor({
      page: { reason: "max", events: [{ id: "aa", created_at: 100 }] },
      cursor: {
        cursorUntil: 100,
        pageLimit: 500,
        boundaryTimestamp: 100,
        boundarySeenIds: ["aa"],
        stuckCount: 0,
      },
      windowStart: 100,
      defaultPageLimit: 500,
      maxPageLimit: 500,
    });
    expect(gap.completed).toBe(true);
    expect(gap.gap).toMatchObject({ timestamp: 100, reason: "stuck_same_timestamp" });
  });
});

describe("runSweep", () => {
  it("stops at the page cap and resumes the same window", async () => {
    const db = memoryDb();
    let stamp = NOW - 1_000;
    const filters = [];
    const queryRelay = async (_relay, filter) => {
      filters.push(filter);
      stamp -= 100;
      return {
        reason: "max",
        events: [{ id: `e-${stamp}`, created_at: stamp, kind: filter.kinds[0] }],
      };
    };
    const ingestUrlEvent = async () => ({ ok: true, stored: true, retry: false });
    const cfg = config({ maxPages: 2, kinds: [17] });
    const first = await runSweep(cfg, { db, queryRelay, ingestUrlEvent, flushHealth: false });
    expect(first.summaries[0]).toMatchObject({ status: "running", pages: 2 });
    expect(stateOf(db)).toMatchObject({
      status: "running",
      windowEnd: NOW,
      cursorUntil: NOW - 1_200,
      syncedUntil: null,
    });

    const queryRelayDone = async (_relay, filter) => {
      filters.push(filter);
      return { reason: "eose", events: [] };
    };
    const second = await runSweep(cfg, {
      db,
      queryRelay: queryRelayDone,
      ingestUrlEvent,
      flushHealth: false,
    });
    expect(filters.at(-1).until).toBe(NOW - 1_200);
    expect(second.summaries[0].status).toBe("complete");
    expect(stateOf(db)).toMatchObject({ status: "complete", syncedUntil: NOW, windowEnd: null });
  });

  it("asks relays for web reactions and every receipt, then stores both", async () => {
    const db = memoryDb();
    const filters = [];
    const ingested = [];
    await runSweep(config({ maxPages: 1 }), {
      db,
      flushHealth: false,
      queryRelay: async (_relay, filter) => {
        filters.push(filter);
        return {
          reason: "eose",
          events: [
            {
              id: `${filter.kinds[0]}-event`,
              kind: filter.kinds[0],
              created_at: filter.until - 10,
            },
          ],
        };
      },
      ingestUrlEvent: async (_db, event, meta) => {
        ingested.push({ event, meta });
        return { ok: true, stored: true, retry: false };
      },
    });
    expect(filters.map((filter) => filter.kinds[0])).toEqual([17, 9735]);
    expect(filters[0]["#k"]).toEqual(["web"]);
    expect(filters[1]["#k"]).toBeUndefined();
    expect(ingested).toHaveLength(2);
    expect(ingested[0].meta).toEqual({ relay: RELAY, source: "sweep" });
  });

  it("retries a transient provider a limited number of times, then moves on", async () => {
    const db = memoryDb();
    const options = [];
    const queryRelay = async () => ({
      reason: "eose",
      events: [{ id: "receipt", kind: 9735, created_at: NOW - 10 }],
    });
    const ingestUrlEvent = async (_db, _event, _meta, opts) => {
      options.push(opts.giveUpOnProvider);
      if (opts.giveUpOnProvider) return { ok: false, retry: false, reason: "provider-unavailable" };
      return { ok: false, retry: true, reason: "provider-unavailable" };
    };
    const cfg = config({ kinds: [9735], transientRetries: 2, maxPages: 1 });
    const paused = await runSweep(cfg, { db, queryRelay, ingestUrlEvent, flushHealth: false });
    expect(paused.summaries[0]).toMatchObject({
      status: "retry_later",
      lastError: "provider-unavailable",
    });
    expect(stateOf(db).transientAttempts).toBe(1);
    const done = await runSweep(cfg, { db, queryRelay, ingestUrlEvent, flushHealth: false });
    expect(options).toEqual([false, true]);
    expect(done.summaries[0].status).toBe("running");
    expect(stateOf(db).cursorUntil).toBe(NOW - 10);
  });

  it("leaves the cursor alone when another execution has moved its revision", async () => {
    const db = memoryDb();
    let commits = 0;
    const runTransaction = db.runTransaction.bind(db);
    db.runTransaction = async (fn) => {
      commits += 1;
      if (commits === 2) {
        const [key, data] = [...db.docs.entries()][0];
        db.docs.set(key, { ...data, revision: data.revision + 5, cursorUntil: 123 });
      }
      return runTransaction(fn);
    };
    const result = await runSweep(config({ kinds: [17], maxPages: 2 }), {
      db,
      flushHealth: false,
      queryRelay: async () => ({
        reason: "max",
        events: [{ id: "e", created_at: NOW - 50, kind: 17 }],
      }),
      ingestUrlEvent: async () => ({ ok: true, stored: true, retry: false }),
    });
    expect(result.summaries[0].status).toBe("yielded");
    expect(stateOf(db)).toMatchObject({ revision: 6, cursorUntil: 123 });
  });

  it("does not query a relay that rejects the kind", async () => {
    const db = memoryDb();
    let calls = 0;
    const queryRelay = async () => {
      calls += 1;
      return { reason: "closed: kind not allowed", events: [] };
    };
    const cfg = config({ kinds: [9735] });
    await runSweep(cfg, { db, queryRelay, flushHealth: false });
    await runSweep(cfg, { db, queryRelay, flushHealth: false });
    expect(calls).toBe(1);
    expect(stateOf(db).status).toBe("unsupported");
  });
});

describe("sweep packaging", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  it("copies nostr-pulse into the crawler image and leaves its tests out", () => {
    const dockerfile = readFileSync(path.join(root, "backend/Dockerfile"), "utf8");
    const ignore = readFileSync(path.join(root, ".dockerignore"), "utf8");
    expect(dockerfile).toContain("backend/nostr-pulse");
    expect(dockerfile).toContain("backend/relay-roles.json");
    expect(ignore).toContain("backend/nostr-pulse/**/*.test.js");
    const deploy = readFileSync(
      path.join(root, "backend/deploy-nostr-pulse-sweep.sh"),
      "utf8",
    );
    expect(deploy).toContain("nostr-pulse/sweep.js");
    expect(deploy).toContain("*/10 * * * *");
    expect(deploy).toContain("nostr-pulse-sweep");
  });
});
