// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  buildBackfillCheckpointWrite,
  buildBackfillEventWrite,
  buildBackfillGapWrite,
  buildProjectionQueueCreateWrite,
} from "./ingestion.mjs";
import { decideBackfillCursor, parseBackfillArgs } from "./backfill.mjs";
import {
  buildRunSummaryWrite,
  createRunMetrics,
  finishRunMetrics,
  percentile,
} from "./runtime.mjs";

const PUBKEY =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";

describe("parseBackfillArgs", () => {
  it("rejects missing values for value-taking flags", () => {
    expect(() => parseBackfillArgs(["--relays"])).toThrow(
      "--relays requires a value.",
    );
  });

  it("rejects another option where a value is required", () => {
    expect(() =>
      parseBackfillArgs([
        "--firestore-project",
        "gr-prod",
        "--relays",
        "--out",
      ]),
    ).toThrow("--relays requires a value.");
  });
});

describe("backfill Firestore writes", () => {
  it("stores raw relay events by event id", () => {
    const write = buildBackfillEventWrite(
      {
        id: "event-id",
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1710000000,
        content: "",
        tags: [["i", "twitter:alice", "proof"]],
        sig: "sig",
      },
      "wss://relay.example",
      { firestoreEventsCollection: "events" },
    );

    expect(write).toMatchObject({
      collection: "events",
      id: "event-id",
      data: {
        id: "event-id",
        kind: 10011,
        pubkey: PUBKEY,
        createdAt: 1710000000,
        ingestion: expect.objectContaining({
          mode: "backfill",
          lastRelay: "wss://relay.example",
        }),
      },
    });
  });

  it("creates a projection queue doc only when missing", () => {
    const write = buildProjectionQueueCreateWrite(
      {
        id: "event-id",
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1710000000,
      },
      "backfill",
      { firestoreQueueCollection: "queue" },
    );

    expect(write).toMatchObject({
      operation: "createIfMissing",
      collection: "queue",
      id: "event-id",
      data: expect.objectContaining({
        eventId: "event-id",
        sourceMode: "backfill",
        status: "pending",
      }),
    });
  });

  it("stores resumable relay-kind checkpoints", () => {
    const write = buildBackfillCheckpointWrite(
      {
        relay: "wss://relay.example",
        kind: 10011,
        cursorUntil: 1709999999,
        oldestSeenAt: 1710000000,
        pageEvents: 10,
        validPageEvents: 8,
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

  it("stores overlap checkpoints separately", () => {
    const write = buildBackfillCheckpointWrite(
      {
        relay: "wss://relay.example",
        kind: 0,
        cursorUntil: 500,
        oldestSeenAt: 450,
        pageEvents: 10,
        validPageEvents: 9,
        lastReason: "eose",
        completed: false,
      },
      {
        firestoreStateCollection: "state",
        backfillStatePrefix: "overlap",
      },
    );

    expect(write).toMatchObject({
      id: "overlap:wss:__relay_example:kind:0",
      data: expect.objectContaining({
        statePrefix: "overlap",
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
        pageLimit: 2000,
        seenEventIds: ["a", "b"],
      },
      { firestoreGapsCollection: "gaps" },
    );

    expect(write).toMatchObject({
      collection: "gaps",
      id: "wss:__relay_example:kind:10011:timestamp:498",
      data: expect.objectContaining({
        timestamp: 498,
        seenEventIds: ["a", "b"],
      }),
    });
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

  it("increases the page limit before skipping a stuck timestamp", () => {
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

  it("records a gap after the max page limit is exhausted", () => {
    expect(
      decideBackfillCursor({
        ...base,
        cursorUntil: 498,
        pageOldest: 498,
        pageLimit: 400,
        boundaryTimestamp: 498,
        boundarySeenIds: ["a", "b"],
        pageEvents: [
          { id: "a", created_at: 498 },
          { id: "b", created_at: 498 },
        ],
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
      module: "backfill",
      component: "backfill",
      runId: "backfill-2026-06-19T10:00:00_000Z",
      durationMs: 2000,
      avgProcessingMs: 43,
      p95ProcessingMs: 100,
      counters: { eventsRead: 3 },
    });
  });

  it("calculates percentiles", () => {
    expect(percentile([100, 10, 20, 30], 50)).toBe(20);
    expect(percentile([], 95)).toBe(0);
  });

  it("builds one Firestore summary write per run", () => {
    expect(
      buildRunSummaryWrite(
        {
          module: "backfill",
          component: "backfill",
          runId: "backfill-run",
          counters: { eventsWritten: 10 },
        },
        {
          mode: "backfill",
          relays: ["wss://relay.example"],
          stats: { validEvents: 10 },
          firestore: { project: "gr-prod" },
        },
        "backfillRuns",
      ),
    ).toMatchObject({
      collection: "backfillRuns",
      id: "backfill-run",
      data: expect.objectContaining({
        mode: "backfill",
        stats: { validEvents: 10 },
      }),
    });
  });
});
