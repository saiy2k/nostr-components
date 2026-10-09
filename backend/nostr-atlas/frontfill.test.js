// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { backfillStateId } from "./utils.js";
import {
  FRONTFILL_INITIAL_LOOKBACK_SECONDS,
  FRONTFILL_LIVE_WINDOW_SECONDS,
  FRONTFILL_OVERLAP_SECONDS,
  FRONTFILL_RUN_DEADLINE_MS,
  FRONTFILL_RUN_DOC_ID,
  eventsInWindow,
  gapIsOpen,
  gapSeed,
  loadFrontfillConfig,
  planFrontfillCursor,
  resumeGap,
  resumeLive,
  rotateRelays,
  runFrontfill,
} from "./frontfill.js";

const NOW = 1_800_000_000;
const RELAY = "wss://relay.example/";
const KIND = 10011;

function config(overrides = {}) {
  return {
    firestoreProject: "nostr-components",
    firestoreDatabase: "(default)",
    firestoreHandlesCollection: "nostrDirectoryHandles",
    firestoreStateCollection: "relayCrawlerState",
    firestoreHandleWriteFailuresCollection: "nostrDirectoryHandleWriteFailures",
    relays: [RELAY],
    kinds: [KIND],
    nowSec: NOW,
    statePrefix: "frontfill",
    pageLimit: 250,
    maxPageLimit: 1000,
    liveMaxPages: 4,
    gapMaxPages: 2,
    timeoutMs: 1000,
    overlapSeconds: FRONTFILL_OVERLAP_SECONDS,
    liveWindowSeconds: FRONTFILL_LIVE_WINDOW_SECONDS,
    initialLookbackSeconds: FRONTFILL_INITIAL_LOOKBACK_SECONDS,
    runDeadlineMs: 0,
    maxPendingClaims: 20,
    maxInactiveVerifiedClaims: 10,
    maxRejectionTombstones: 100,
    xMentionCheckTimeoutMs: 1000,
    ...overrides,
  };
}

function memoryDb() {
  const docs = new Map();
  const refOf = (name, id) => {
    const key = `${name}/${id}`;
    return {
      id,
      collection: name,
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
  };
  return {
    docs,
    collection(name) {
      return { doc: (id) => refOf(name, id) };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, options) => ref.set(data, options),
      });
    },
  };
}

function cursorDoc(db, relay = RELAY, kind = KIND) {
  return db.docs.get(
    `relayCrawlerState/${backfillStateId(relay, kind, "frontfill")}`,
  );
}

function runDoc(db) {
  return db.docs.get(`relayCrawlerState/${FRONTFILL_RUN_DOC_ID}`);
}

function emptyPage() {
  return { reason: "eose", events: [] };
}

