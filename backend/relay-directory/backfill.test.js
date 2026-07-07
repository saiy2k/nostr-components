// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools";
import {
  decideBackfillCursor,
  isSuccessfulRelayPage,
  loadBackfillConfig,
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
});

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
  return {
    writes,
    collection(collection) {
      return {
        doc(id) {
          return {
            collection,
            id,
            get: async () => ({ exists: false, data: () => null }),
          };
        },
      };
    },
    batch() {
      return {
        set(ref, data) {
          writes.push({ collection: ref.collection, id: ref.id, data });
        },
        commit: async () => {},
      };
    },
  };
}
