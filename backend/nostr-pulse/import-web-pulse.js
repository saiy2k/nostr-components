#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNdkRelayClient,
  isValidSignedEvent,
  queryRelay as defaultQueryRelay,
} from "../nostr-atlas/ingestion.js";
import { normalizeRelayUrl } from "../nostr-atlas/relay-hints.js";
import {
  createFirestore,
  runMain,
  terminateFirestore,
} from "../nostr-atlas/runtime.js";
import { isHexPubkey } from "../nostr-atlas/utils.js";
import { ingestUrlEvent as defaultIngestUrlEvent } from "./ingest.js";

const here = dirname(fileURLToPath(import.meta.url));

export const SOURCE_PROJECT_ID = "sat-the-standard";
export const TARGET_PROJECT_ID = "nostr-components";
export const DATABASE_ID = "(default)";
export const REACTION_COLLECTION = "Nostr_reactions";
export const ZAP_COLLECTION = "Nostr_zaps";
export const ID_BATCH_SIZE = 100;
export const IMPORT_QUERY_TIMEOUT_MS = 8000;
export const RELAY_FAILURE_LIMIT = 2;
export const TRANSIENT_RETRIES = 3;
export const IMPORT_SOURCE = "web-pulse-import";

// Oct 6, 2026 census: the 5 relays committed in web-pulse's nostr.ts, then the
// 7 added in its uncommitted local edit. Five of the 12 no longer answer.
export const WEB_PULSE_RELAYS = Object.freeze([
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://purplepag.es",
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.wellorder.net",
  "wss://relay.nostr.info",
  "wss://cache1.primal.net",
  "wss://nostr.rocks",
  "wss://relay.nostr.pub",
  "wss://relay.bitcoiner.social",
]);

// Relays a 0.7.0 button put on the zap request. ditto copies those receipts.
export const LEGACY_070_RELAYS = Object.freeze([
  "wss://relay.damus.io",
  "wss://nostr.wine",
  "wss://relay.nostr.net",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://nostr-pub.wellorder.net",
  "wss://relay.getalby.com",
  "wss://relay.primal.net",
]);

const REPORT_NOTES = Object.freeze([
  "Totals are rebuilt from verified events, so they can be lower than web-pulse showed.",
  "web-pulse counted every kind 17 instead of each user's newest, took zap amounts from the unverified zap request, counted receipts with no description as 0 sats, and lowercased whole URLs.",
  "A receipt with more than one a tag is rejected as duplicate-a.",
  "A description-hash mismatch is stored and counted per provider. It does not reject the receipt.",
]);

function loadRelayRoles() {
  return JSON.parse(readFileSync(join(here, "../relay-roles.json"), "utf8"));
}

export function importRelaySet(roles = loadRelayRoles()) {
  const relays = [];
  const seen = new Set();
  const groups = [
    roles?.rendezvous,
    roles?.sweepExtra,
    roles?.indexers,
    roles?.profileArchives,
    WEB_PULSE_RELAYS,
    LEGACY_070_RELAYS,
  ];
  for (const group of groups) {
    for (const url of group || []) {
      const normalized = normalizeRelayUrl(url);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      relays.push(normalized);
    }
  }
  return relays;
}

export function parseArgs(argv) {
  const options = { write: false };
  for (const arg of argv) {
    if (arg === "--write") options.write = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function openImportClients(write, createClient = createFirestore) {
  const sourceDb = await createClient({
    firestoreProject: SOURCE_PROJECT_ID,
        firestoreDatabase: DATABASE_ID,
      });
  const targetDb = write
    ? await createClient({
        firestoreProject: TARGET_PROJECT_ID,
        firestoreDatabase: DATABASE_ID,
      })
    : null;
  return { sourceDb, targetDb };
}

export function createMemoryDb() {
  const docs = new Map();
  function docRef(path) {
    return {
      path,
      id: path.split("/").at(-1),
      collection(name) {
        return collectionRef(`${path}/${name}`);
      },
      async get() {
        const stored = docs.get(path);
        return {
          exists: stored !== undefined,
          data: () => (stored === undefined ? undefined : { ...stored }),
        };
      },
      async set(data, options) {
        const prev = docs.get(path) || {};
        docs.set(path, options?.merge ? { ...prev, ...data } : { ...data });
      },
    };
  }
  function collectionRef(path) {
    return {
      doc(id) {
        return docRef(`${path}/${id}`);
      },
    };
  }
  return {
    collection(name) {
      return collectionRef(name);
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, options) {
          ops.push({ ref, data, options });
        },
        async commit() {
          for (const op of ops) await op.ref.set(op.data, op.options);
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, options) => ref.set(data, options),
      });
    },
  };
}