describe("frontfill windows", () => {
  it("opens a one-hour live window and keeps the 90-day floor for the gap only", () => {
    const cfg = config();
    expect(resumeLive(null, NOW, cfg)).toMatchObject({
      skip: false,
      windowStart: NOW - FRONTFILL_LIVE_WINDOW_SECONDS,
      windowEnd: NOW,
      cursor: { cursorUntil: NOW },
    });
    expect(gapSeed(NOW, NOW - FRONTFILL_LIVE_WINDOW_SECONDS, cfg.initialLookbackSeconds)).toMatchObject({
      gapDone: false,
      gapFloor: NOW - FRONTFILL_INITIAL_LOOKBACK_SECONDS,
      gapUntil: NOW - FRONTFILL_LIVE_WINDOW_SECONDS,
    });
  });

  it("overlaps the next live window even while the gap is still open", () => {
    const cfg = config();
    const state = {
      status: "complete",
      liveInProgress: false,
      syncedUntil: NOW - 3600,
      gapDone: false,
      gapFloor: NOW - FRONTFILL_INITIAL_LOOKBACK_SECONDS,
      gapUntil: NOW - 7200,
    };
    expect(gapIsOpen(state)).toBe(true);
    expect(resumeLive(state, NOW, cfg)).toMatchObject({
      windowStart: state.syncedUntil - FRONTFILL_OVERLAP_SECONDS,
      windowEnd: NOW,
    });
  });

  it("resumes an in-progress live window at its saved end", () => {
    const cfg = config();
    const resumed = resumeLive(
      {
        status: "running",
        liveInProgress: true,
        windowStart: NOW - 5000,
        windowEnd: NOW - 1000,
        cursorUntil: NOW - 1200,
        pageLimit: 500,
      },
      NOW,
      cfg,
    );
    expect(resumed).toMatchObject({
      windowEnd: NOW - 1000,
      windowStart: NOW - 5000,
      cursor: { cursorUntil: NOW - 1200, pageLimit: 500 },
    });
  });

  it("skips an unsupported relay/kind", () => {
    expect(resumeLive({ status: "unsupported" }, NOW, config())).toMatchObject({
      skip: true,
      reason: "unsupported",
    });
    expect(resumeGap({ status: "unsupported" }, config())).toMatchObject({
      skip: true,
      reason: "unsupported",
    });
  });

  it("keeps paging a nonempty EOSE that is still inside the window", () => {
    const plan = planFrontfillCursor({
      page: { reason: "eose", events: [{ id: "e", created_at: NOW - 10 }] },
      cursor: { cursorUntil: NOW, pageLimit: 250, boundarySeenIds: [], stuckCount: 0 },
      windowStart: NOW - 3600,
      defaultPageLimit: 250,
      maxPageLimit: 1000,
    });
    expect(plan.completed).toBe(false);
    expect(plan.cursor.cursorUntil).toBe(NOW - 10);
  });

  it("steps past a repeated boundary second on EOSE without recording a gap", () => {
    const plan = planFrontfillCursor({
      page: { reason: "eose", events: [{ id: "e", created_at: NOW - 10 }] },
      cursor: {
        cursorUntil: NOW - 10,
        pageLimit: 250,
        boundaryTimestamp: NOW - 10,
        boundarySeenIds: ["e"],
        stuckCount: 0,
      },
      windowStart: NOW - 3600,
      defaultPageLimit: 250,
      maxPageLimit: 1000,
    });
    expect(plan.completed).toBe(false);
    expect(plan.gap).toBeNull();
    expect(plan.cursor.cursorUntil).toBe(NOW - 11);
  });

  it("drops events older than the window start", () => {
    expect(
      eventsInWindow(
        [
          { id: "old", created_at: NOW - 4000 },
          { id: "new", created_at: NOW - 10 },
          { id: "bad", created_at: 1.5 },
        ],
        NOW - 3600,
      ).map((event) => event.id),
    ).toEqual(["new"]);
  });

  it("stores no gap for lookback 0 and stops the walk at the floor", () => {
    expect(gapSeed(NOW, NOW - 3600, 0)).toEqual({});
    const done = {
      status: "complete",
      gapDone: true,
      gapFloor: NOW - 7200,
      gapUntil: NOW - 7200,
    };
    expect(gapIsOpen(done)).toBe(false);
    expect(resumeGap(done, config())).toMatchObject({ skip: true, reason: "gap-done" });
  });

  it("does not walk the gap while the live window is open", () => {
    const state = {
      status: "running",
      liveInProgress: true,
      gapDone: false,
      gapFloor: NOW - 7200,
      gapUntil: NOW - 3600,
    };
    expect(resumeGap(state, config())).toMatchObject({ skip: true, reason: "live-open" });
  });

  it("wraps the relay rotation", () => {
    expect(rotateRelays(["a", "b", "c"], 2)).toEqual(["c", "a", "b"]);
  });

  it("accepts lookback 0 and rejects a negative lookback", () => {
    expect(
      loadFrontfillConfig(
        {
          FIRESTORE_PROJECT: "nostr-components",
          RELAYS: RELAY,
          FRONTFILL_INITIAL_LOOKBACK_SECONDS: "0",
        },
        NOW,
      ).initialLookbackSeconds,
    ).toBe(0);
    expect(
      loadFrontfillConfig(
        { FIRESTORE_PROJECT: "nostr-components", RELAYS: RELAY },
        NOW,
      ).runDeadlineMs,
    ).toBe(FRONTFILL_RUN_DEADLINE_MS);
    expect(() =>
      loadFrontfillConfig(
        {
          FIRESTORE_PROJECT: "nostr-components",
          RELAYS: RELAY,
          FRONTFILL_INITIAL_LOOKBACK_SECONDS: "-1",
        },
        NOW,
      ),
    ).toThrow(/FRONTFILL_INITIAL_LOOKBACK_SECONDS/);
  });
});

