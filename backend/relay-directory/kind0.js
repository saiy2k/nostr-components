// SPDX-License-Identifier: MIT

import {
  createNdkRelayClient,
  isValidSignedEvent,
  queryRelay,
} from "./ingestion.js";

const PROFILE_TIMEOUT_MS = 8000;

export function metadataFromKind0(event) {
  if (!event || !isValidSignedEvent(event)) return null;
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
      if (!wanted.has(event.pubkey) || !isValidSignedEvent(event)) continue;
      const current = byPubkey.get(event.pubkey);
      if (!current || event.created_at > current.created_at) {
        byPubkey.set(event.pubkey, event);
      }
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

export async function fetchKind0s(pubkeys, relays) {
  const found = new Map();
  const sawEose = new Set();
  let remaining = [...pubkeys];
  for (const url of relays) {
    if (!remaining.length) break;
    const client = createNdkRelayClient(url);
    try {
      await client.connect(PROFILE_TIMEOUT_MS);
    } catch {
      try {
        client.close();
      } catch {
        // A failed connect may already have closed the socket.
      }
      continue;
    }
    const chunks = chunkPubkeys(remaining, 40);
    console.log(
      `kind0 ${url}: querying ${remaining.length} in ${chunks.length} batches`,
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
      const stillMissing = [];
      results.forEach((result, index) => {
        const chunk = chunks[index];
        for (const pubkey of chunk) {
          const event = result?.byPubkey.get(pubkey);
          if (result?.settled) sawEose.add(pubkey);
          if (event) found.set(pubkey, event);
          else stillMissing.push(pubkey);
        }
      });
      remaining = stillMissing;
      console.log(
        `${url}: profiles ${found.size}, still missing ${remaining.length}`,
      );
    } finally {
      try {
        client.close();
      } catch {
        // Closing a dropped relay socket is best-effort.
      }
    }
  }
  return new Map(
    pubkeys.map((pubkey) => [
      pubkey,
      {
        event: found.get(pubkey) || null,
        transient: !found.get(pubkey) && !sawEose.has(pubkey),
      },
    ]),
  );
}
