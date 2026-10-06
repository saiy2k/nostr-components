// SPDX-License-Identifier: MIT

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { queryRelay } from "./ingestion.js";
import { createRelayClient, fetchPublicHttps } from "./public-network.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const allowedRelayFile = "nostr-atlas/public-network.js";

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

describe("relay connection boundary", () => {
  it("opens relay sockets only in public-network.js", () => {
    const needles = [
      "@nostr-dev-kit/" + "ndk",
      "new " + "WebSocket",
      "new " + "NDK",
      "new " + "SimplePool",
      "new " + "AbstractSimplePool",
      "new " + "AbstractRelay",
      "use" + "WebSocketImplementation",
      "from " + '"ws"',
      "from " + "'ws'",
      "nostr-tools/" + "relay",
      "nostr-tools/" + "pool",
    ];
    const offenders = [];
    for (const path of javascriptFiles(backendRoot)) {
      const rel = relative(backendRoot, path);
      if (rel === allowedRelayFile) continue;
      const source = readFileSync(path, "utf8");
      const hits = needles.filter((needle) => source.includes(needle));
      if (hits.length) offenders.push(`${rel}: ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("refuses a relay whose host is a private address", async () => {
    const client = createRelayClient("wss://127.0.0.1/");
    try {
      await client.connect(1000);
      expect.fail("expected a private-address refusal");
    } catch (error) {
      expect(String(error?.message || error)).toMatch(/private-address/);
    } finally {
      client.close();
    }
  });

  it("refuses a relay host that resolves to a private address", async () => {
    const client = createRelayClient("wss://localhost/relay");
    try {
      await client.connect(1000);
      expect.fail("expected a private-address refusal");
    } catch (error) {
      expect(String(error?.message || error)).toMatch(/private-address/);
    } finally {
      client.close();
    }
  });

  it.each(["wss://[::ffff:7f00:1]/", "wss://[fe81::1]/", "wss://[febf::1]/"])(
    "refuses %s before connecting",
    async (url) => {
      const client = createRelayClient(url);
      try {
        await client.connect(1000);
        expect.fail("expected a private-address refusal");
      } catch (error) {
        expect(String(error?.message || error)).toMatch(/private-address/);
      } finally {
        client.close();
      }
    },
  );

  it("does not fetch when the caller already aborted", async () => {
    const signal = AbortSignal.abort(new Error("aborted"));
    await expect(
      fetchPublicHttps("https://example.com/.well-known/lnurlp/alice", {
        signal,
      }),
    ).rejects.toThrow(/aborted/);
  });

  it("uses that client for relay queries by default", async () => {
    const result = await queryRelay(
      "wss://127.0.0.1/",
      { kinds: [0] },
      { timeoutMs: 1000, max: 1 },
    );
    expect(result.reason).toMatch(/private-address/);
  });
});
