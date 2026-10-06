// SPDX-License-Identifier: MIT

import { readdirSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createNdkRelayClient } from "./ingestion.js";
import {
  createRelayPool,
  fetchPublicHttps,
  PublicWebSocket,
} from "./public-network.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const thisFile = "nostr-atlas/public-network.test.js";
const ndkFile = "nostr-atlas/ingestion.js";
const socketFile = "nostr-atlas/public-network.js";

function javascriptFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      javascriptFiles(path, found);
    } else if (entry.endsWith(".js") || entry.endsWith(".mjs")) {
      found.push(path);
    }
  }
  return found;
}

function boundaryHits(source, rel) {
  const found = [];
  const withoutAbstractPool = source.replaceAll(
    "Abstract" + "SimplePool",
    "",
  );
  if (withoutAbstractPool.includes("SimplePool")) found.push("SimplePool");
  if (
    source.includes("nostr-tools/" + "relay") ||
    /new Relay\s*\(/.test(source)
  ) {
    found.push("Relay");
  }
  if (rel !== ndkFile) {
    if (source.includes("@nostr-dev-kit/" + "ndk")) found.push("ndk-import");
    if (source.includes("new " + "NDK")) found.push("new-ndk");
  }
  if (rel !== socketFile) {
    if (source.includes("new " + "WebSocket")) found.push("new-websocket");
    if (
      source.includes("from " + '"ws"') ||
      source.includes("from " + "'ws'")
    ) {
      found.push("ws");
    }
    if (source.includes("nostr-tools/" + "pool")) found.push("pool");
    if (source.includes("new " + "AbstractSimplePool")) found.push("abstract-pool");
    if (source.includes("new " + "AbstractRelay")) found.push("abstract-relay");
  }
  if (source.includes("use" + "WebSocketImplementation")) found.push("global-ws");
  return found;
}

async function expectNdkRefusal(url) {
  const connect = vi.spyOn(net.Socket.prototype, "connect");
  const client = createNdkRelayClient(url);
  try {
    expect(globalThis.WebSocket).toBe(PublicWebSocket);
    await client.connect(300);
    await new Promise((resolve) => setTimeout(resolve, 50));
    for (const [destination] of connect.mock.calls) {
      const address =
        typeof destination === "string"
          ? destination
          : destination?.host || destination?.hostname || "";
      expect(String(address)).not.toMatch(
        /^(127\.|10\.|192\.168\.|0\.0\.0\.0|::1|\[::1\])/,
      );
      if (typeof destination?.lookup === "function") {
        await new Promise((resolve, reject) => {
          destination.lookup(address, { all: true }, (error) => {
            try {
              expect(String(error?.message || error)).toMatch(/private-address/);
              resolve();
            } catch (failure) {
              reject(failure);
            }
          });
        });
      }
    }
  } finally {
    client.close();
    connect.mockRestore();
  }
}

describe("relay connection boundary", () => {
  it("imports NDK only from the relay client and pools only from the public socket", () => {
    const offenders = [];
    for (const path of javascriptFiles(backendRoot)) {
      const rel = relative(backendRoot, path);
      if (rel === thisFile) continue;
      const hits = boundaryHits(readFileSync(path, "utf8"), rel);
      if (hits.length) offenders.push(`${rel}: ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("refuses a private address through NDK", async () => {
    await expectNdkRefusal("wss://127.0.0.1/");
  });

  it("refuses a host that resolves to a private address through NDK", async () => {
    await expectNdkRefusal("wss://localhost/relay");
  });

  it.each(["wss://[::ffff:7f00:1]/", "wss://[fe81::1]/", "wss://[febf::1]/"])(
    "refuses %s through NDK",
    async (url) => {
      await expectNdkRefusal(url);
    },
  );

  it("refuses a private host through the ingest pool", async () => {
    const pool = createRelayPool();
    try {
      await expect(pool.ensureRelay("wss://localhost/")).rejects.toThrow(
        /private-address/,
      );
    } finally {
      pool.destroy();
    }
  });

  it("does not fetch when the caller already aborted", async () => {
    const signal = AbortSignal.abort(new Error("aborted"));
    await expect(
      fetchPublicHttps("https://example.com/.well-known/lnurlp/alice", {
        signal,
      }),
    ).rejects.toThrow(/aborted/);
  });
});
