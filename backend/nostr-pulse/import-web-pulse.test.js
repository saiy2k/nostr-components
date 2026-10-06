// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import roles from "../relay-roles.json";
import { normalizeRelayUrl } from "../nostr-atlas/relay-hints.js";
import { canonicalUrl, urlKey } from "./url-key.js";
import { URL_ACTIVITY_COLLECTION } from "./ingest.js";
import {
  ID_BATCH_SIZE,
  LEGACY_070_RELAYS,
  REACTION_COLLECTION,
  SOURCE_PROJECT_ID,
  TARGET_PROJECT_ID,
  WEB_PULSE_RELAYS,
  ZAP_COLLECTION,
  createMemoryDb,
  fetchEventsById,
  importRelaySet,
  importWebPulse,
  openImportClients,
  parseArgs,
  readSourceEventIds,
  recordRelayAttempt,
  relayShouldSkip,
} from "./import-web-pulse.js";

const PAGE = "https://x.com/alice/status/42";

function signedReaction(createdAt = 10, rawUrl = PAGE) {
  return finalizeEvent(
    {
      kind: 17,
      created_at: createdAt,
      content: "+",
      tags: [
        ["k", "web"],
        ["i", rawUrl],
      ],
    },
    generateSecretKey(),
  );
}

function sourceDb({ reactions = [], zaps = [] } = {}) {
  const calls = [];
  return {
    calls,
    collection(name) {
      calls.push(name);
      const ids =
        name === REACTION_COLLECTION
          ? reactions
          : name === ZAP_COLLECTION
            ? zaps
            : null;
      if (!ids) throw new Error(`unexpected collection ${name}`);
      return {
        async listDocuments() {
          return ids.map((id) => ({ id }));
        },
      };
    },
  };
}

