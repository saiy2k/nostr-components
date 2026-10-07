// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  DIRECTORY_REFRESH_MS,
  FUTURE_SKEW_SECONDS,
  OTHER_REFRESH_MS,
  PROFILE_COLLECTION,
  RELAY_HEALTH_COLLECTION,
  UNSETTLED_RETRY_MS,
  applyProfileToHandle,
  fetchReplaceableGrouped,
  listingMetadataFromKind0,
  preferNewerReplaceable,
  profileIsDue,
  refreshIntervalMs,
  refreshProfiles,
  relayHealthId,
  relayListFromEvent,
  runDueProfilePass,
  selectKind0Relays,
  zapRecordFromCheck,
} from "./profile-store.js";
import { normalizeRelayHints, normalizeRelayUrl } from "./relay-hints.js";

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const NOW_MS = Date.parse("2026-10-06T00:00:00.000Z");
const NOW_SEC = Math.floor(NOW_MS / 1000);

function kind0(content, createdAt = 1_700_000_000, idSecret = secret) {
  return finalizeEvent(
    {
      kind: 0,
      created_at: createdAt,
      tags: [],
      content: JSON.stringify(content),
    },
    idSecret,
  );
}

function relayList(tags, createdAt = 1_700_000_000) {
  return finalizeEvent(
    {
      kind: 10002,
      created_at: createdAt,
      tags,
      content: "",
    },
    secret,
  );
}

function memoryDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const db = {
    docs,
    collection(name) {
      const query = {
        after: "",
        limitN: 100,
        orderBy() {
          return query;
        },
        startAfter(id) {
          query.after = id;
          return query;
        },
        limit(n) {
          query.limitN = n;
          return query;
        },
        async get() {
          const rows = [...docs.entries()]
            .filter(([key]) => key.startsWith(`${name}/`))
            .map(([key, data]) => ({
              id: key.slice(name.length + 1),
              data,
            }))
            .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
          const start = query.after
            ? rows.findIndex((row) => row.id === query.after) + 1
            : 0;
          return {
            docs: rows.slice(start, start + query.limitN).map((row) => ({
              id: row.id,
              data: () => row.data,
            })),
          };
        },
        doc(id) {
          const key = `${name}/${id}`;
          return {
            collection: name,
            id,
            get: async () => ({
              exists: docs.has(key),
              data: () => (docs.has(key) ? docs.get(key) : null),
            }),
          };
        },
      };
      return query;
    },
    batch() {
      const sets = [];
      return {
        set(ref, data) {
          sets.push([`${ref.collection}/${ref.id}`, data]);
        },
        async commit() {
          for (const [key, data] of sets) {
            docs.set(key, { ...(docs.get(key) || {}), ...data });
          }
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set(ref, data) {
          const key = `${ref.collection}/${ref.id}`;
          docs.set(key, { ...(docs.get(key) || {}), ...data });
        },
      };
      return fn(tx);
    },
  };
  return db;
}

describe("relay hints and health ids", () => {
  it("keeps five wss hints and ignores other schemes", () => {
    expect(
      normalizeRelayHints([
        "wss://Relay.Example/path/",
        "ws://relay.example",
        "https://relay.example",
        "wss://relay.example/path",
        "wss://a.example",
        "wss://b.example",
        "wss://c.example",
        "wss://d.example",
        "wss://e.example",
      ]),
    ).toEqual([
      "wss://relay.example/path",
      "wss://a.example/",
      "wss://b.example/",
      "wss://c.example/",
      "wss://d.example/",
    ]);
    expect(normalizeRelayUrl("wss://user:pass@relay.example")).toBeNull();
  });

  it("hashes the normalized relay URL for the health document id", () => {
    const url = normalizeRelayUrl("wss://Relay.Example");
    expect(relayHealthId("wss://Relay.Example")).toBe(
      createHash("sha256").update(url).digest("hex"),
    );
    expect(relayHealthId("https://relay.example")).toBeNull();
  });
});

