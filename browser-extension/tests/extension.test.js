// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { finalizeEvent } from "nostr-tools";

await import("../lib/url.js");
await import("../lib/storage.js");
await import("../lib/directory.js");
await import("../lib/relay-client.js");
await import("../lib/dom.js");

const extension = globalThis.NostrLikeExtension;

beforeEach(function () {
  vi.restoreAllMocks();
});

afterEach(function () {
  delete globalThis.browser;
  delete globalThis.chrome;
  delete globalThis.document;
  delete globalThis.MutationObserver;
  delete globalThis.window;
  delete globalThis.__nostrComponentsRelayTransport;
});

describe("URL normalization", function () {
  it("uses the repository normalizer for X status identifiers", function () {
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

  it("rejects status-shaped URLs from unsupported hosts", function () {
    expect(
      extension.url.parseTweetUrl("https://example.com/Jack/status/1234567890"),
    ).toBeNull();
  });
});

describe("Firestore directory cache", function () {
  it("queries the background lookup and stores a sanitized identity", async function () {
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

    const result = await extension.directory.lookup("ComponentUser");

    expect(requested).toEqual([
      {
        type: "LOOKUP_DIRECTORY_HANDLE",
        platform: "twitter",
        handle: "componentuser",
      },
    ]);
    expect(result).toMatchObject({
      verified: true,
      source: "firestore",
      activeIdentity: { npub: "npub1test" },
    });
  });

  it("re-resolves entries after memory and storage expiry", async function () {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(function () {
      return now;
    });
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
              activeIdentity: { npub: "npub1expiring" },
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

    await extension.directory.lookup("ExpiryUser");
    await extension.directory.lookup("ExpiryUser");
    expect(requested).toHaveLength(1);

    now += 24 * 60 * 60 * 1000 + 1;
    await extension.directory.lookup("ExpiryUser");
    expect(requested).toHaveLength(2);
  });
});

describe("X action placement", function () {
  it("selects and inserts into the group that owns X's native Like", function () {
    const unrelatedGroup = { name: "unrelated" };
    const viewsContainer = { name: "views" };
    const actionBar = {
      querySelector() {
        return nativeLike;
      },
      insertBefore(slot, sibling) {
        this.inserted = { slot: slot, sibling: sibling };
      },
    };
    const likeContainer = {
      parentElement: actionBar,
      nextSibling: viewsContainer,
    };
    const nativeLike = {
      parentElement: likeContainer,
      closest() {
        return actionBar;
      },
    };
    const article = {
      querySelector(selector) {
        return selector.includes("data-testid") ? nativeLike : unrelatedGroup;
      },
    };
    const nostrSlot = { name: "nostr" };

    const selectedActionBar = extension.dom.findActionBar(article);
    extension.dom.insertAfterNativeLike(selectedActionBar, nostrSlot);

    expect(selectedActionBar).toBe(actionBar);
    expect(actionBar.inserted).toEqual({
      slot: nostrSlot,
      sibling: viewsContainer,
    });
    expect(unrelatedGroup.inserted).toBeUndefined();
  });

  it("contains clicks inside the complete Nostr action slot", function () {
    const listeners = {};
    class FakeElement {
      constructor(tagName) {
        this.tagName = tagName;
        this.attributes = {};
        this.children = [];
        this.dataset = {};
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
      }

      getAttribute(name) {
        return this.attributes[name] ?? null;
      }

      appendChild(child) {
        this.children.push(child);
      }

      addEventListener(type, listener) {
        listeners[type] = listener;
      }
    }

    globalThis.document = {
      createElement(tagName) {
        return new FakeElement(tagName);
      },
    };

    const action = extension.dom.createNostrAction(
      {
        canonicalUrl: "https://x.com/alokdangre/status/42",
        statusId: "42",
        username: "alokdangre",
      },
      "dark",
    );
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    listeners.click(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(action.component.getAttribute("compact")).toBe("");
  });
});

describe("CSP-safe component and relay integration", function () {
  it("loads the relay client and MAIN-world component loader in order", function () {
    const manifest = JSON.parse(
      readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
    );
    const scripts = manifest.content_scripts[0].js;

    expect(scripts).toContain("lib/relay-client.js");
    expect(scripts).toContain("lib/component-loader.js");
    expect(scripts.indexOf("lib/relay-client.js")).toBeLessThan(
      scripts.indexOf("lib/component-loader.js"),
    );
    expect(scripts).not.toContain("lib/nostr-like-button.js");
    expect(scripts).not.toContain("lib/signer-adapter.js");
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "wss://relay.damus.io/*",
        "wss://nostr.wine/*",
        "wss://relay.nostr.net/*",
        "wss://relay.nostr.band/*",
        "wss://nos.lol/*",
        "wss://nostr-pub.wellorder.net/*",
        "wss://relay.getalby.com/*",
        "wss://relay.primal.net/*",
      ]),
    );
  });

  it("injects the transport before the real component in X's MAIN world", async function () {
    let runtimeListener;
    const executeScript = vi.fn(async function () {
      return [];
    });
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          },
        },
      },
      scripting: { executeScript: executeScript },
    };

    await import("../background.js");

    const response = await new Promise(function (resolve) {
      const staysOpen = runtimeListener(
        {
          type: "INJECT_NOSTR_LIKE_COMPONENT",
          channel: "a".repeat(64),
        },
        { tab: { id: 87 }, frameId: 0, url: "https://x.com/home" },
        resolve,
      );
      expect(staysOpen).toBe(true);
    });

    expect(response).toEqual({ ok: true, result: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript.mock.calls[0][0]).toMatchObject({
      target: { tabId: 87, frameIds: [0] },
      world: "MAIN",
      func: expect.any(Function),
      args: ["a".repeat(64)],
    });
    expect(executeScript.mock.calls[1][0]).toEqual({
      target: { tabId: 87, frameIds: [0] },
      world: "MAIN",
      files: ["lib/nostr-like-button.js"],
    });
  });

  it("rejects injection when the sender frame cannot be validated", async function () {
    let runtimeListener;
    const executeScript = vi.fn();
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          },
        },
      },
      scripting: { executeScript: executeScript },
    };

    await import("../background.js?missing-frame");

    const response = await new Promise(function (resolve) {
      runtimeListener(
        {
          type: "INJECT_NOSTR_LIKE_COMPONENT",
          channel: "a".repeat(64),
        },
        { tab: { id: 87 }, url: "https://x.com/home" },
        resolve,
      );
    });

    expect(response).toEqual({
      ok: false,
      error: "Like component injection requires a validated sender frame",
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("accepts only scoped queries and valid signed kind-17 publishes", async function () {
    const listeners = new Map();
    const responses = [];
    const pageWindow = {
      location: { origin: "https://x.com" },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
      postMessage(message, targetOrigin) {
        responses.push({ message: message, targetOrigin: targetOrigin });
      },
    };
    const pool = {
      querySync: vi.fn(async function (_relays, filter) {
        return filter.authors
          ? [
              {
                id: "f".repeat(64),
                pubkey: "a".repeat(64),
                created_at: 20,
                kind: 17,
                content: "+",
                tags: [],
                sig: "e".repeat(128),
              },
            ]
          : [];
      }),
      publish: vi.fn(function () {
        return [Promise.resolve("saved")];
      }),
      destroy: vi.fn(),
    };
    const originalGetKnownPubkey = extension.storage.getKnownPubkey;
    const originalSetKnownPubkey = extension.storage.setKnownPubkey;
    extension.storage.getKnownPubkey = vi.fn(async function () {
      return "a".repeat(64);
    });
    extension.storage.setKnownPubkey = vi.fn(async function () {});
    const channel = "b".repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow,
    });
    const onMessage = listeners.get("message");
    const relays = ["wss://relay.damus.io"];
    const filter = {
      kinds: [17],
      "#k": ["web"],
      "#i": ["https://x.com/alokdangre/status/42"],
      limit: 1000,
    };

    await onMessage({
      source: pageWindow,
      origin: "https://x.com",
      data: {
        source: "nostr-components-relay-main",
        channel: channel,
        requestId: "0".repeat(32),
        operation: "getKnownReaction",
        payload: { relays: relays, url: filter["#i"][0] },
      },
    });

    await onMessage({
      source: pageWindow,
      origin: "https://x.com",
      data: {
        source: "nostr-components-relay-main",
        channel: channel,
        requestId: "1".repeat(32),
        operation: "query",
        payload: { relays: relays, filter: filter },
      },
    });

    const signedEvent = finalizeEvent(
      {
        kind: 17,
        content: "+",
        tags: [
          ["k", "web"],
          ["i", "https://x.com/alokdangre/status/42"],
        ],
        created_at: 1234567890,
      },
      new Uint8Array(32).fill(7),
    );
    await onMessage({
      source: pageWindow,
      origin: "https://x.com",
      data: {
        source: "nostr-components-relay-main",
        channel: channel,
        requestId: "2".repeat(32),
        operation: "publish",
        payload: { relays: relays, event: signedEvent },
      },
    });

    const normalizedRelays = ["wss://relay.damus.io/"];
    expect(pool.querySync).toHaveBeenCalledWith(
      normalizedRelays,
      {
        kinds: [17],
        authors: ["a".repeat(64)],
        "#k": ["web"],
        "#i": [filter["#i"][0]],
        limit: 1,
      },
      { maxWait: 8000 },
    );
    expect(pool.querySync).toHaveBeenCalledWith(normalizedRelays, filter, {
      maxWait: 8000,
    });
    expect(pool.publish).toHaveBeenCalledWith(normalizedRelays, signedEvent);
    expect(responses.map((entry) => entry.message.ok)).toEqual([
      true,
      true,
      true,
    ]);
    expect(responses[0].message.result).toBe(true);
    expect(JSON.stringify(responses[0].message)).not.toContain("a".repeat(64));
    expect(extension.storage.setKnownPubkey).toHaveBeenCalledWith(
      signedEvent.pubkey,
    );
    expect(
      responses.every((entry) => entry.targetOrigin === "https://x.com"),
    ).toBe(true);
    expect(
      extension.relayClient.validateFilter({ ...filter, kinds: [1] }),
    ).toBeNull();
    expect(
      extension.relayClient.validateReactionEvent({
        ...signedEvent,
        content: "arbitrary relay proxy",
      }),
    ).toBeNull();
    session.dispose();
    extension.storage.getKnownPubkey = originalGetKnownPubkey;
    extension.storage.setKnownPubkey = originalSetKnownPubkey;
  });
});

