// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools";
import {
  createBoundedCache,
  decideBackfillCursor,
  isSuccessfulRelayPage,
  loadBackfillConfig,
  runBackfillCursors,
  runBackfillCursor,
} from "./backfill.js";
import {
  buildBackfillCheckpointWrite,
  buildBackfillGapWrite,
} from "./ingestion.js";
import { createRunMetrics, finishRunMetrics, percentile } from "./runtime.js";

const SECRET_KEY = new Uint8Array(32).fill(1);

describe("backfill environment configuration", () => {
  it("uses lower daily-run limits and bounded claim retention", () => {
    expect(
      loadBackfillConfig({ FIRESTORE_PROJECT: "gr-test" }, 1000),
    ).toMatchObject({
      firestoreProject: "gr-test",
      firestoreHandlesCollection: "nostrDirectoryHandles",
      backfillPageLimit: 250,
      backfillMaxPageLimit: 1000,
      backfillMaxPages: 20,
      backfillCacheLimit: 5000,
      maxPendingClaims: 20,
      maxInactiveVerifiedClaims: 10,
      maxRejectionTombstones: 100,
    });
  });

  it("reads all crawler settings from environment variables", () => {
    expect(
      loadBackfillConfig(
        {
          FIRESTORE_PROJECT: "gr-test",
          RELAYS: "wss://one.example,wss://two.example",
          BACKFILL_PAGE_LIMIT: "50",
          BACKFILL_MAX_PAGE_LIMIT: "200",
          BACKFILL_MAX_PAGES: "5",
          BACKFILL_RESUME: "0",
        },
        1000,
      ),
    ).toMatchObject({
      relays: ["wss://one.example", "wss://two.example"],
      backfillPageLimit: 50,
      backfillMaxPageLimit: 200,
      backfillMaxPages: 5,
      backfillResume: false,
    });
  });

  it("fails fast when required configuration is missing", () => {
    expect(() => loadBackfillConfig({}, 1000)).toThrow(
      "FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.",
    );
  });

  it("rejects inverted backfill windows", () => {
    expect(() =>
      loadBackfillConfig(
        {
          FIRESTORE_PROJECT: "gr-test",
          BACKFILL_SINCE: "1001",
          BACKFILL_UNTIL: "1000",
        },
        2000,
      ),
    ).toThrow("BACKFILL_SINCE must be <= BACKFILL_UNTIL.");
  });
});

describe("backfill Firestore writes", () => {
  it("stores resumable relay-kind checkpoints through the shared state id", () => {
    const write = buildBackfillCheckpointWrite(
      {
        relay: "wss://relay.example",
        kind: 10011,
        cursorUntil: 1709999999,
        oldestSeenAt: 1710000000,
        pageEvents: 10,
        validPageEvents: 8,
        pagesProcessed: 1,
        lastReason: "eose",
        completed: false,
      },
      { firestoreStateCollection: "state" },
    );

    expect(write).toMatchObject({
      collection: "state",
      id: "backfill:wss:__relay_example:kind:10011",
      data: expect.objectContaining({
        relay: "wss://relay.example",
        kind: 10011,
        status: "running",
      }),
    });
  });

  it("stores known gaps before skipping stuck timestamps", () => {
    const write = buildBackfillGapWrite(
      {
        relay: "wss://relay.example",
        kind: 10011,
        timestamp: 498,
        reason: "stuck_same_timestamp",
        pageLimit: 1000,
        seenEventIds: ["a", "b"],
      },
      { firestoreGapsCollection: "gaps" },
    );
    expect(write).toMatchObject({
      collection: "gaps",
      id: "wss:__relay_example:kind:10011:timestamp:498",
    });
  });
});

