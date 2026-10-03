// SPDX-License-Identifier: MIT

import {
  createNdkRelayClient,
  isValidSignedEvent,
  queryRelay,
} from "./ingestion.js";

const PROFILE_TIMEOUT_MS = 8000;
const RELAY_CONCURRENCY = 8;

const KIND0_RELAYS_FIRST = [
  "wss://purplepag.es",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
];

export const PROJECTION_KIND0_RELAY_LIMIT = 50;

export function relaysForKind0Lookup(
  relays,
  maxRelays = Number.POSITIVE_INFINITY,
) {
  const urls = (Array.isArray(relays) ? relays : []).filter(
    (url) => typeof url === "string" && url,
  );
  const present = new Set(urls);
  const preferred = KIND0_RELAYS_FIRST.filter((url) => present.has(url));
  const preferredSet = new Set(preferred);
  const ordered = [
    ...preferred,
    ...urls.filter((url) => !preferredSet.has(url)),
  ];
  const limit = Number(maxRelays);
  if (!Number.isFinite(limit) || limit < 0 || ordered.length <= limit) {
    return ordered;
  }
  return ordered.slice(0, limit);
}

export function preferNewerKind0(current, event) {
  if (!event || event.kind !== 0) return current || null;
  if (!current || current.kind !== 0) return event;
  return Number(event.created_at) > Number(current.created_at) ? event : current;
}

function isKind0Event(event) {
  return Boolean(event && event.kind === 0 && isValidSignedEvent(event));
}

export function metadataFromKind0(event) {
  if (!isKind0Event(event)) return null;
  try {
    const content = JSON.parse(event.content);
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      return {};
    }
    return content;
  } catch {
    return {};
  }
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function queryKind0Chunk(client, url, pubkeys) {
  const wanted = new Set(pubkeys);
  try {
    const result = await queryRelay(
      url,
      { kinds: [0], authors: pubkeys },
      { timeoutMs: PROFILE_TIMEOUT_MS, max: pubkeys.length * 3, client },
    );
    const byPubkey = new Map();
    for (const event of result.events || []) {
      if (!wanted.has(event.pubkey) || !isKind0Event(event)) continue;
      const current = byPubkey.get(event.pubkey);
      const chosen = preferNewerKind0(current, event);
      if (chosen && chosen !== current) byPubkey.set(event.pubkey, chosen);
    }
    return { settled: result.reason === "eose", byPubkey };
  } catch {
    return { settled: false, byPubkey: new Map() };
  }
}

function chunkPubkeys(pubkeys, size) {
  const chunks = [];
  for (let index = 0; index < pubkeys.length; index += size) {
    chunks.push(pubkeys.slice(index, index + size));
  }
  return chunks;
}

async function queryRelayProfiles(url, pubkeys) {
  const client = createNdkRelayClient(url);
  try {
    await client.connect(PROFILE_TIMEOUT_MS);
  } catch {
    try {
      client.close();
    } catch {
      // A failed connect may already have closed the socket.
    }
    return { byPubkey: new Map(), settled: new Set() };
  }
  const chunks = chunkPubkeys(pubkeys, 40);
  console.log(
    `kind0 ${url}: querying ${pubkeys.length} in ${chunks.length} batches`,
  );
  try {
    let finished = 0;
    const results = await mapPool(chunks, 8, async (chunk) => {
      const result = await queryKind0Chunk(client, url, chunk);
      finished += 1;
      if (finished % 20 === 0 || finished === chunks.length) {
        console.log(`kind0 ${url}: batches ${finished}/${chunks.length}`);
      }
      return result;
    });
    const byPubkey = new Map();
    const settled = new Set();
    results.forEach((result, index) => {
      const chunk = chunks[index];
      for (const pubkey of chunk) {
        if (result?.settled) settled.add(pubkey);
        const event = result?.byPubkey.get(pubkey);
        if (!event) continue;
        const chosen = preferNewerKind0(byPubkey.get(pubkey), event);
        if (chosen) byPubkey.set(pubkey, chosen);
      }
    });
    return { byPubkey, settled };
  } finally {
    try {
      client.close();
    } catch {
      // Closing a dropped relay socket is best-effort.
    }
  }
}

function rememberProfiles(found, sawEose, pubkeys, result, replaceNewer) {
  const stillMissing = [];
  for (const pubkey of pubkeys) {
    if (result.settled.has(pubkey)) sawEose.add(pubkey);
    const event = result.byPubkey.get(pubkey);
    if (!event) {
      stillMissing.push(pubkey);
      continue;
    }
    if (replaceNewer) {
      const chosen = preferNewerKind0(found.get(pubkey), event);
      if (chosen) found.set(pubkey, chosen);
    } else if (!found.has(pubkey)) {
      found.set(pubkey, event);
    }
  }
  return stillMissing;
}

export async function fetchKind0s(pubkeys, relays, options = {}) {
  const found = new Map();
  const sawEose = new Set();
  const relayList = Array.isArray(relays) ? relays : [];
  const targets = [...pubkeys];
  const profiles = () =>
    new Map(
      pubkeys.map((pubkey) => [
        pubkey,
        {
          event: found.get(pubkey) || null,
          transient: !found.get(pubkey) && !sawEose.has(pubkey),
        },
      ]),
    );
  if (!targets.length || !relayList.length) return profiles();

  if (options.newest === true) {
    await mapPool(relayList, RELAY_CONCURRENCY, async (url) => {
      const result = await queryRelayProfiles(url, targets);
      rememberProfiles(found, sawEose, targets, result, true);
      const missing = targets.filter((pubkey) => !found.has(pubkey)).length;
      console.log(`${url}: profiles ${found.size}, still missing ${missing}`);
    });
    return profiles();
  }

  let remaining = targets;
  for (const url of relayList) {
    if (!remaining.length) break;
    const result = await queryRelayProfiles(url, remaining);
    remaining = rememberProfiles(found, sawEose, remaining, result, false);
    console.log(
      `${url}: profiles ${found.size}, still missing ${remaining.length}`,
    );
  }
  return profiles();
}