describe("replaceable events", () => {
  it("keeps the lower id when created_at ties and skips a far-future copy", () => {
    const older = kind0({ name: "Old" }, 100);
    const newer = kind0({ name: "New" }, 200);
    const sameTimeHigher = { ...newer, id: "f".repeat(64), created_at: 200 };
    const sameTimeLower = { ...older, id: "0".repeat(64), created_at: 200 };
    expect(preferNewerReplaceable(older, newer, NOW_SEC)).toBe(newer);
    expect(preferNewerReplaceable(sameTimeHigher, sameTimeLower, NOW_SEC)).toBe(
      sameTimeLower,
    );
    expect(preferNewerReplaceable(sameTimeLower, sameTimeHigher, NOW_SEC)).toBe(
      sameTimeLower,
    );
    const future = kind0({ name: "Future" }, NOW_SEC + FUTURE_SKEW_SECONDS + 5);
    expect(preferNewerReplaceable(older, future, NOW_SEC)).toBe(older);
    expect(preferNewerReplaceable(null, future, NOW_SEC)).toBeNull();
  });

  it("does not treat a capped archive page as settled", async () => {
    const event = kind0({ name: "Partial" }, 100);
    const queryRelay = vi.fn(async () => ({
      events: [event],
      reason: "max",
    }));
    const result = await fetchReplaceableGrouped(
      new Map([["wss://archive.example/", [pubkey]]]),
      0,
      { queryRelay, nowSec: NOW_SEC },
    );
    expect(result.byPubkey.size).toBe(0);
    expect(result.settled.has(pubkey)).toBe(false);
  });

  it("does not start a queued relay query after the deadline", async () => {
    const calls = [];
    const deadlineMs = Date.now() + 80;
    const queryRelay = vi.fn(async (_url, _filter, opts) => {
      calls.push({ at: Date.now(), timeoutMs: opts.timeoutMs });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { events: [], reason: "timeout" };
    });
    const groups = new Map();
    for (let index = 0; index < 9; index += 1) {
      groups.set(`wss://relay-${index}.example/`, [pubkey]);
    }
    await fetchReplaceableGrouped(groups, 0, {
      queryRelay,
      timeoutMs: 3000,
      deadlineMs,
      nowSec: NOW_SEC,
    });
    expect(calls.length).toBe(8);
    for (const call of calls) {
      expect(call.at).toBeLessThanOrEqual(deadlineMs + 25);
      expect(call.timeoutMs).toBeLessThanOrEqual(deadlineMs - call.at + 25);
      expect(call.timeoutMs).toBeGreaterThan(0);
    }
  });

  it("keeps the newest signed copy when the relay reaches EOSE", async () => {
    const stale = kind0({ name: "Stale" }, 100);
    const fresh = kind0({ name: "Fresh" }, 300);
    const queryRelay = vi.fn(async () => ({
      events: [stale, fresh],
      reason: "eose",
    }));
    const result = await fetchReplaceableGrouped(
      new Map([["wss://archive.example/", [pubkey]]]),
      0,
      { queryRelay, nowSec: NOW_SEC },
    );
    expect(result.byPubkey.get(pubkey).id).toBe(fresh.id);
    expect(result.settled.has(pubkey)).toBe(true);
  });
});