describe("stateful cursor orchestration", () => {
  it("writes claims before completing a successful cursor", async () => {
    const db = fakeFirestore();
    const event = identityEvent(100);
    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig(),
      {
        queryRelay: async () => ({
          events: [event],
          reason: "eose",
        }),
      },
    );

    expect(summary).toMatchObject({
      pages: 1,
      validEvents: 1,
      identityClaimsDiscovered: 1,
      directoryHandleWrites: 1,
      completed: true,
    });
    expect(db.writes.map((write) => write.collection)).toEqual([
      "handles",
      "state",
    ]);
    expect(db.writes[0].data.claims[0]).toMatchObject({
      claimId: event.id,
      pubkey: event.pubkey,
      sourceEvent: {
        id: event.id,
        kind: 10011,
        pubkey: event.pubkey,
        sig: event.sig,
      },
    });
    expect(db.writes[1]).toMatchObject({
      id: "backfill:wss:__relay_example:kind:10011",
      data: { status: "complete" },
    });
  });

  it("keeps the cursor unchanged when the relay page times out", async () => {
    const db = fakeFirestore();
    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({ backfillUntil: 500 }),
      {
        queryRelay: async () => ({ events: [], reason: "timeout" }),
      },
    );

    expect(summary).toMatchObject({
      completed: false,
      retryPaused: true,
      cursorUntil: 500,
      lastReason: "timeout",
    });
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({
      collection: "state",
      data: { cursorUntil: 500, status: "retry_later" },
    });
  });

  it("does not let an all-invalid full page advance the cursor", async () => {
    const db = fakeFirestore();
    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({ backfillUntil: 500 }),
      {
        queryRelay: async () => ({
          events: [
            {
              ...JSON.parse(JSON.stringify(identityEvent(100))),
              sig: "bad",
            },
          ],
          reason: "max",
        }),
      },
    );

    expect(summary).toMatchObject({
      cursorUntil: 500,
      retryPaused: true,
      lastReason: "page-contained-no-valid-events",
    });
  });

  it("resumes from an existing checkpoint", async () => {
    const db = fakeFirestore();
    db.seed("state", "backfill:wss:__relay_example:kind:10011", {
      status: "running",
      cursorUntil: 321,
      oldestSeenAt: 400,
      pageLimit: 20,
      boundaryTimestamp: 321,
      boundarySeenIds: ["seen"],
      stuckCount: 1,
    });
    let requestedFilter;

    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig(),
      {
        queryRelay: async (_relay, filter) => {
          requestedFilter = filter;
          return { events: [], reason: "eose" };
        },
      },
    );

    expect(requestedFilter.until).toBe(321);
    expect(summary).toMatchObject({
      cursorUntil: 321,
      oldestSeenAt: 400,
      completed: true,
    });
  });

  it("writes a gap when a resumed boundary is stuck at the maximum limit", async () => {
    const db = fakeFirestore();
    const event = identityEvent(100);
    db.seed("state", "backfill:wss:__relay_example:kind:10011", {
      status: "running",
      cursorUntil: 100,
      pageLimit: 10,
      boundaryTimestamp: 100,
      boundarySeenIds: [event.id],
      stuckCount: 1,
    });

    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({
        backfillPageLimit: 10,
        backfillMaxPageLimit: 10,
        backfillMaxPages: 1,
      }),
      {
        queryRelay: async () => ({ events: [event], reason: "max" }),
      },
    );

    expect(summary).toMatchObject({ gapsWritten: 1, cursorUntil: 99 });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        collection: "gaps",
        data: expect.objectContaining({
          timestamp: 100,
          reason: "stuck_same_timestamp",
        }),
      }),
    );
  });
});

