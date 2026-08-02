// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";
import {
  buildLiveEventWrite,
  buildLiveHeartbeatWrite,
  liveStateId,
} from "./ingestion.js";
import {
  listenRelayLive,
  parseLiveArgs,
  rememberSeenEventId,
  runLiveMonitor,
} from "./live-monitor.js";

const PUBKEY =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";

describe("parseLiveArgs", () => {
  it("validates the NDK connection timeout", () => {
    expect(() =>
      parseLiveArgs([
        "--firestore-project",
        "gr-prod",
        "--live-connect-timeout-ms",
        "0",
      ]),
    ).toThrow("--live-connect-timeout-ms must be positive.");
  });
});

describe("NDK live subscription adapter", () => {
  it("streams events and lets NDK own relay lifecycle handling", async () => {
    const controller = new AbortController();
    const events = [];
    const statuses = [];
    let statusHandlers;
    let stopped = false;

    const listening = listenRelayLive(
      "wss://relay.example",
      {
        liveConnectTimeoutMs: 1000,
        liveHeartbeatIntervalMs: 60000,
      },
      {
        signal: controller.signal,
        onConnectAttempt: () => statuses.push("connecting"),
        onReconnect: () => statuses.push("reconnecting"),
        onDisconnect: () => statuses.push("disconnected"),
        onError: () => statuses.push("error"),
        onEvent: (event) => {
          events.push(event);
          controller.abort();
        },
        onHeartbeat: async () => {},
      },
      () => ({
        onStatus(handlers) {
          statusHandlers = handlers;
          return () => {};
        },
        async connect() {
          statusHandlers.onConnecting();
          statusHandlers.onConnect();
        },
        subscribe(_filter, handlers) {
          queueMicrotask(() => handlers.onEvent({ id: "live-event" }));
          return () => {
            stopped = true;
          };
        },
        close: () => {},
      }),
    );

    await listening;
    expect(events).toEqual([{ id: "live-event" }]);
    expect(statuses).toEqual(["connecting"]);
    expect(stopped).toBe(true);
  });
});

describe("live monitor Firestore writes", () => {
  it("stores live events without overwriting projection state", () => {
    const write = buildLiveEventWrite(
      {
        id: "live-event",
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1710000001,
        content: "",
        tags: [["i", "twitter:alice", "proof"]],
        sig: "sig",
      },
      "wss://relay.example",
      { firestoreEventsCollection: "events" },
    );

    expect(write).toMatchObject({
      collection: "events",
      id: "live-event",
      data: {
        ingestion: expect.objectContaining({
          mode: "live",
          lastRelay: "wss://relay.example",
        }),
      },
    });
    expect(write.data.processing).toBeUndefined();
    expect(write.data.eventJson).toBeUndefined();
  });

  it("keeps event id dedupe bounded", () => {
    const seen = new Set();
    const queue = [];

    expect(rememberSeenEventId("a", seen, queue, 2)).toBe(true);
    expect(rememberSeenEventId("b", seen, queue, 2)).toBe(true);
    expect(rememberSeenEventId("a", seen, queue, 2)).toBe(false);
    expect(rememberSeenEventId("c", seen, queue, 2)).toBe(true);
    expect([...seen]).toEqual(["b", "c"]);
    expect(queue).toEqual(["b", "c"]);
  });

  it("stores heartbeat state by relay id", () => {
    const write = buildLiveHeartbeatWrite(
      {
        relay: "wss://relay.example",
        status: "connected",
        mode: "live",
        connected: true,
        lastEventAt: "2026-06-19T10:00:00.000Z",
        attempts: 2,
      },
      { firestoreStateCollection: "state" },
    );

    expect(liveStateId("wss://relay.example")).toBe("live:wss:__relay_example");
    expect(write).toMatchObject({
      collection: "state",
      id: "live:wss:__relay_example",
      data: expect.objectContaining({
        status: "connected",
        connected: true,
        connectAttempts: 2,
      }),
    });
  });

  it("contains flush failures, bounds the buffer, and still shuts down", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const commitWrites = vi.fn(async (_db, writes) => {
      if (writes[0]?.collection === "events") {
        throw new Error("firestore unavailable");
      }
    });
    const output = await runLiveMonitor(
      {
        relays: ["wss://relay.example"],
        firestoreProject: "gr-prod",
        firestoreDatabase: "(default)",
        firestoreEventsCollection: "events",
        firestoreQueueCollection: "queue",
        firestoreStateCollection: "state",
        firestoreLiveRunsCollection: "runs",
        liveDurationMs: 0,
        liveFlushLimit: 1,
        liveFlushIntervalMs: 60000,
        liveHeartbeatIntervalMs: 60000,
        liveSeenCacheLimit: 10,
        liveConnectTimeoutMs: 1000,
        out: null,
      },
      null,
      {
        db: {},
        isValidSignedEvent: () => true,
        commitFirestoreWrites: commitWrites,
        listenRelayLive: async (_relay, _args, callbacks) => {
          for (let index = 0; index < 12; index += 1) {
            callbacks.onEvent({
              id: `live-event-${index}`,
              kind: 10011,
              pubkey: PUBKEY,
              created_at: 100 + index,
              tags: [],
              content: "",
              sig: "sig",
            });
          }
        },
      },
    );

    expect(output.stats).toMatchObject({
      flushFailures: 2,
      droppedWrites: 12,
      validEventsWritten: 0,
    });
    expect(commitWrites).toHaveBeenLastCalledWith(
      {},
      [expect.objectContaining({ collection: "runs" })],
    );
    errorLog.mockRestore();
  });

  it("flushes buffered events on the interval before reaching the limit", async () => {
    const commitWrites = vi.fn(async () => {});
    const output = await runLiveMonitor(
      {
        relays: ["wss://relay.example"],
        firestoreProject: "gr-prod",
        firestoreDatabase: "(default)",
        firestoreEventsCollection: "events",
        firestoreQueueCollection: "queue",
        firestoreStateCollection: "state",
        firestoreLiveRunsCollection: "runs",
        liveDurationMs: 0,
        liveFlushLimit: 10,
        liveFlushIntervalMs: 1,
        liveHeartbeatIntervalMs: 60000,
        liveSeenCacheLimit: 10,
        liveConnectTimeoutMs: 1000,
        out: null,
      },
      null,
      {
        db: {},
        isValidSignedEvent: () => true,
        commitFirestoreWrites: commitWrites,
        listenRelayLive: async (_relay, _args, callbacks) => {
          callbacks.onEvent({
            id: "interval-event",
            kind: 10011,
            pubkey: PUBKEY,
            created_at: 100,
            tags: [],
            content: "",
            sig: "sig",
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      },
    );

    expect(output.stats).toMatchObject({
      flushes: 1,
      validEventsWritten: 1,
      flushFailures: 0,
    });
    expect(commitWrites).toHaveBeenCalledWith(
      {},
      [expect.objectContaining({ collection: "events" })],
    );
  });
});