describe("kind 0 relay choice", () => {
  it("reads NIP-65 markers and uses at most three healthy write relays", () => {
    const event = relayList([
      ["r", "wss://read.example", "read"],
      ["r", "wss://write-a.example", "write"],
      ["r", "wss://write-b.example", "write"],
      ["r", "wss://write-c.example", "write"],
      ["r", "wss://write-d.example", "write"],
      ["r", "wss://both.example"],
      ["r", "https://nope.example", "write"],
    ]);
    expect(relayListFromEvent(event)).toEqual({
      readRelays: ["wss://read.example/", "wss://both.example/"],
      writeRelays: [
        "wss://write-a.example/",
        "wss://write-b.example/",
        "wss://write-c.example/",
        "wss://write-d.example/",
        "wss://both.example/",
      ],
    });
    const health = new Map([
      ["wss://write-a.example/", { consecutiveFailures: 3 }],
    ]);
    const selected = selectKind0Relays({
      ...relayListFromEvent(event),
      hints: ["wss://hint.example"],
      archives: ["wss://archive.example"],
      health,
    });
    expect(selected.slice(0, 1)).toEqual(["wss://archive.example/"]);
    expect(selected.filter((url) => url.includes("write-"))).toEqual([
      "wss://write-b.example/",
      "wss://write-c.example/",
      "wss://write-d.example/",
    ]);
    expect(selected).not.toContain("wss://read.example/");
    expect(selected).toContain("wss://hint.example/");
  });

  it("uses read relays when the list marks every relay read", () => {
    expect(
      selectKind0Relays({
        readRelays: ["wss://r1.example", "wss://r2.example", "wss://r3.example", "wss://r4.example"],
        writeRelays: [],
        archives: [],
        hints: [],
      }),
    ).toEqual([
      "wss://r1.example/",
      "wss://r2.example/",
      "wss://r3.example/",
    ]);
  });
});

describe("profile documents", () => {
  it("refreshes directory profiles sooner than other roles", () => {
    expect(refreshIntervalMs(["directory"])).toBe(DIRECTORY_REFRESH_MS);
    expect(refreshIntervalMs(["url-actor"])).toBe(OTHER_REFRESH_MS);
    expect(refreshIntervalMs(["directory", "url-actor"])).toBe(DIRECTORY_REFRESH_MS);
  });

  it("keeps the previous zap result when the check is transient", () => {
    const previous = {
      lud16: "alice@example.com",
      zappable: true,
      transient: false,
      reason: "nip57-ready",
    };
    expect(
      zapRecordFromCheck(previous, {
        zappable: false,
        zapCheckTransient: true,
        zapReason: "lnurl-fetch-failed",
      }),
    ).toMatchObject({ zappable: true, transient: true, lud16: "alice@example.com" });
    expect(
      zapRecordFromCheck(null, {
        zappable: false,
        zapCheckTransient: true,
      }).zappable,
    ).toBeNull();
  });

  it("rebuilds listing metadata from the newest kind 0 and drops removed fields", () => {
    const handle = {
      activeIdentity: {
        claimId: "claim-1",
        status: "verified",
        pubkey,
        kind0CreatedAt: 100,
        metadata: {
          name: "Old",
          lud16: "old@example.com",
          picture: "https://cdn.example/old.png",
          xPicture: "https://pbs.twimg.com/profile_images/a.jpg",
        },
      },
      claims: [
        {
          claimId: "claim-1",
          pubkey,
          metadata: { name: "Old", lud16: "old@example.com" },
        },
      ],
    };
    const event = kind0({ name: "Alice" }, 200);
    const plan = applyProfileToHandle(handle, {
      pubkey,
      kind0Event: event,
      kind0CreatedAt: 200,
      kind0Content: { name: "Alice" },
    });
    expect(plan.changed).toBe(true);
    expect(plan.activeIdentity.metadata).toEqual({
      name: "Alice",
      xPicture: "https://pbs.twimg.com/profile_images/a.jpg",
    });
    expect(plan.activeIdentity.kind0CreatedAt).toBe(200);
    expect(plan.claims[0].metadata.lud16).toBeUndefined();
    expect(
      applyProfileToHandle(handle, {
        pubkey,
        kind0Event: kind0({ name: "Older" }, 50),
        kind0CreatedAt: 50,
        kind0Content: { name: "Older" },
      }).changed,
    ).toBe(false);
    expect(listingMetadataFromKind0(pubkey, { name: "A", picture: "https://cdn.example/a.png" }, "https://pbs.twimg.com/a.jpg")).toEqual({
      name: "A",
      picture: "https://cdn.example/a.png",
    });
  });

  it("is due when the profile is missing or its refresh time has passed", () => {
    expect(profileIsDue(null, NOW_MS)).toBe(true);
    expect(profileIsDue({ nextRefreshAt: "2026-10-05T00:00:00.000Z" }, NOW_MS)).toBe(true);
    expect(profileIsDue({ nextRefreshAt: "2026-10-07T00:00:00.000Z" }, NOW_MS)).toBe(false);
  });
});