describe("top-level cursor coordination", () => {
  it("continues after one relay-kind cursor fails", async () => {
    const db = fakeFirestore();
    const config = testConfig({
      relays: ["wss://one.example", "wss://two.example"],
    });
    const result = await runBackfillCursors(db, config, {
      queryRelay: async (relay, filter) => {
        if (relay === "wss://one.example" && filter.kinds[0] === 10011) {
          throw new Error("relay unavailable");
        }
        return { events: [], reason: "eose" };
      },
    });

    expect(result.cursorSummaries).toHaveLength(4);
    expect(result.totals).toMatchObject({
      relayKindCursors: 4,
      completedCursors: 3,
      failedCursors: 1,
    });
    expect(result.cursorSummaries[0]).toMatchObject({
      failed: true,
      error: "relay unavailable",
    });
  });

  it("reuses one connected NDK client for both kinds on a relay", async () => {
    const db = fakeFirestore();
    let connects = 0;
    let closes = 0;
    let subscriptions = 0;
    const client = {
      async connect() {
        connects += 1;
      },
      subscribe(_filter, handlers) {
        subscriptions += 1;
        queueMicrotask(handlers.onEose);
        return () => {};
      },
      close() {
        closes += 1;
      },
    };

    const result = await runBackfillCursors(
      db,
      testConfig({ relays: ["wss://relay.example"] }),
      { createRelayClient: () => client },
    );

    expect(result.totals.completedCursors).toBe(2);
    expect(connects).toBe(1);
    expect(subscriptions).toBe(2);
    expect(closes).toBe(1);
  });

  it("shares the bounded handle cache across relay-kind cursors", async () => {
    const db = fakeFirestore();
    const event = identityEvent(100);
    await runBackfillCursors(
      db,
      testConfig({
        relays: ["wss://one.example", "wss://two.example"],
      }),
      {
        queryRelay: async (_relay, filter) => ({
          events: filter.kinds[0] === 10011 ? [event] : [],
          reason: "eose",
        }),
      },
    );

    expect(db.readCount("handles")).toBe(1);
  });

  it("advances past a poison-pill handle while committing sibling writes", async () => {
    const db = fakeFirestore();
    const good = identityEvent(100);
    const bad = finalizeEvent(
      {
        kind: 10011,
        created_at: 100,
        content: "",
        tags: [
          ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
        ],
      },
      new Uint8Array(32).fill(2),
    );
    db.failWritesForIds.add(directoryHandleIdFor("bob"));

    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({ backfillUntil: 500 }),
      {
        queryRelay: async () => ({
          events: [good, bad],
          reason: "eose",
        }),
      },
    );

    expect(summary).toMatchObject({
      completed: true,
      directoryHandleWrites: 1,
      handleWriteFailures: 1,
      retryPaused: false,
    });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        collection: "handles",
        data: expect.objectContaining({ handle: "alice" }),
      }),
    );
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        collection: "state",
        data: expect.objectContaining({ status: "complete" }),
      }),
    );
  });

  it("keeps the cursor unmoved when every handle write fails", async () => {
    const db = fakeFirestore();
    db.failAllHandleWrites = true;
    const event = identityEvent(100);

    const summary = await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({ backfillUntil: 500 }),
      {
        queryRelay: async () => ({
          events: [event],
          reason: "eose",
        }),
      },
    );

    expect(summary).toMatchObject({
      completed: false,
      retryPaused: true,
      cursorUntil: 500,
      lastReason: "handle-writes-failed",
      directoryHandleWrites: 0,
      handleWriteFailures: 1,
    });
    expect(db.writes.at(-1)).toMatchObject({
      collection: "state",
      data: { cursorUntil: 500, status: "retry_later" },
    });
  });

  it("does not let a failed handle commit poison later cursors", async () => {
    const db = fakeFirestore();
    const event = identityEvent(100);
    let handleCommits = 0;
    const originalBatch = db.batch.bind(db);
    db.batch = () => {
      const batch = originalBatch();
      const originalCommit = batch.commit;
      batch.commit = async () => {
        const pendingHandles = batch.pending.filter(
          (write) => write.collection === "handles",
        );
        if (pendingHandles.length) {
          handleCommits += 1;
          if (handleCommits === 1) {
            throw new Error("firestore unavailable");
          }
        }
        return originalCommit();
      };
      return batch;
    };

    const result = await runBackfillCursors(
      db,
      testConfig({
        relays: ["wss://one.example", "wss://two.example"],
      }),
      {
        queryRelay: async (_relay, filter) => ({
          events: filter.kinds[0] === 10011 ? [event] : [],
          reason: "eose",
        }),
      },
    );

    expect(result.totals.handleWriteFailures).toBe(1);
    expect(result.totals.directoryHandleWrites).toBe(1);
    expect(
      db.writes.filter((write) => write.collection === "handles"),
    ).toHaveLength(1);
  });
});

function directoryHandleIdFor(handle) {
  return `twitter:${handle}`;
}

describe("relay page completion", () => {
  it("accepts only EOSE and full-page completion reasons", () => {
    expect(isSuccessfulRelayPage("eose")).toBe(true);
    expect(isSuccessfulRelayPage("max")).toBe(true);
    expect(isSuccessfulRelayPage("timeout")).toBe(false);
    expect(isSuccessfulRelayPage("closed:auth-required")).toBe(false);
  });
});

