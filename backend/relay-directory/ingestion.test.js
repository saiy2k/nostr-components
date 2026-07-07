// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { queryRelay } from "./ingestion.js";

describe("NDK relay query adapter", () => {
  it("returns every subscription event without replaceable-event collapsing", async () => {
    const stopped = [];
    const closed = [];
    const events = [
      { id: "old", kind: 10011, pubkey: "same", created_at: 100 },
      { id: "new", kind: 10011, pubkey: "same", created_at: 200 },
    ];
    const result = await queryRelay(
      "wss://relay.example",
      { kinds: [10011], until: 500 },
      { timeoutMs: 1000, max: 10 },
      () => ({
        connect: async () => {},
        subscribe(_filter, handlers) {
          queueMicrotask(() => {
            events.forEach(handlers.onEvent);
            handlers.onEose();
          });
          return () => stopped.push(true);
        },
        close: () => closed.push(true),
      }),
    );

    expect(result).toEqual({
      relay: "wss://relay.example",
      events,
      reason: "eose",
    });
    expect(stopped).toHaveLength(1);
    expect(closed).toHaveLength(1);
  });

  it("stops at the requested page size", async () => {
    const result = await queryRelay(
      "wss://relay.example",
      { kinds: [0] },
      { timeoutMs: 1000, max: 1 },
      () => ({
        connect: async () => {},
        subscribe(_filter, handlers) {
          queueMicrotask(() => {
            handlers.onEvent({ id: "first" });
            handlers.onEvent({ id: "second" });
          });
          return () => {};
        },
        close: () => {},
      }),
    );

    expect(result).toMatchObject({
      events: [{ id: "first" }],
      reason: "max",
    });
  });

  it("surfaces relay closure without treating it as EOSE", async () => {
    const result = await queryRelay(
      "wss://relay.example",
      { kinds: [0] },
      { timeoutMs: 1000, max: 10 },
      () => ({
        connect: async () => {},
        subscribe(_filter, handlers) {
          queueMicrotask(() => handlers.onClosed("auth-required"));
          return () => {};
        },
        close: () => {},
      }),
    );
    expect(result.reason).toBe("closed:auth-required");
  });
});