describe("frontfill runs", () => {
  it("finishes a live window of events within the page budget without a gap", async () => {
    const db = memoryDb();
    const events = [
      { id: "new", created_at: NOW - 10 },
      { id: "older", created_at: NOW - 100 },
    ];
    let queries = 0;
    await runFrontfill(config({ initialLookbackSeconds: 0, liveMaxPages: 4 }), {
      db,
      queryRelay: async (_relay, filter) => {
        queries += 1;
        return {
          reason: "eose",
          events: events.filter(
            (event) =>
              event.created_at <= filter.until && event.created_at >= filter.since,
          ),
        };
      },
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    });
    expect(queries).toBeLessThanOrEqual(4);
    expect(cursorDoc(db)).toMatchObject({
      status: "complete",
      liveInProgress: false,
      syncedUntil: NOW,
    });
    expect(cursorDoc(db).lastGap).toBeFalsy();
  });

  it("queries kind 10011 before kind 0 and claims only in-window events", async () => {
    const db = memoryDb();
    const seen = [];
    const filters = [];
    await runFrontfill(config({ kinds: [10011, 0], initialLookbackSeconds: 0 }), {
      db,
      queryRelay: async (_relay, filter) => {
        filters.push(filter);
        return {
          reason: "eose",
          events: [
            { id: "old", created_at: NOW - 4000 },
            { id: "new", created_at: NOW - 10 },
          ],
        };
      },
      processPage: async (_db, page) => {
        seen.push(page.events.map((event) => event.id));
        return { writes: [] };
      },
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    });
    expect(filters.map((filter) => filter.kinds[0])).toEqual([10011, 0]);
    expect(seen).toEqual([["new"], ["new"]]);
  });

  it("does not advance the cursor when a dead-letter cannot be written", async () => {
    const db = memoryDb();
    await runFrontfill(config({ initialLookbackSeconds: 0, liveMaxPages: 2 }), {
      db,
      queryRelay: async () => ({
        reason: "max",
        events: [{ id: "e", created_at: NOW - 10 }],
      }),
      processPage: async () => ({ writes: [{ id: "twitter:alice" }] }),
      commitHandles: async () => ({ deadLetterFailed: 1 }),
    });
    expect(cursorDoc(db)).toMatchObject({
      status: "retry_later",
      cursorUntil: NOW,
      lastError: "handle-write-dead-letter-failed",
      liveInProgress: true,
    });
  });

  it("does not roll the cursor back when the revision moved", async () => {
    const db = memoryDb();
    const cursorId = backfillStateId(RELAY, KIND, "frontfill");
    const key = `relayCrawlerState/${cursorId}`;
    let bumped = false;
    const runTransaction = db.runTransaction.bind(db);
    db.runTransaction = async (fn) =>
      runTransaction(async (tx) => {
        const get = tx.get.bind(tx);
        tx.get = async (ref) => {
          if (ref.id === cursorId && !bumped) {
            bumped = true;
            db.docs.set(key, { revision: 5, cursorUntil: 123, status: "running" });
          }
          return get(ref);
        };
        return fn(tx);
      });
    const queries = [];
    const result = await runFrontfill(config({ initialLookbackSeconds: 0 }), {
      db,
      queryRelay: async () => {
        queries.push(true);
        return emptyPage();
      },
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    });
    expect(result.summaries[0]).toMatchObject({ status: "yielded" });
    expect(queries).toEqual([]);
    expect(cursorDoc(db)).toMatchObject({ revision: 5, cursorUntil: 123 });
  });

  it("does not query an unsupported kind again", async () => {
    const db = memoryDb();
    let calls = 0;
    const options = {
      db,
      queryRelay: async () => {
        calls += 1;
        return { reason: "closed: kind not allowed", events: [] };
      },
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    };
    await runFrontfill(config({ initialLookbackSeconds: 0 }), options);
    await runFrontfill(config({ initialLookbackSeconds: 0 }), options);
    expect(calls).toBe(1);
    expect(cursorDoc(db).status).toBe("unsupported");
  });

  it("stores no gap fields when lookback is 0", async () => {
    const db = memoryDb();
    await runFrontfill(config({ initialLookbackSeconds: 0 }), {
      db,
      queryRelay: async () => emptyPage(),
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    });
    const state = cursorDoc(db);
    expect(state.gapUntil).toBeUndefined();
    expect(state.gapFloor).toBeUndefined();
    expect(state.gapCursorUntil).toBeUndefined();
    expect(state.syncedUntil).toBe(NOW);
  });

  it("leaves the gap untouched until the live window completes", async () => {
    const db = memoryDb();
    const filters = [];
    await runFrontfill(
      config({ initialLookbackSeconds: 7200, liveMaxPages: 1, gapMaxPages: 2 }),
      {
        db,
        queryRelay: async (_relay, filter) => {
          filters.push(filter);
          return {
            reason: "max",
            events: [{ id: "e", created_at: NOW - 10 }],
          };
        },
        processPage: async () => ({ writes: [] }),
        commitHandles: async () => ({ deadLetterFailed: 0 }),
      },
    );
    expect(filters).toEqual([
      { kinds: [KIND], since: NOW - FRONTFILL_LIVE_WINDOW_SECONDS, until: NOW },
    ]);
    expect(cursorDoc(db).liveInProgress).toBe(true);
    expect(cursorDoc(db).gapInProgress).toBeUndefined();
  });

  it("finishes the gap at the floor and then stays live-only", async () => {
    const db = memoryDb();
    const filters = [];
    const floor = NOW - 7200;
    await runFrontfill(config({ initialLookbackSeconds: 7200, gapMaxPages: 2 }), {
      db,
      queryRelay: async (_relay, filter) => {
        filters.push(filter);
        if (filter.until === NOW) return emptyPage();
        return {
          reason: "eose",
          events: [{ id: "old", created_at: floor - 1 }],
        };
      },
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    });
    expect(filters).toHaveLength(2);
    expect(cursorDoc(db)).toMatchObject({ gapDone: true, gapUntil: floor });
    filters.length = 0;
    await runFrontfill(
      config({ initialLookbackSeconds: 7200, nowSec: NOW + 3600 }),
      {
        db,
        queryRelay: async (_relay, filter) => {
          filters.push(filter);
          return emptyPage();
        },
        processPage: async () => ({ writes: [] }),
        commitHandles: async () => ({ deadLetterFailed: 0 }),
      },
    );
    expect(filters.map((filter) => filter.until)).toEqual([NOW + 3600]);
  });

  it("opens the next live window while a gap remains", async () => {
    const db = memoryDb();
    const filters = [];
    const options = {
      db,
      processPage: async () => ({ writes: [] }),
      commitHandles: async () => ({ deadLetterFailed: 0 }),
    };
    await runFrontfill(config({ initialLookbackSeconds: 7200, gapMaxPages: 1 }), {
      ...options,
      queryRelay: async (_relay, filter) => {
        if (filter.until === NOW) return emptyPage();
        return {
          reason: "max",
          events: [{ id: "gap", created_at: filter.until - 10 }],
        };
      },
    });
    expect(gapIsOpen(cursorDoc(db))).toBe(true);
    await runFrontfill(config({ initialLookbackSeconds: 7200, nowSec: NOW + 3600 }), {
      ...options,
      queryRelay: async (_relay, filter) => {
        filters.push(filter);
        return emptyPage();
      },
    });
    expect(filters[0]).toMatchObject({
      since: NOW - FRONTFILL_OVERLAP_SECONDS,
      until: NOW + 3600,
    });
  });

  it("starts at nextRelayIndex and persists the following relay before fetching", async () => {
    const db = memoryDb();
    db.docs.set(`relayCrawlerState/${FRONTFILL_RUN_DOC_ID}`, {
      nextRelayIndex: 2,
      revision: 1,
    });
    const relays = ["wss://a/", "wss://b/", "wss://c/"];
    const seen = [];
    await runFrontfill(
      config({ relays, initialLookbackSeconds: 0, kinds: [KIND] }),
      {
        db,
        queryRelay: async (relay) => {
          seen.push({ relay, next: runDoc(db).nextRelayIndex });
          return emptyPage();
        },
        processPage: async () => ({ writes: [] }),
        commitHandles: async () => ({ deadLetterFailed: 0 }),
      },
    );
    expect(seen.map((item) => item.relay)).toEqual(["wss://c/", "wss://a/", "wss://b/"]);
    expect(seen[0].next).toBe(0);
    expect(runDoc(db).nextRelayIndex).toBe(2);
  });

  it("keeps the advanced relay index when a fetch dies mid-list", async () => {
    const db = memoryDb();
    const relays = ["wss://a/", "wss://b/"];
    let fetches = 0;
    await expect(
      runFrontfill(config({ relays, initialLookbackSeconds: 0 }), {
        db,
        queryRelay: async () => {
          fetches += 1;
          if (fetches === 1) {
            expect(runDoc(db).nextRelayIndex).toBe(1);
            throw new Error("killed");
          }
          return emptyPage();
        },
        processPage: async () => ({ writes: [] }),
        commitHandles: async () => ({ deadLetterFailed: 0 }),
      }),
    ).rejects.toThrow(/frontfill failed/);
    expect(fetches).toBe(2);
  });

  it("stops opening cursors at the soft deadline and finishes the in-flight one", async () => {
    const db = memoryDb();
    let clock = 0;
    const calls = [];
    const result = await runFrontfill(
      config({
        relays: ["wss://a/", "wss://b/"],
        initialLookbackSeconds: 0,
        liveMaxPages: 2,
        runDeadlineMs: 1000,
      }),
      {
        db,
        now: () => clock,
        queryRelay: async (relay) => {
          calls.push(relay);
          if (calls.length === 1) {
            clock = 5_000;
            return { reason: "max", events: [{ id: "e", created_at: NOW - 10 }] };
          }
          return emptyPage();
        },
        processPage: async () => ({ writes: [] }),
        commitHandles: async () => ({ deadLetterFailed: 0 }),
      },
    );
    expect(calls).toEqual(["wss://a/", "wss://a/"]);
    expect(result.stoppedReason).toBe("run_deadline_reached");
    expect(result.summaries).toHaveLength(1);
  });
});

describe("frontfill packaging", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  it("schedules the frontfill job hourly with a 25 minute task timeout", () => {
    const deploy = readFileSync(
      path.join(root, "backend/deploy-nostr-atlas-frontfill.sh"),
      "utf8",
    );
    expect(deploy).toContain("nostr-atlas/frontfill.js");
    expect(deploy).toContain("nostr-atlas-frontfill");
    expect(deploy).toContain("0 * * * *");
    expect(deploy).toContain("1500");
    expect(deploy).toContain("FRONTFILL_RUN_DEADLINE_MS");
    expect(deploy).toContain("FRONTFILL_INITIAL_LOOKBACK_SECONDS");
    const projection = readFileSync(
      path.join(root, "backend/deploy-nostr-atlas-projection.sh"),
      "utf8",
    );
    expect(projection).toContain("nostr-atlas-projection-hourly");
    expect(projection).toContain("30 * * * *");
    expect(projection).toContain("nostr-atlas-projection-daily");
  });
});
