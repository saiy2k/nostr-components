// SPDX-License-Identifier: MIT

import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import WebSocket from "ws";
import { verifyEvent } from "nostr-tools";
import { AbstractRelay } from "nostr-tools/relay";
import { AbstractSimplePool } from "nostr-tools/pool";

const LNURL_MAX_BODY_BYTES = 64 * 1024;
export const LNURL_TIMEOUT_MS = 8000;

/** Longer than any relay query, so only a real EOSE or the caller's timer ends it. */
const RELAY_EOSE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function isPrivateAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export async function fetchPublicHttps(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    return { ok: false, status: 400, json: async () => ({}) };
  }
  const records = await lookup(parsed.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    return { ok: false, status: 403, json: async () => ({}) };
  }
  const chosen = records[0];
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      settle(value);
    };
    const req = https.request(
      {
        host: chosen.address,
        servername: parsed.hostname,
        family: chosen.family,
        method: "GET",
        path: `${parsed.pathname}${parsed.search}`,
        headers: { host: parsed.hostname, accept: "application/json" },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > LNURL_MAX_BODY_BYTES) {
            req.destroy(new Error("response-too-large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (settled) return;
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode || 0;
          finish(resolve, {
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(body),
          });
        });
      },
    );
    const abort = () => req.destroy(new Error("aborted"));
    options.signal?.addEventListener("abort", abort, { once: true });
    req.on("error", (error) => finish(reject, error));
    req.setTimeout(LNURL_TIMEOUT_MS, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function hostnameOf(url) {
  const hostname = url.hostname;
  return hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
}

function publicLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  lookup(hostname, { all: true })
    .then((records) => {
      if (
        !records.length ||
        records.some((record) => isPrivateAddress(record.address))
      ) {
        callback(new Error("private-address"));
        return;
      }
      const chosen = records[0];
      if (options.all) {
        callback(null, [chosen]);
        return;
      }
      callback(null, chosen.address, chosen.family);
    })
    .catch((error) => callback(error));
}

/**
 * WebSocket that resolves every address for the relay host, refuses the
 * connection when any of them is private, and connects to the address it checked.
 */
export class PublicWebSocket extends WebSocket {
  constructor(address, protocols) {
    const url = new URL(String(address));
    if (url.protocol !== "wss:" && url.protocol !== "ws:") {
      throw new Error("invalid-relay-url");
    }
    const hostname = hostnameOf(url);
    if (isIP(hostname) && isPrivateAddress(hostname)) {
      throw new Error("private-address");
    }
    super(address, protocols, { lookup: publicLookup });
  }
}

function openRelay(url) {
  const relay = new AbstractRelay(url, {
    verifyEvent,
    websocketImplementation: PublicWebSocket,
  });
  relay.baseEoseTimeout = RELAY_EOSE_TIMEOUT_MS;
  return relay;
}

export function createRelayClient(url) {
  const relay = openRelay(url);
  return {
    connect(timeoutMs) {
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        relay.connectionTimeout = timeoutMs;
      }
      return relay.connect();
    },
    subscribe(filter, { max, onEvent, onEose, onClosed } = {}) {
      const nextFilter = Number.isFinite(max) ? { ...filter, limit: max } : filter;
      const subscription = relay.subscribe([nextFilter], {
        eoseTimeout: RELAY_EOSE_TIMEOUT_MS,
        onevent(event) {
          onEvent?.(event);
        },
        oneose() {
          onEose?.();
        },
        onclose(reason) {
          onClosed?.(reason);
        },
      });
      return () => {
        subscription.close();
      };
    },
    close() {
      relay.close();
    },
  };
}

export function createRelayPool() {
  return new AbstractSimplePool({
    verifyEvent,
    websocketImplementation: PublicWebSocket,
  });
}