describe("profile refresh", () => {
  it("stores the signed profile, a transient-safe zap record, and one health write", async () => {
    const profile = kind0(
      { name: "Alice", lud16: "alice@example.com", nip05: "alice@example.com" },
      1_700_000_100,
    );
    const list = relayList([["r", "wss://outbox.example", "write"]], 1_700_000_050);
    const queryRelay = vi.fn(async (_url, filter) => {
      if (filter.kinds[0] === 10002) return { events: [list], reason: "eose" };
      return { events: [profile], reason: "eose" };
    });
    const db = memoryDb({
      [`nostrDirectoryHandles/twitter:alice`]: {
        handle: "alice",
        activeIdentity: {
          claimId: "claim-1",
          status: "verified",
          pubkey,
          handle: "alice",
          metadata: { lud16: "old@example.com", name: "Old" },
        },
        claims: [
          {
            claimId: "claim-1",
            status: "verified",
            pubkey,
            metadata: { lud16: "old@example.com", name: "Old" },
          },
        ],
      },
    });
    const result = await refreshProfiles(
      db,
      [
        {
          pubkey,
          hints: ["wss://hint.example"],
          handleId: "twitter:alice",
          handle: "alice",
          role: "directory",
        },
      ],
      {
        nowMs: NOW_MS,
        queryRelay,
        handlesCollection: "nostrDirectoryHandles",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ allowsNostr: true, nostrPubkey: pubkey }),
        }),
        flushHealth: true,
      },
    );

    expect(result.refreshed).toBe(1);
    expect(result.handlesChanged).toBe(1);
    const stored = db.docs.get(`${PROFILE_COLLECTION}/${pubkey}`);
    expect(JSON.parse(stored.kind0Json).id).toBe(profile.id);
    expect(stored.display).toMatchObject({
      name: "Alice",
      nip05: "alice@example.com",
    });
    expect(stored.zap).toMatchObject({
      zappable: true,
      lud16: "alice@example.com",
      nostrPubkey: pubkey,
      transient: false,
    });
    expect(stored.tracked).toEqual(["directory"]);
    expect(stored.relayHints).toEqual(["wss://hint.example/"]);
    expect(stored.writeRelays).toContain("wss://outbox.example/");
    expect(Date.parse(stored.nextRefreshAt) - NOW_MS).toBe(DIRECTORY_REFRESH_MS);
    const handle = db.docs.get("nostrDirectoryHandles/twitter:alice");
    expect(handle.activeIdentity.metadata).toMatchObject({
      name: "Alice",
      lud16: "alice@example.com",
    });
    expect(handle.activeIdentity.metadata.name).toBe("Alice");
    expect(handle.activeIdentity.lud16).toBeUndefined();
    const health = [...db.docs.keys()].filter((key) =>
      key.startsWith(`${RELAY_HEALTH_COLLECTION}/`),
    );
    expect(health.length).toBeGreaterThan(0);
    expect(queryRelay.mock.calls.some((call) => call[2].max > 0)).toBe(true);
  });

  it("retries soon when the kind 0 query does not settle and keeps the previous zap result", async () => {
    const queryRelay = vi.fn(async () => ({ events: [], reason: "timeout" }));
    const db = memoryDb({
      [`${PROFILE_COLLECTION}/${pubkey}`]: {
        pubkey,
        zap: { zappable: true, lud16: "alice@example.com", transient: false },
        tracked: ["directory"],
      },
    });
    await refreshProfiles(
      db,
      [{ pubkey, role: "directory" }],
      { nowMs: NOW_MS, queryRelay, fetchImpl: async () => { throw new Error("down"); } },
    );
    const stored = db.docs.get(`${PROFILE_COLLECTION}/${pubkey}`);
    expect(Date.parse(stored.nextRefreshAt) - NOW_MS).toBe(UNSETTLED_RETRY_MS);
    expect(stored.zap).toMatchObject({ zappable: true, transient: true });
  });

  it("does not query relays after the refresh deadline", async () => {
    const queryRelay = vi.fn(async () => {
      throw new Error("should not query");
    });
    const fetchImpl = vi.fn(async () => {
      throw new Error("should not fetch");
    });
    const db = memoryDb();
    await refreshProfiles(db, [{ pubkey, role: "lookup" }], {
      nowMs: Date.now(),
      deadlineMs: Date.now() - 1,
      timeoutMs: 3000,
      queryRelay,
      fetchImpl,
    });
    expect(queryRelay).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    const stored = db.docs.get(`${PROFILE_COLLECTION}/${pubkey}`);
    expect(stored.kind0Json).toBeUndefined();
    expect(stored.missingUntil).toBeNull();
    expect(stored.zap).toMatchObject({ zappable: null, transient: true });
  });

  it("walks verified handles that have no profile before handles that are already fresh", async () => {
    const other = getPublicKey(generateSecretKey());
    const db = memoryDb({
      "nostrDirectoryHandles/twitter:alice": {
        handle: "alice",
        activeIdentity: {
          claimId: "a",
          status: "verified",
          pubkey,
          handle: "alice",
        },
        claims: [{ claimId: "a", pubkey, relayHints: ["wss://hint.example"] }],
      },
      "nostrDirectoryHandles/twitter:zoe": {
        handle: "zoe",
        activeIdentity: {
          claimId: "z",
          status: "verified",
          pubkey: other,
          handle: "zoe",
        },
      },
      [`${PROFILE_COLLECTION}/${other}`]: {
        nextRefreshAt: "2026-10-07T00:00:00.000Z",
        tracked: ["directory"],
      },
    });
    const queryRelay = vi.fn(async () => ({ events: [], reason: "eose" }));
    const result = await runDueProfilePass(
      db,
      {
        firestoreHandlesCollection: "nostrDirectoryHandles",
        firestoreProjectionRunsCollection: "relayProjectionRuns",
        profileRefreshLimit: 1,
        profileScanLimit: 10,
      },
      {
        nowMs: NOW_MS,
        queryRelay,
        fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
      },
    );
    expect(result.refreshed).toBe(1);
    expect(db.docs.has(`${PROFILE_COLLECTION}/${pubkey}`)).toBe(true);
    expect(db.docs.get("relayProjectionRuns/profile-refresh").afterId).toBe("");
  });
});

