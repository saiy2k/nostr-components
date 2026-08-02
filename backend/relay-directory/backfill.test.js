// SPDX-License-Identifier: MIT

import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools";
import {
  createBoundedCache,
  decideBackfillCursor,
  isSuccessfulRelayPage,
  loadBackfillConfig,
  resolveRelays,
  runBackfill,
  runBackfillCursors,
  runBackfillCursor,
} from "./backfill.js";
import {
  buildBackfillCheckpointWrite,
  buildBackfillGapWrite,
  buildHandleWriteFailureWrite,
  buildSizeSafeDeadLetterPayload,
  handleWriteFailureId,
  MAX_DEAD_LETTER_PAYLOAD_BYTES,
} from "./ingestion.js";
import {
  createRunMetrics,
  finishRunMetrics,
  loadRelaysFromFile,
  parseRelaysJson,
  percentile,
  serializeFirestoreDataForJson,
  terminateFirestore,
} from "./runtime.js";
import { FieldValue } from "@google-cloud/firestore";

const SECRET_KEY = new Uint8Array(32).fill(1);

describe("backfill environment configuration", () => {
  it("uses lower daily-run limits and bounded claim retention", () => {
    expect(
      loadBackfillConfig(
        { FIRESTORE_PROJECT: "gr-test" },
        1000,
        {
          loadRelaysFromFile: () => ["wss://relay.example"],
        },
      ),
    ).toMatchObject({
      firestoreProject: "gr-test",
      firestoreHandlesCollection: "nostrDirectoryHandles",
      firestoreHandleWriteFailuresCollection:
        "nostrDirectoryHandleWriteFailures",
      relays: ["wss://relay.example"],
      backfillPageLimit: 250,
      backfillMaxPageLimit: 1000,
      backfillMaxPages: 4,
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

  it("loads relays from relays.json when RELAYS is unset", () => {
    expect(
      loadBackfillConfig(
        { FIRESTORE_PROJECT: "gr-test" },
        1000,
        {
          loadRelaysFromFile: (filePath) => {
            expect(filePath).toContain("relays.json");
            return ["wss://from-file.example"];
          },
        },
      ).relays,
    ).toEqual(["wss://from-file.example"]);
  });

  it("applies backfill CLI arguments instead of discarding them", () => {
    expect(
      loadBackfillConfig(
        { FIRESTORE_PROJECT: "gr-test" },
        1000,
        {},
        [
          "--relays",
          "wss://one.example,wss://two.example",
          "--backfill-page-limit",
          "50",
          "--backfill-max-pages",
          "5",
          "--no-backfill-resume",
        ],
      ),
    ).toMatchObject({
      relays: ["wss://one.example", "wss://two.example"],
      backfillPageLimit: 50,
      backfillMaxPages: 5,
      backfillResume: false,
    });
  });

  it("rejects unknown backfill CLI arguments", () => {
    expect(() =>
      loadBackfillConfig(
        { FIRESTORE_PROJECT: "gr-test" },
        1000,
        {},
        ["--unknown-backfill-flag"],
      ),
    ).toThrow("Unknown backfill argument: --unknown-backfill-flag");
  });

  it("fails fast when required configuration is missing", () => {
    expect(() =>
      loadBackfillConfig({}, 1000, {
        loadRelaysFromFile: () => ["wss://relay.example"],
      }),
    ).toThrow("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  });

  it("rejects inverted backfill windows", () => {
    expect(() =>
      loadBackfillConfig(
        {
          FIRESTORE_PROJECT: "gr-test",
          RELAYS: "wss://relay.example",
          BACKFILL_SINCE: "1001",
          BACKFILL_UNTIL: "1000",
        },
        2000,
      ),
    ).toThrow("BACKFILL_SINCE must be <= BACKFILL_UNTIL.");
  });
});

describe("relays.json loading", () => {
  it("parses ranked relay objects into URL order", () => {
    expect(
      parseRelaysJson([
        { rank: 2, url: "wss://two.example", count: 1 },
        { rank: 1, url: "wss://one.example", count: 9 },
        { rank: 3, url: "wss://one.example", count: 1 },
      ]),
    ).toEqual(["wss://one.example", "wss://two.example"]);
  });

  it("accepts a plain URL string array", () => {
    expect(parseRelaysJson(["wss://a.example", "wss://b.example"])).toEqual([
      "wss://a.example",
      "wss://b.example",
    ]);
  });

  it("loads the checked-in relays.json file", () => {
    const relays = loadRelaysFromFile();
    expect(relays.length).toBeGreaterThan(0);
    expect(relays[0]).toMatch(/^wss:\/\//);
    expect(new Set(relays).size).toBe(relays.length);
  });

  it("lets RELAYS_FILE override the default path", () => {
    expect(
      resolveRelays(
        { RELAYS_FILE: "/tmp/custom-relays.json" },
        {
          loadRelaysFromFile: (filePath) => {
            expect(filePath).toBe("/tmp/custom-relays.json");
            return ["wss://custom.example"];
          },
        },
      ),
    ).toEqual(["wss://custom.example"]);
  });

  it("prefers RELAYS env over the relays file", () => {
    expect(
      resolveRelays(
        { RELAYS: "wss://env.example", RELAYS_FILE: "/ignored.json" },
        { loadRelaysFromFile: () => ["wss://file.example"] },
      ),
    ).toEqual(["wss://env.example"]);
  });

  it("rejects an explicitly empty RELAYS value", () => {
    expect(() =>
      resolveRelays(
        { RELAYS: "" },
        { loadRelaysFromFile: () => ["wss://file.example"] },
      ),
    ).toThrow("RELAYS must not be empty when set.");
  });

  it("rejects malformed relay URLs", () => {
    expect(() => parseRelaysJson(["not-a-url"])).toThrow(
      "is not a valid URL",
    );
    expect(() => parseRelaysJson([{ rank: 1, url: "wss;//bad.example" }])).toThrow(
      "is not a valid URL",
    );
  });

  it("rejects non-WebSocket relay URLs", () => {
    expect(() => parseRelaysJson(["https://relay.example"])).toThrow(
      "must use ws:// or wss://",
    );
    expect(() =>
      parseRelaysJson([{ rank: 1, url: "http://relay.example" }]),
    ).toThrow("must use ws:// or wss://");
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

  it("dead-letters failed handle writes as stringified payload plus metadata", () => {
    const write = buildHandleWriteFailureWrite(
      {
        write: {
          collection: "handles",
          id: "twitter:bob",
          handle: "bob",
          data: {
            handle: "bob",
            claims: [
              {
                claimId: "event-b",
                sourceEventId: "event-b",
                sourceEvent: {
                  tags: [
                    {
                      values: [
                        "i",
                        "twitter:bob",
                        "https://x.com/bob/status/1",
                      ],
                    },
                  ],
                },
              },
            ],
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        error: Object.assign(
          new Error("Property array contains an invalid nested entity."),
          { code: 3 },
        ),
        relay: "wss://relay.example",
        kind: 10011,
        cursorUntil: 500,
        failedAt: "2026-07-16T12:00:00.000Z",
      },
      { firestoreHandleWriteFailuresCollection: "failures" },
    );

    expect(write.collection).toBe("failures");
    expect(write.id).toBe(
      handleWriteFailureId({
        targetDocumentId: "twitter:bob",
        relay: "wss://relay.example",
        kind: 10011,
        cursorUntil: 500,
        claimIds: ["event-b"],
      }),
    );
    expect(write.data).toMatchObject({
      status: "pending_review",
      handle: "bob",
      targetCollection: "handles",
      targetDocumentId: "twitter:bob",
      relay: "wss://relay.example",
      kind: 10011,
      cursorUntil: 500,
      claimIds: ["event-b"],
      sourceEventIds: ["event-b"],
      errorMessage: "Property array contains an invalid nested entity.",
      errorCode: 3,
      failedAt: "2026-07-16T12:00:00.000Z",
      payloadTruncated: false,
    });
    const payload = JSON.parse(write.data.payloadJson);
    expect(payload.handle).toBe("bob");
    expect(payload.claims[0].sourceEvent.tags).toEqual([
      {
        values: ["i", "twitter:bob", "https://x.com/bob/status/1"],
      },
    ]);
    expect(payload.updatedAt).toBe("<FieldValue>");
    expect(write.data.payloadByteLength).toBeGreaterThan(0);
  });

  it("uses deterministic dead-letter ids across retries", () => {
    const args = {
      write: {
        id: "twitter:bob",
        handle: "bob",
        data: { handle: "bob", claims: [{ claimId: "event-b" }] },
      },
      error: new Error("fail"),
      relay: "wss://relay.example",
      kind: 10011,
      cursorUntil: 500,
    };
    const first = buildHandleWriteFailureWrite(
      { ...args, failedAt: "2026-07-16T12:00:00.000Z" },
      { firestoreHandleWriteFailuresCollection: "failures" },
    );
    const second = buildHandleWriteFailureWrite(
      { ...args, failedAt: "2026-07-16T12:05:00.000Z" },
      { firestoreHandleWriteFailuresCollection: "failures" },
    );
    expect(first.id).toBe(second.id);
  });

  it("truncates oversized dead-letter payloads under the Firestore size budget", () => {
    const huge = "x".repeat(MAX_DEAD_LETTER_PAYLOAD_BYTES);
    const payload = buildSizeSafeDeadLetterPayload({
      handle: "bob",
      claims: [{ claimId: "event-huge", blob: huge }],
    });
    expect(payload.payloadTruncated).toBe(true);
    expect(payload.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.payloadByteLength).toBeGreaterThan(
      MAX_DEAD_LETTER_PAYLOAD_BYTES,
    );
    expect(Buffer.byteLength(payload.payloadJson, "utf8")).toBeLessThan(
      MAX_DEAD_LETTER_PAYLOAD_BYTES,
    );
    const summary = JSON.parse(payload.payloadJson);
    expect(summary).toMatchObject({
      truncated: true,
      handle: "bob",
      claimIds: ["event-huge"],
      payloadSha256: payload.payloadSha256,
    });
  });

  it("serializes FieldValue markers for JSON payloads", () => {
    expect(
      serializeFirestoreDataForJson({
        updatedAt: FieldValue.serverTimestamp(),
        nested: [{ values: ["ok"] }],
      }),
    ).toEqual({
      updatedAt: "<FieldValue>",
      nested: [{ values: ["ok"] }],
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

describe("backfill process lifecycle", () => {
  it("terminates Firestore after a successful run", async () => {
    const db = fakeFirestore();
    let terminates = 0;
    db.terminate = async () => {
      terminates += 1;
    };

    await runBackfill(testConfig({ relays: ["wss://relay.example"] }), null, {
      db,
      queryRelay: async () => ({ events: [], reason: "eose" }),
    });

    expect(terminates).toBe(1);
  });

  it("terminates Firestore even when the run throws", async () => {
    const db = fakeFirestore();
    let terminates = 0;
    db.terminate = async () => {
      terminates += 1;
    };
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "backfill-"));
    const blocker = path.join(tempDir, "not-a-directory");
    await writeFile(blocker, "x");

    await expect(
      runBackfill(
        testConfig({
          relays: ["wss://relay.example"],
          out: path.join(blocker, "out.json"),
        }),
        null,
        {
          db,
          queryRelay: async () => ({ events: [], reason: "eose" }),
        },
      ),
    ).rejects.toThrow();

    expect(terminates).toBe(1);
  });

  it("swallows terminate errors so the run result is preserved", async () => {
    await expect(
      terminateFirestore({
        terminate: async () => {
          throw new Error("already closed");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("does not hang forever when Firestore terminate never resolves", async () => {
    await expect(
      terminateFirestore(
        {
          terminate: () => new Promise(() => {}),
        },
        { timeoutMs: 20 },
      ),
    ).resolves.toBeUndefined();
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

  it("advances past a poison-pill handle while dead-lettering the failure", async () => {
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
      handleWriteDeadLetters: 1,
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
        collection: "failures",
        data: expect.objectContaining({
          handle: "bob",
          status: "pending_review",
          payloadJson: expect.stringContaining('"handle":"bob"'),
        }),
      }),
    );
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        collection: "state",
        data: expect.objectContaining({ status: "complete" }),
      }),
    );
  });

  it("advances when every handle write fails but each is dead-lettered", async () => {
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
      completed: true,
      retryPaused: false,
      directoryHandleWrites: 0,
      handleWriteFailures: 1,
      handleWriteDeadLetters: 1,
    });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        collection: "failures",
        data: expect.objectContaining({
          handle: "alice",
          status: "pending_review",
        }),
      }),
    );
    expect(db.writes.at(-1)).toMatchObject({
      collection: "state",
      data: { status: "complete" },
    });
  });

  it("keeps the cursor unmoved when dead-lettering a failed handle also fails", async () => {
    const db = fakeFirestore();
    db.failAllHandleWrites = true;
    db.failCollections.add("failures");
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
      lastReason: "handle-write-dead-letter-failed",
      directoryHandleWrites: 0,
      handleWriteFailures: 1,
      handleWriteDeadLetters: 0,
    });
    expect(db.writes.at(-1)).toMatchObject({
      collection: "state",
      data: { cursorUntil: 500, status: "retry_later" },
    });
  });

  it("does not let a failed handle commit poison later cursors", async () => {
    const db = fakeFirestore();
    const event = identityEvent(100);
    let handleCommitAttempts = 0;
    const originalBatch = db.batch.bind(db);
    db.batch = () => {
      const batch = originalBatch();
      const originalCommit = batch.commit;
      batch.commit = async () => {
        const pendingHandles = batch.pending.filter(
          (write) => write.collection === "handles",
        );
        if (pendingHandles.length) {
          handleCommitAttempts += 1;
          // Fail the first cursor's batch attempt and singleton fallback so the
          // write is dead-lettered; later cursors may commit successfully.
          if (handleCommitAttempts <= 2) {
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
    expect(result.totals.handleWriteDeadLetters).toBe(1);
    expect(result.totals.directoryHandleWrites).toBe(1);
    expect(
      db.writes.filter((write) => write.collection === "handles"),
    ).toHaveLength(1);
    expect(
      db.writes.filter((write) => write.collection === "failures"),
    ).toHaveLength(1);
  });

  it("commits a clean handle page in one Firestore batch", async () => {
    const db = fakeFirestore();
    const alice = identityEvent(100);
    const bob = finalizeEvent(
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
    let handleBatchCommits = 0;
    const originalBatch = db.batch.bind(db);
    db.batch = () => {
      const batch = originalBatch();
      const originalCommit = batch.commit;
      batch.commit = async () => {
        const pendingHandles = batch.pending.filter(
          (write) => write.collection === "handles",
        );
        if (pendingHandles.length) handleBatchCommits += 1;
        return originalCommit();
      };
      return batch;
    };

    await runBackfillCursor(
      db,
      "wss://relay.example",
      10011,
      testConfig({ backfillUntil: 500 }),
      {
        queryRelay: async () => ({
          events: [alice, bob],
          reason: "eose",
        }),
      },
    );

    expect(handleBatchCommits).toBe(1);
    expect(
      db.writes.filter((write) => write.collection === "handles"),
    ).toHaveLength(2);
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
    firestoreHandleWriteFailuresCollection: "failures",
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
    failCollections: new Set(),
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
          // Atomic like Firestore batches: validate all ops before applying any.
          for (const write of pending) {
            if (db.failCollections.has(write.collection)) {
              throw new Error(`write failed for collection ${write.collection}`);
            }
            if (
              write.collection === "handles" &&
              (db.failAllHandleWrites || db.failWritesForIds.has(write.id))
            ) {
              throw new Error(`write failed for ${write.id}`);
            }
          }
          for (const write of pending) {
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
