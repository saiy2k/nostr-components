// SPDX-License-Identifier: MIT

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nip19 } from "nostr-tools";

const PROOF_URL =
  /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?:@)?([a-z0-9_]{1,15})\/status\/(\d{10,25})(?:\/(?:photo|video)\/\d{1,5})?\/?$/i;
const RESERVED_X_HANDLES = new Set([
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "search",
  "share",
  "settings",
]);

const here = dirname(fileURLToPath(import.meta.url));

export function parseProofTweetUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return null;
  }
  const match = `${url.origin}${url.pathname}`.match(PROOF_URL);
  if (!match) return null;
  const handle = match[1].toLowerCase();
  if (RESERVED_X_HANDLES.has(handle)) return { reserved: true, handle };
  return { handle, tweetId: match[2] };
}

export function loadClaimRelayUrls(env = process.env) {
  if (env.CLAIM_RELAYS !== undefined && String(env.CLAIM_RELAYS).trim()) {
    return String(env.CLAIM_RELAYS)
      .split(",")
      .map((relay) => relay.trim())
      .filter(Boolean);
  }
  const bundled = join(here, "relays.json");
  const repoCopy = join(here, "../backend/relays.json");
  const file = existsSync(bundled) ? bundled : repoCopy;
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data))
    throw new Error("relays.json must be a JSON array.");
  return data
    .map((entry) =>
      typeof entry === "string" ? entry : String(entry?.url || ""),
    )
    .filter(Boolean);
}

function proofFailure(error, status = 400) {
  return { status, body: { ok: false, error } };
}

export async function checkClaimProof(parameters = {}, options = {}) {
  const parsed = parseProofTweetUrl(parameters.url);
  if (!parsed) return proofFailure("invalid-proof-url");
  if (parsed.reserved) return proofFailure("reserved-handle");

  let decoded;
  try {
    decoded = nip19.decode(String(parameters.npub || "").trim());
  } catch {
    return proofFailure("invalid-npub");
  }
  if (decoded.type !== "npub") return proofFailure("invalid-npub");
  const npub = nip19.npubEncode(decoded.data).toLowerCase();

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  let response;
  try {
    response = await fetchImpl(
      `https://api.fxtwitter.com/${encodeURIComponent(parsed.handle)}/status/${encodeURIComponent(parsed.tweetId)}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
  } catch {
    return proofFailure("proof-tweet-unavailable", 503);
  }
  if (!response.ok) return proofFailure("proof-tweet-unavailable", 503);
  const json = await response.json();
  if (Number(json?.code) !== 200) {
    return proofFailure("proof-tweet-unavailable", 503);
  }
  const text = json?.tweet?.text || json?.tweet?.raw_text?.text || "";
  const author = String(json?.tweet?.author?.screen_name || "").toLowerCase();
  if (!text || !author) return proofFailure("proof-tweet-unavailable", 503);
  if (author !== parsed.handle) return proofFailure("proof-author-mismatch");
  if (!text.toLowerCase().includes(npub)) {
    return proofFailure("npub-not-in-proof-tweet");
  }

  const crawlerRelays = options.relays || loadClaimRelayUrls(options.env);
  return { status: 200, body: { ok: true, crawlerRelays } };
}

export function createClaimProofHandler(options = {}) {
  return async function handleClaimProof(request, response) {
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }
    try {
      const result = await checkClaimProof(request.query, options);
      response.set("Cache-Control", "no-store");
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error("Claim proof check failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      response
        .status(503)
        .json({ ok: false, error: "proof-tweet-unavailable" });
    }
  };
}