function collectIds(refs) {
  const ids = [];
  const seen = new Set();
  let invalid = 0;
  for (const ref of refs || []) {
    const raw = String(ref?.id || "").trim();
    if (!isHexPubkey(raw)) {
      invalid += 1;
      continue;
    }
    const id = raw.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids, invalid };
}

export async function readSourceEventIds(sourceDb) {
  const reactions = collectIds(
    await sourceDb.collection(REACTION_COLLECTION).listDocuments(),
  );
  const zaps = collectIds(
    await sourceDb.collection(ZAP_COLLECTION).listDocuments(),
  );
  return { reactions, zaps };
}

export function relayShouldSkip(failures, relay) {
  return (failures.get(relay) || 0) >= RELAY_FAILURE_LIMIT;
}

export function recordRelayAttempt(failures, relay, result) {
  const events = result?.events || [];
  const reason = String(result?.reason || "");
  const unanswered =
    events.length === 0 &&
    (reason === "timeout" ||
      reason.startsWith("connection-error") ||
      reason.startsWith("closed:"));
  failures.set(relay, unanswered ? (failures.get(relay) || 0) + 1 : 0);
}

export async function fetchEventsById(ids, relays, queryRelay, options = {}) {
  const kind = options.kind;
  const batchSize = options.batchSize || ID_BATCH_SIZE;
  const timeoutMs = options.timeoutMs ?? IMPORT_QUERY_TIMEOUT_MS;
  const failures = options.failures || new Map();
  const unique = [];
  const seen = new Set();
  for (const id of ids || []) {
    const normalized = String(id || "").toLowerCase();
    if (!isHexPubkey(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  const found = new Map();
  const batches = Math.ceil(unique.length / batchSize) || 0;
  for (let index = 0; index < unique.length; index += batchSize) {
    let pending = unique
      .slice(index, index + batchSize)
      .filter((id) => !found.has(id));
    for (const relay of relays) {
      if (!pending.length) break;
      if (relayShouldSkip(failures, relay)) continue;
      let result;
      try {
        result = await queryRelay(
          relay,
          { ids: pending, kinds: [kind] },
          { timeoutMs, max: pending.length },
        );
      } catch (error) {
        result = {
          relay,
          events: [],
          reason: `connection-error:${error?.message || error}`,
        };
      }
      recordRelayAttempt(failures, relay, result);
      const still = new Set(pending);
      for (const event of result?.events || []) {
        const id = String(event?.id || "").toLowerCase();
        if (!still.has(id) || found.has(id)) continue;
        if (event?.kind !== kind) continue;
        if (!isValidSignedEvent(event)) continue;
        found.set(id, { event, relay });
        still.delete(id);
      }
      pending = [...still];
    }
    options.onProgress?.({
      kind,
      batch: Math.floor(index / batchSize) + 1,
      batches,
      found: found.size,
      total: unique.length,
    });
  }
  return found;
}

function emptyKindCounts(read) {
  return {
    ids: read.ids.length,
    invalidIds: read.invalid,
    found: 0,
    missing: 0,
  };
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

export function recordIngestResult(report, result, event) {
  if (result?.ok && result.stored) report.stored += 1;
  else if (result?.ok) report.unchanged += 1;
  else bump(report.rejected, result?.reason || "unknown");
  if (result?.descriptionHashMismatch === true) {
    report.descriptionHashMismatch.total += 1;
    const provider = String(event?.pubkey || "").trim().toLowerCase();
    bump(
      report.descriptionHashMismatch.byProvider,
      isHexPubkey(provider) ? provider : "unknown",
    );
  }
}

async function ingestFound(db, hit, args) {
  const ingest = args.ingestUrlEvent || defaultIngestUrlEvent;
  const attempts = args.transientRetries ?? TRANSIENT_RETRIES;
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await ingest(
      db,
      hit.event,
      { relay: hit.relay, source: IMPORT_SOURCE },
      {
        nowMs: args.nowMs,
        giveUpOnProvider: attempt === attempts,
        queryRelay: args.profileQueryRelay,
        fetchImpl: args.fetchImpl,
        profileTimeoutMs: args.profileTimeoutMs,
        health: args.health,
      },
    );
    if (!result?.retry) break;
  }
  return result;
}

export async function importWebPulse(args) {
  const write = args.write === true;
  if (write && !args.targetDb) {
    throw new Error(
      "Refusing to write without a nostr-components Firestore client.",
    );
  }
  const relays = args.relays || importRelaySet(args.roles);
  const source = await readSourceEventIds(args.sourceDb);
  args.onProgress?.({
    phase: "source",
    reactions: source.reactions.ids.length,
    reactionInvalid: source.reactions.invalid,
    zaps: source.zaps.ids.length,
    zapInvalid: source.zaps.invalid,
    relays: relays.length,
  });
  const failures = new Map();
  const fetchOptions = {
    timeoutMs: args.timeoutMs,
    failures,
    onProgress: args.onProgress,
  };
  const reactions = await fetchEventsById(
    source.reactions.ids,
    relays,
    args.queryRelay,
    { ...fetchOptions, kind: 17 },
  );
  const zaps = await fetchEventsById(source.zaps.ids, relays, args.queryRelay, {
    ...fetchOptions,
    kind: 9735,
  });
  const db = write ? args.targetDb : createMemoryDb();
  const report = {
    write,
    sourceProject: SOURCE_PROJECT_ID,
    targetProject: TARGET_PROJECT_ID,
    relays: relays.length,
    reactions: emptyKindCounts(source.reactions),
    zaps: emptyKindCounts(source.zaps),
    stored: 0,
    unchanged: 0,
    rejected: {},
    descriptionHashMismatch: { total: 0, byProvider: {} },
    missingSample: { reactions: [], zaps: [] },
    relaysSkipped: [],
    notes: [...REPORT_NOTES],
  };
  const health = args.health || new Map();
  await ingestCollection(
    source.reactions.ids,
    reactions,
    report.reactions,
    report.missingSample.reactions,
    db,
    { ...args, health },
    report,
  );
  await ingestCollection(
    source.zaps.ids,
    zaps,
    report.zaps,
    report.missingSample.zaps,
    db,
    { ...args, health },
    report,
  );
  report.rejected = sortedCounts(report.rejected);
  report.descriptionHashMismatch.byProvider = sortedCounts(
    report.descriptionHashMismatch.byProvider,
  );
  report.relaysSkipped = relays.filter((relay) =>
    relayShouldSkip(failures, relay),
  );
  return { report, db };
}

async function ingestCollection(ids, found, counts, sample, db, args, report) {
  for (const id of ids) {
    const hit = found.get(id);
    if (!hit) {
      counts.missing += 1;
      if (sample.length < 10) sample.push(id);
      continue;
    }
    counts.found += 1;
    const result = await ingestFound(db, hit, args);
    recordIngestResult(report, result, hit.event);
  }
}

function sortedCounts(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function createRelayQuery(clients, queryRelay = defaultQueryRelay) {
  return async (url, filter, options = {}) => {
    const timeoutMs = options.timeoutMs ?? IMPORT_QUERY_TIMEOUT_MS;
    let client = clients.get(url);
    if (!client) {
      client = createNdkRelayClient(url);
      try {
        await client.connect(timeoutMs);
      } catch (error) {
        try {
          client.close();
        } catch {}
        return {
          relay: url,
          events: [],
          reason: `connection-error:${error?.message || error}`,
        };
      }
      clients.set(url, client);
    }
    const result = await queryRelay(url, filter, {
      timeoutMs,
      max: options.max ?? filter?.ids?.length ?? ID_BATCH_SIZE,
      client,
    });
    if (result?.reason !== "eose" && result?.reason !== "max") {
      clients.delete(url);
      try {
        client.close();
      } catch {}
    }
    return result;
  };
}

function logImport(message, fields = {}) {
  console.error(
    JSON.stringify({
      severity: "INFO",
      message,
      module: "web-pulse-import",
      ...fields,
    }),
  );
}

async function main() {
  const { write } = parseArgs(process.argv.slice(2));
  const { sourceDb, targetDb } = await openImportClients(write);
  const clients = new Map();
  const queryRelay = createRelayQuery(clients);
  try {
    logImport(write ? "import_write" : "import_dry_run", {
      sourceProject: SOURCE_PROJECT_ID,
      targetProject: write ? TARGET_PROJECT_ID : null,
    });
    const { report } = await importWebPulse({
      write,
      sourceDb,
      targetDb,
      queryRelay,
      profileQueryRelay: queryRelay,
      onProgress(progress) {
        logImport("import_fetch", progress);
      },
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    for (const client of clients.values()) {
      try {
        client.close();
      } catch {}
    }
    await terminateFirestore(sourceDb);
    await terminateFirestore(targetDb);
  }
}

runMain(import.meta.url, main);