describe("timeline component integration", function () {
  it("injects the compact library component for a repost with equal-row spacing", async function () {
    const observerOptions = [];
    const observerCallbacks = [];
    const scheduledCallbacks = [];

    class FakeElement {
      constructor(tagName = "div") {
        this.tagName = tagName.toLowerCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.parentElement = null;
        this.nextSibling = null;
        this.className = "";
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith("data-")) {
          const key = name
            .slice(5)
            .replace(/-([a-z])/g, function (_match, letter) {
              return letter.toUpperCase();
            });
          this.dataset[key] = String(value);
        }
      }

      getAttribute(name) {
        return this.attributes[name] ?? null;
      }

      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
      }

      addEventListener() {}

      querySelector(selector) {
        if (selector === "nostr-like-button") {
          return this.children.find(
            (child) => child.tagName === "nostr-like-button",
          );
        }
        return null;
      }
    }

    const actionBar = new FakeElement();
    const viewsContainer = new FakeElement();
    const likeContainer = new FakeElement();
    likeContainer.parentElement = actionBar;
    likeContainer.nextSibling = viewsContainer;
    const nativeLike = new FakeElement("button");
    nativeLike.parentElement = likeContainer;
    nativeLike.closest = function () {
      return actionBar;
    };
    actionBar.querySelector = function (selector) {
      if (selector.includes("data-testid")) {
        return nativeLike;
      }
      return null;
    };
    actionBar.insertBefore = function (slot, sibling) {
      this.inserted = { slot: slot, sibling: sibling };
    };

    const statusAnchor = {
      getAttribute() {
        return "/original-author/status/4242";
      },
    };
    const timeElement = {
      closest() {
        return statusAnchor;
      },
    };
    const article = {
      dataset: { reposted: "true" },
      querySelector(selector) {
        if (selector === 'a[href*="/status/"] time') {
          return timeElement;
        }
        if (selector.includes("data-testid")) {
          return nativeLike;
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };

    globalThis.document = {
      body: {},
      documentElement: {},
      createElement(tagName) {
        return new FakeElement(tagName);
      },
      querySelectorAll() {
        return [article];
      },
    };
    globalThis.MutationObserver = class {
      constructor(callback) {
        observerCallbacks.push(callback);
      }

      observe(_target, options) {
        observerOptions.push(options);
      }
    };
    globalThis.window = {
      location: { origin: "https://x.com" },
      getComputedStyle() {
        return { colorScheme: "dark" };
      },
      setTimeout(callback) {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      },
      requestAnimationFrame(callback) {
        callback();
      },
      addEventListener() {},
    };

    const originalDirectoryLookup = extension.directory.lookup;
    extension.directory.lookup = async function () {
      throw new Error("directory unavailable");
    };
    extension.componentLoader = { ready: Promise.resolve() };
    vi.spyOn(console, "warn").mockImplementation(function () {});

    try {
      await import("../content.js");
      await new Promise((resolve) => setTimeout(resolve, 0));

      // A busy X page can mutate faster than INJECT_DELAY_MS. Repeated
      // observer notifications must not postpone the already scheduled scan.
      for (let index = 0; index < 10; index += 1) {
        observerCallbacks[0]();
      }
      expect(scheduledCallbacks).toHaveLength(1);
      scheduledCallbacks.shift()();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const slot = actionBar.inserted.slot;
      const component = slot.querySelector("nostr-like-button");
      expect(actionBar.inserted.sibling).toBe(viewsContainer);
      expect(slot.dataset.statusId).toBe("4242");
      expect(slot.dataset.directoryStatus).toBe("invalid");
      expect(component.tagName).toBe("nostr-like-button");
      expect(component.getAttribute("url")).toBe(
        "https://x.com/original-author/status/4242",
      );
      expect(component.getAttribute("compact")).toBe("");
      expect(component.getAttribute("data-theme")).toBe("dark");
      expect(observerOptions).toEqual([
        { childList: true, subtree: true },
        { attributes: true, attributeFilter: ["class", "style"] },
        { attributes: true, attributeFilter: ["class", "style"] },
      ]);
    } finally {
      extension.directory.lookup = originalDirectoryLookup;
    }
  });
});