describe("importRelaySet", () => {
  it("unions relay roles, the 12 web-pulse relays, and the eight 0.7.0 relays", () => {
    expect(WEB_PULSE_RELAYS).toEqual([
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
    expect(LEGACY_070_RELAYS).toEqual([
      "wss://relay.damus.io",
      "wss://nostr.wine",
      "wss://relay.nostr.net",
      "wss://relay.nostr.band",
      "wss://nos.lol",
      "wss://nostr-pub.wellorder.net",
      "wss://relay.getalby.com",
      "wss://relay.primal.net",
    ]);
    const expected = [];
    const seen = new Set();
    for (const url of [
      ...roles.rendezvous,
      ...roles.sweepExtra,
      ...roles.indexers,
      ...roles.profileArchives,
      ...WEB_PULSE_RELAYS,
      ...LEGACY_070_RELAYS,
    ]) {
      const normalized = normalizeRelayUrl(url);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      expected.push(normalized);
    }
    expect(importRelaySet(roles)).toEqual(expected);
    expect(expected).toHaveLength(27);
  });
});

describe("parseArgs and Firestore clients", () => {
  it("stays a dry run unless --write is passed", () => {
    expect(parseArgs([])).toEqual({ write: false });
    expect(parseArgs(["--write"])).toEqual({ write: true });
    expect(() => parseArgs(["--project", "sat-the-standard"])).toThrow(
      /Unknown argument/,
    );
  });

  it("reads sat-the-standard and opens nostr-components only for --write", async () => {
    const calls = [];
    const createClient = async (args) => {
      calls.push(args);
      return { project: args.firestoreProject };
    };
    const dry = await openImportClients(false, createClient);
    expect(calls).toEqual([
      {
        firestoreProject: SOURCE_PROJECT_ID,
        firestoreDatabase: "(default)",
      },
    ]);
    expect(dry.targetDb).toBeNull();
    expect(SOURCE_PROJECT_ID).toBe("sat-the-standard");

    calls.length = 0;
    const wet = await openImportClients(true, createClient);
    expect(calls.map((call) => call.firestoreProject)).toEqual([
      "sat-the-standard",
      "nostr-components",
    ]);
    expect(wet.targetDb.project).toBe(TARGET_PROJECT_ID);
  });
});

describe("readSourceEventIds", () => {
  it("reads only reaction and zap document ids", async () => {
    const event = signedReaction();
    const source = sourceDb({
      reactions: [event.id, "not-an-id", event.id.toUpperCase()],
      zaps: ["zz"],
    });
    const read = await readSourceEventIds(source);
    expect(source.calls).toEqual([REACTION_COLLECTION, ZAP_COLLECTION]);
    expect(read.reactions).toEqual({ ids: [event.id], invalid: 1 });
    expect(read.zaps).toEqual({ ids: [], invalid: 1 });
  });
});

describe("fetchEventsById", () => {
  it("asks for 100 ids at a time and keeps a signed event from a later relay", async () => {
    const first = signedReaction(1, "https://x.com/alice/status/1");
    const second = signedReaction(2, "https://x.com/alice/status/2");
    const ids = Array.from({ length: ID_BATCH_SIZE + 1 }, () => signedReaction().id);
    ids[0] = first.id;
    ids[ID_BATCH_SIZE] = second.id;
    const calls = [];
    const found = await fetchEventsById(
      ids,
      ["wss://dead.example/", "wss://relay.ditto.pub/"],
      async (relay, filter) => {
        calls.push({ relay, ids: filter.ids.length, kinds: filter.kinds });
        if (relay.startsWith("wss://dead")) {
          return { events: [], reason: "timeout" };
        }
        const batch = new Set(filter.ids);
        const events = [first, second].filter((event) => batch.has(event.id));
        return { events, reason: "eose" };
      },
      { kind: 17 },
    );
    expect(calls.map((call) => call.ids)).toEqual([
      ID_BATCH_SIZE,
      ID_BATCH_SIZE,
      1,
      1,
    ]);
    expect(calls.every((call) => call.kinds[0] === 17)).toBe(true);
    expect(found.get(first.id).relay).toBe("wss://relay.ditto.pub/");
    expect(found.has(second.id)).toBe(true);
    expect(found.size).toBe(2);
  });

  it("ignores a bad signature and skips a relay after two unanswered attempts", async () => {
    const good = signedReaction();
    const decoy = signedReaction();
    const bad = {
      id: decoy.id,
      pubkey: decoy.pubkey,
      created_at: decoy.created_at,
      kind: decoy.kind,
      tags: decoy.tags,
      content: decoy.content,
      sig: "0".repeat(128),
    };
    const calls = [];
    const failures = new Map();
    const found = await fetchEventsById(
      [bad.id, good.id, "f".repeat(64)],
      ["wss://flaky.example/", "wss://relay.ditto.pub/"],
      async (relay, filter) => {
        calls.push(relay);
        if (relay.startsWith("wss://flaky")) {
          return { events: [], reason: "timeout" };
        }
        if (filter.ids.includes(bad.id)) return { events: [bad], reason: "eose" };
        const events = filter.ids.includes(good.id) ? [good] : [];
        return { events, reason: "eose" };
      },
      { failures, batchSize: 1, kind: 17 },
    );
    expect(found.has(bad.id)).toBe(false);
    expect(found.get(good.id).event.id).toBe(good.id);
    expect(calls.filter((relay) => relay.startsWith("wss://flaky"))).toHaveLength(
      2,
    );
    expect(relayShouldSkip(failures, "wss://flaky.example/")).toBe(true);
    recordRelayAttempt(failures, "wss://relay.ditto.pub/", {
      events: [],
      reason: "eose",
    });
    expect(failures.get("wss://relay.ditto.pub/")).toBe(0);
  });
});

describe("importWebPulse", () => {
  it("dry-runs through ingest in memory and does not touch the write client", async () => {
    const event = signedReaction();
    const targetDb = {
      collection() {
        throw new Error("dry run wrote to nostr-components");
      },
    };
    const { report, db } = await importWebPulse({
      write: false,
      targetDb,
      sourceDb: sourceDb({ reactions: [event.id, "nope"], zaps: ["a".repeat(64)] }),
      relays: ["wss://relay.ditto.pub/"],
      queryRelay: async (_relay, filter) => ({
        events: filter.kinds[0] === 17 ? [event] : [],
        reason: "eose",
      }),
    });
    expect(report.write).toBe(false);
    expect(report.sourceProject).toBe("sat-the-standard");
    expect(report.targetProject).toBe("nostr-components");
    expect(report.reactions).toMatchObject({
      ids: 1,
      invalidIds: 1,
      found: 1,
      missing: 0,
    });
    expect(report.zaps).toMatchObject({ ids: 1, found: 0, missing: 1 });
    expect(report.stored).toBe(1);
    expect(report.notes.some((note) => note.includes("duplicate-a"))).toBe(true);
    const key = urlKey(canonicalUrl(PAGE));
    const stored = await db.collection(URL_ACTIVITY_COLLECTION).doc(key).get();
    expect(stored.exists).toBe(true);
    expect(stored.data().likeCount).toBe(1);
  });

  it("counts rejections and description-hash mismatches, and writes only when asked", async () => {
    const reaction = signedReaction();
    const providerKey = generateSecretKey();
    const provider = getPublicKey(providerKey);
    const zapEvent = finalizeEvent(
      {
        kind: 9735,
        created_at: 20,
        content: "",
        tags: [],
      },
      providerKey,
    );
    const giveUps = [];
    let attempts = 0;
    const targetDb = createMemoryDb();
    let seenDb = null;
    const { report, db } = await importWebPulse({
      write: true,
      targetDb,
      sourceDb: sourceDb({ reactions: [reaction.id], zaps: [zapEvent.id] }),
      relays: ["wss://yabu.me/"],
      transientRetries: 3,
      queryRelay: async (_relay, filter) => {
        if (filter.kinds[0] === 17) return { events: [reaction], reason: "eose" };
        return { events: [zapEvent], reason: "eose" };
      },
      ingestUrlEvent: async (dbArg, event, meta, options) => {
        seenDb = dbArg;
        expect(meta).toEqual({
          source: "web-pulse-import",
          relay: "wss://yabu.me/",
        });
        if (event.kind === 17) {
          return { ok: false, stored: false, reason: "duplicate-a", retry: false };
        }
        attempts += 1;
        giveUps.push(options.giveUpOnProvider);
        if (attempts < 3) {
          return { ok: false, reason: "provider-unavailable", retry: true };
        }
        return {
          ok: true,
          stored: true,
          descriptionHashMismatch: true,
        };
      },
    });
    expect(db).toBe(targetDb);
    expect(seenDb).toBe(targetDb);
    expect(giveUps).toEqual([false, false, true]);
    expect(report.stored).toBe(1);
    expect(report.rejected).toEqual({ "duplicate-a": 1 });
    expect(report.descriptionHashMismatch).toEqual({
      total: 1,
      byProvider: { [provider]: 1 },
    });
    expect(report.zaps.found).toBe(1);
  });

  it("refuses to write without a target client", async () => {
    await expect(
      importWebPulse({
        write: true,
        sourceDb: sourceDb(),
        queryRelay: vi.fn(),
      }),
    ).rejects.toThrow(/nostr-components/);
  });
});
