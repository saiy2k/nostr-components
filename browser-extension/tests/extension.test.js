// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it } from "vitest";

await import("../lib/url.js");
await import("../lib/storage.js");
await import("../lib/directory.js");
await import("../lib/relay-pool.js");
await import("../lib/reactions.js");
await import("../lib/dom.js");

const extension = globalThis.NostrLikeExtension;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = new Map();
    this.sent = [];
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.emit("open", {});
    });
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", {});
  }
}

beforeEach(function () {
  FakeWebSocket.instances = [];
});

afterEach(function () {
  delete globalThis.browser;
  delete globalThis.chrome;
});

describe("URL normalization", function () {
  it("uses the nostr-tools normalization behavior for status identifiers", function () {
    const parsed = extension.url.parseTweetUrl(
      "/Jack/status/1234567890/?s=20#fragment",
      "https://x.com",
    );

    expect(parsed).toEqual({
      pathname: "/Jack/status/1234567890",
      username: "jack",
      statusId: "1234567890",
      canonicalUrl: "https://x.com/Jack/status/1234567890",
    });
  });
});

describe("reaction summaries", function () {
  it("counts only each author latest reaction", function () {
    const summary = extension.reactions.summarize(
      [
        { id: "a1", pubkey: "a", created_at: 1, content: "+" },
        { id: "a2", pubkey: "a", created_at: 2, content: "-" },
        { id: "b1", pubkey: "b", created_at: 1, content: "+" },
      ],
      "a",
    );

    expect(summary).toEqual({ likeCount: 1, isLiked: false });
  });
});

describe("extension-private storage and Firestore directory lookup", function () {
  it("stores reaction state through chrome.storage.local", async function () {
    const values = {};
    globalThis.chrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get(key, callback) {
            callback({ [key]: values[key] });
          },
          set(next, callback) {
            Object.assign(values, next);
            callback();
          },
        },
      },
    };

    await extension.storage.setReactionState(
      "https://x.com/a/status/1",
      "pubkey",
      true,
    );

    await expect(
      extension.storage.getReactionState("https://x.com/a/status/1", "pubkey"),
    ).resolves.toBe(true);
  });

  it("queries the Firestore-backed runtime endpoint for author identity", async function () {
    const stored = {};
    const requested = [];
    globalThis.browser = {
      runtime: {
        async sendMessage(message) {
          requested.push(message);
          return {
            ok: true,
            result: {
              found: true,
              verified: true,
              handle: message.handle,
              activeIdentity: { npub: "npub1test" },
            },
          };
        },
      },
      storage: {
        local: {
          async get(key) {
            return { [key]: stored[key] };
          },
          async set(next) {
            Object.assign(stored, next);
          },
        },
      },
    };

    const result = await extension.directory.lookup("FireStoreUser");

    expect(requested).toEqual([
      {
        type: "LOOKUP_DIRECTORY_HANDLE",
        platform: "twitter",
        handle: "firestoreuser",
      },
    ]);
    expect(result).toMatchObject({
      verified: true,
      source: "firestore",
      activeIdentity: { npub: "npub1test" },
    });
  });
});

describe("X action placement", function () {
  it("inserts the Nostr action immediately after X's native Like control", function () {
    const viewsContainer = { name: "views" };
    const actionBar = {
      querySelector() {
        return nativeLike;
      },
      insertBefore(slot, sibling) {
        this.inserted = { slot, sibling };
      },
      appendChild() {
        throw new Error("placement should not fall back to appendChild");
      },
    };
    const likeContainer = {
      parentElement: actionBar,
      nextSibling: viewsContainer,
    };
    const nestedContainer = { parentElement: likeContainer };
    const nativeLike = { parentElement: nestedContainer };
    const nostrSlot = { name: "nostr" };

    extension.dom.insertAfterNativeLike(actionBar, nostrSlot);

    expect(actionBar.inserted).toEqual({
      slot: nostrSlot,
      sibling: viewsContainer,
    });
  });
});

describe("shared relay pool", function () {
  it("reuses one connection for repeated queries to the same relay", async function () {
    const pool = new extension.RelayPool(["wss://relay.example"], {
      WebSocketCtor: FakeWebSocket,
      connectionTimeoutMs: 25,
      queryTimeoutMs: 5,
    });

    await pool.query({ kinds: [17] });
    await pool.query({ kinds: [17] });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(
      FakeWebSocket.instances[0].sent.filter((message) => message[0] === "REQ"),
    ).toHaveLength(2);
    pool.close();
  });

  it("does not treat relay silence as a successful publish", async function () {
    const pool = new extension.RelayPool(["wss://relay.example"], {
      WebSocketCtor: FakeWebSocket,
      connectionTimeoutMs: 25,
      publishTimeoutMs: 5,
    });

    const result = await pool.publish({ id: "event-id" });

    expect(result).toMatchObject({ ok: false, openCount: 1, okCount: 0 });
    pool.close();
  });

  it("requires an explicit OK acknowledgment for success", async function () {
    const pool = new extension.RelayPool(["wss://relay.example"], {
      WebSocketCtor: FakeWebSocket,
      connectionTimeoutMs: 25,
      publishTimeoutMs: 25,
    });

    const pending = pool.publish({ id: "event-id" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    FakeWebSocket.instances[0].emit("message", {
      data: JSON.stringify(["OK", "event-id", true, "saved"]),
    });

    await expect(pending).resolves.toMatchObject({ ok: true, okCount: 1 });
    pool.close();
  });
});