describe("decideBackfillCursor", () => {
  const base = {
    defaultPageLimit: 100,
    maxPageLimit: 400,
    stuckCount: 0,
    pageLimit: 100,
    boundaryTimestamp: null,
    boundarySeenIds: [],
  };

  it("moves to the oldest timestamp when the page progresses", () => {
    expect(
      decideBackfillCursor({
        ...base,
        cursorUntil: 500,
        pageOldest: 498,
        pageEvents: [
          { id: "a", created_at: 500 },
          { id: "b", created_at: 498 },
        ],
      }),
    ).toMatchObject({
      action: "progress",
      cursorUntil: 498,
      boundarySeenIds: ["b"],
    });
  });

  it("drains new ids at the same timestamp", () => {
    expect(
      decideBackfillCursor({
        ...base,
        cursorUntil: 498,
        pageOldest: 498,
        boundaryTimestamp: 498,
        boundarySeenIds: ["a", "b"],
        pageEvents: [
          { id: "a", created_at: 498 },
          { id: "b", created_at: 498 },
          { id: "c", created_at: 498 },
        ],
      }),
    ).toMatchObject({
      action: "drain-boundary",
      boundarySeenIds: ["a", "b", "c"],
    });
  });

  it("increases the page limit before recording a gap", () => {
    expect(
      decideBackfillCursor({
        ...base,
        cursorUntil: 498,
        pageOldest: 498,
        boundaryTimestamp: 498,
        boundarySeenIds: ["a", "b"],
        pageEvents: [
          { id: "a", created_at: 498 },
          { id: "b", created_at: 498 },
        ],
      }),
    ).toMatchObject({
      action: "increase-limit",
      pageLimit: 200,
      gap: null,
    });
  });

  it("records a gap after reaching the maximum page limit", () => {
    expect(
      decideBackfillCursor({
        ...base,
        cursorUntil: 498,
        pageOldest: 498,
        pageLimit: 400,
        boundaryTimestamp: 498,
        boundarySeenIds: ["a"],
        pageEvents: [{ id: "a", created_at: 498 }],
      }),
    ).toMatchObject({
      action: "skip-gap",
      cursorUntil: 497,
      gap: {
        timestamp: 498,
        reason: "stuck_same_timestamp",
      },
    });
  });
});

describe("bounded shared caches", () => {
  it("evicts oldest entries instead of growing for the whole run", () => {
    const cache = createBoundedCache(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect([...cache.keys()]).toEqual(["b", "c"]);
  });
});

describe("run metrics", () => {
  it("creates stable run ids and counters", () => {
    const run = createRunMetrics(
      "backfill",
      new Date("2026-06-19T10:00:00.000Z"),
    );
    run.timings.push(10, 20, 100);
    expect(
      finishRunMetrics(
        run,
        { eventsRead: 3 },
        new Date("2026-06-19T10:00:02.000Z"),
      ),
    ).toMatchObject({
      runId: "backfill-2026-06-19T10:00:00_000Z",
      durationMs: 2000,
      avgProcessingMs: 43,
      p95ProcessingMs: 100,
    });
  });

  it("calculates percentiles", () => {
    expect(percentile([100, 10, 20, 30], 50)).toBe(20);
    expect(percentile([], 95)).toBe(0);
  });
});

function identityEvent(createdAt) {
  return finalizeEvent(
    {
      kind: 10011,
      created_at: createdAt,
      content: "",
      tags: [
        ["i", "twitter:alice", "https://x.com/alice/status/1234567890123"],
      ],
    },
    SECRET_KEY,
  );
}

function testConfig(overrides = {}) {
  return {
    firestoreProject: "gr-test",
    firestoreDatabase: "(default)",
    firestoreHandlesCollection: "handles",
    firestoreStateCollection: "state",
    firestoreGapsCollection: "gaps",
    backfillStatePrefix: "backfill",
    backfillResume: true,
    backfillUntil: 1000,
    backfillSince: 0,
    backfillPageLimit: 10,
    backfillMaxPageLimit: 40,
    backfillMaxPages: 10,
    backfillCacheLimit: 50,
    timeoutMs: 1000,
    maxPendingClaims: 20,
    maxInactiveVerifiedClaims: 10,
    maxRejectionTombstones: 100,
    xMentionCheckTimeoutMs: 1000,
    ...overrides,
  };
}

function fakeFirestore() {
  const writes = [];
  const documents = new Map();
  const reads = new Map();
  const db = {
    writes,
    failWritesForIds: new Set(),
    failAllHandleWrites: false,
    readCount(collection) {
      return reads.get(collection) || 0;
    },
    seed(collection, id, data) {
      documents.set(`${collection}/${id}`, data);
    },
    collection(collection) {
      return {
        doc(id) {
          return {
            collection,
            id,
            get: async () => {
              reads.set(collection, (reads.get(collection) || 0) + 1);
              const data = documents.get(`${collection}/${id}`);
              return {
                exists: data !== undefined,
                data: () => data || null,
              };
            },
          };
        },
      };
    },
    batch() {
      const pending = [];
      return {
        pending,
        set(ref, data) {
          pending.push({ collection: ref.collection, id: ref.id, data });
        },
        commit: async () => {
          for (const write of pending) {
            if (
              write.collection === "handles" &&
              (db.failAllHandleWrites || db.failWritesForIds.has(write.id))
            ) {
              throw new Error(`write failed for ${write.id}`);
            }
            writes.push(write);
            documents.set(`${write.collection}/${write.id}`, {
              ...(documents.get(`${write.collection}/${write.id}`) || {}),
              ...write.data,
            });
          }
        },
      };
    },
  };
  return db;
}