describe("shared profile routing vectors", () => {
  it("matches the vectors the component library uses", async () => {
    const vectors = (await import("./profile-routing-vectors.json")).default;
    expect(FUTURE_SKEW_SECONDS).toBe(vectors.futureSkewSeconds);
    for (const row of vectors.replaceable) {
      const winner = preferNewerReplaceable(row.current, row.event, vectors.nowSec);
      const expected =
        row.winner === "event" ? row.event : row.winner === "current" ? row.current : null;
      expect(winner, row.name).toEqual(expected);
    }
    const list = relayListFromEvent({ tags: vectors.relayList.tags });
    expect(list.readRelays).toEqual(vectors.relayList.readRelays);
    expect(list.writeRelays).toEqual(vectors.relayList.writeRelays);
    const health = new Map(
      vectors.kind0Selection.unhealthy.map((url) => [url, { consecutiveFailures: 3 }]),
    );
    const selected = selectKind0Relays({
      ...list,
      hints: vectors.kind0Selection.hints,
      archives: vectors.kind0Selection.archives,
      health,
    });
    expect(selected.filter((url) => url.includes("write-"))).toEqual(
      vectors.kind0Selection.writeRelays,
    );
    for (const url of vectors.kind0Selection.includes) {
      expect(selected).toContain(url);
    }
    for (const url of vectors.kind0Selection.excludes) {
      expect(selected).not.toContain(url);
    }
    expect(
      selectKind0Relays({
        readRelays: vectors.readFallback.readRelays,
        writeRelays: [],
        archives: [],
        hints: [],
      }),
    ).toEqual(vectors.readFallback.expected);
  });
});
