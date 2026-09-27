// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  buildLiveEventWrite,
  buildLiveHeartbeatWrite,
  liveStateId,
} from "./ingestion.js";
import {
  listenRelayLive,
  parseLiveArgs,
  rememberSeenEventId,
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
});
