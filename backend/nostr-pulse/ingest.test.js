// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { bech32 } from "@scure/base";
import { FieldValue } from "@google-cloud/firestore";
import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import vectors from "./reaction-vectors.json";
import { canonicalUrl, urlKey } from "./url-key.js";
import {
  URL_ACTIVITY_COLLECTION,
  URL_ZAPS_COLLECTION,
  applyReactionChange,
  backfillReactionPubkeys,
  domainFromCanonical,
  ingestUrlEvent,
  preferNewerReaction,
  providerIsFresh,
  reactionBucket,
} from "./ingest.js";
import { PROFILE_COLLECTION } from "../nostr-atlas/profile-store.js";

const NOW_MS = Date.parse("2026-10-06T12:00:00.000Z");
const BOLT11_AMOUNT_MSATS = 2_000_000;
const ALICE = generateSecretKey();
const BOB = generateSecretKey();
const ALICE_PK = getPublicKey(ALICE);
const BOB_PK = getPublicKey(BOB);
const RECIPIENT_SK = generateSecretKey();
const RECIPIENT_PK = getPublicKey(RECIPIENT_SK);
const PROVIDER_SK = generateSecretKey();
const PROVIDER_PK = getPublicKey(PROVIDER_SK);
const SENDER_SK = generateSecretKey();
const PAGE = "https://x.com/alice/status/42";
const A_TAG = `39735:${RECIPIENT_PK}:${PAGE}`;

function memoryDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  function docRef(path) {
    return {
      path,
      id: path.split("/").at(-1),
      collection(name) {
        return collectionRef(`${path}/${name}`);
      },
      async get() {
        return {
          exists: docs.has(path),
          data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
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
    docs,
    collection(name) {
      return collectionRef(name);
    },
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, options) => ref.set(data, options),
      };
      return fn(tx);
    },
  };
}

function reaction(secret, content, createdAt, rawUrl = PAGE, k = "web") {
  return finalizeEvent(
    {
      kind: 17,
      created_at: createdAt,
      content,
      tags: [
        ["k", k],
        ["i", rawUrl],
      ],
    },
    secret,
  );
}

function freshZap(overrides = {}) {
  return {
    lud16: "alice@ln.example",
    lnurlp: "https://ln.example/.well-known/lnurlp/alice",
    nostrPubkey: PROVIDER_PK,
    zappable: true,
    reason: "nip57-ready",
    transient: false,
    checkedAt: new Date(NOW_MS).toISOString(),
    ...overrides,
  };
}

function dbWithProvider(zap = freshZap()) {
  return memoryDb({
    [`${PROFILE_COLLECTION}/${RECIPIENT_PK}`]: { pubkey: RECIPIENT_PK, zap },
  });
}

function bolt11ForDescription(description) {
  const hash = createHash("sha256").update(description).digest();
  const words = [];
  const timestamp = 1_700_000_000;
  for (let index = 6; index >= 0; index -= 1) {
    words.push((timestamp >> (index * 5)) & 31);
  }
  for (const field of [
    { type: 1, data: Buffer.alloc(32, 1) },
    { type: 23, data: hash },
  ]) {
    const dataWords = bech32.toWords(field.data);
    const length = dataWords.length;
    words.push(field.type, (length >> 5) & 31, length & 31, ...dataWords);
  }
  words.push(...bech32.toWords(Buffer.alloc(65, 2)));
  return bech32.encode("lnbc20u", words, 2000);
}

function receipt({ extraRequestTags = [], anon = false, url = PAGE } = {}) {
  const aTag = `39735:${RECIPIENT_PK}:${url}`;
  const requestTags = [
    ["p", RECIPIENT_PK],
    ["amount", String(BOLT11_AMOUNT_MSATS)],
    ["relays", "wss://relay.example"],
    ["a", aTag],
    ...extraRequestTags,
  ];
  if (anon) requestTags.push(["anon"]);
  const zapRequest = finalizeEvent(
    {
      kind: 9734,
      created_at: 1_700_000_000,
      content: anon ? "" : "thanks",
      tags: requestTags,
    },
    SENDER_SK,
  );
  const description = JSON.stringify(zapRequest);
  return finalizeEvent(
    {
      kind: 9735,
      created_at: 1_700_000_100,
      content: "",
      tags: [
        ["p", RECIPIENT_PK],
        ["P", zapRequest.pubkey],
        ["bolt11", bolt11ForDescription(description)],
        ["description", description],
        ["a", aTag],
      ],
    },
    PROVIDER_SK,
  );
}

async function storedUrl(db, rawUrl = PAGE) {
  const key = urlKey(canonicalUrl(rawUrl));
  const snap = await db.collection(URL_ACTIVITY_COLLECTION).doc(key).get();
  return { key, data: snap.data() };
}

describe("reaction pubkey backfill", () => {
  it("copies the document id onto pubkey and resumes after the page", async () => {
    const first = "a".repeat(64);
    const second = "b".repeat(64);
    const alice = "1".repeat(64);
    const bob = "2".repeat(64);
    const db = reactionPageDb({
      [`nostrUrlActivity/${first}`]: { url: "https://example.com/a" },
      [`nostrUrlActivity/${first}/reactions/${alice}`]: { content: "+" },
      [`nostrUrlActivity/${first}/reactions/not-a-pubkey`]: { content: "+" },
      [`nostrUrlActivity/${second}`]: { url: "https://example.com/b" },
      [`nostrUrlActivity/${second}/reactions/${bob}`]: { content: "-", pubkey: bob },
    });

    const page = await backfillReactionPubkeys(db, { limit: 1 });
    expect(page).toMatchObject({ updated: 1, scanned: 1, done: false, afterId: first });
    expect(db.data.get(`nostrUrlActivity/${first}/reactions/${alice}`).pubkey).toBe(alice);
    expect(db.data.has(`nostrUrlActivity/${first}/reactions/not-a-pubkey`)).toBe(true);
    expect(db.data.get(`nostrUrlActivity/${first}/reactions/not-a-pubkey`).pubkey).toBeUndefined();

    const rest = await backfillReactionPubkeys(db, { afterId: page.afterId, limit: 1 });
    expect(rest).toMatchObject({ updated: 0, scanned: 1, done: false, afterId: second });
    expect(db.data.get(`nostrUrlActivity/${second}/reactions/${bob}`)).toMatchObject({
      pubkey: bob,
      content: "-",
    });
    const empty = await backfillReactionPubkeys(db, { afterId: rest.afterId, limit: 1 });
    expect(empty).toMatchObject({ updated: 0, scanned: 0, done: true, afterId: second });
  });
});

function reactionPageDb(initial) {
  const data = new Map(Object.entries(initial));
  function reactions(urlId) {
    return {
      async get() {
        const prefix = `nostrUrlActivity/${urlId}/reactions/`;
        const docs = [];
        for (const [path, value] of data) {
          if (!path.startsWith(prefix) || path.slice(prefix.length).includes("/")) continue;
          const id = path.slice(prefix.length);
          docs.push({
            id,
            ref: { path },
            data: () => ({ ...value }),
          });
        }
        return { docs };
      },
    };
  }
  return {
    data,
    batch() {
      const ops = [];
      return {
        set(ref, patch, options) {
          ops.push({ ref, patch, options });
        },
        async commit() {
          for (const op of ops) {
            const prev = data.get(op.ref.path) || {};
            data.set(op.ref.path, op.options?.merge ? { ...prev, ...op.patch } : { ...op.patch });
          }
        },
      };
    },
    collection() {
      return {
        orderBy() {
          const state = { after: null, max: 100 };
          return {
            startAfter(id) {
              state.after = id;
              return this;
            },
            limit(n) {
              state.max = n;
              return this;
            },
            async get() {
              const ids = [...data.keys()]
                .filter((path) => path.split("/").length === 2)
                .map((path) => path.split("/")[1])
                .filter((id) => state.after == null || id > state.after)
                .sort()
                .slice(0, state.max);
              return {
                docs: ids.map((id) => ({
                  id,
                  ref: { collection: () => reactions(id) },
                })),
              };
            },
          };
        },
      };
    },
  };
}

describe("reaction vectors shared with like-netting", () => {
  it("sorts content into the same buckets", () => {
    for (const row of vectors.buckets) {
      expect(reactionBucket(row.content)).toBe(row.bucket);
    }
  });

  it("keeps the newest reaction, with id breaking a created_at tie", () => {
    for (const row of vectors.newest) {
      let chosen = null;
      for (const event of row.events) chosen = preferNewerReaction(chosen, event);
      expect(chosen.id).toBe(row.winnerId);
    }
  });
});

describe("ingestUrlEvent reactions", () => {
  it("counts each pubkey's newest reaction and folds URL spellings onto one key", async () => {
    const db = memoryDb();
    const first = await ingestUrlEvent(
      db,
      reaction(ALICE, "+", 100, "https://m.x.com/Alice/status/42"),
      { source: "sweep", relay: "wss://relay.ditto.pub" },
      { nowMs: NOW_MS },
    );
    const second = await ingestUrlEvent(
      db,
      reaction(ALICE, "-", 200, PAGE),
      { source: "sweep" },
      { nowMs: NOW_MS },
    );
    const other = await ingestUrlEvent(
      db,
      reaction(BOB, "", 150, PAGE),
      { source: "push" },
      { nowMs: NOW_MS },
    );
    const emoji = await ingestUrlEvent(
      db,
      reaction(BOB, "🔥", 180, PAGE),
      { source: "push" },
      { nowMs: NOW_MS },
    );

    expect(first.activity).toMatchObject({
      url: PAGE,
      domain: "x.com",
      likeCount: 1,
      reactionCount: 1,
    });
    expect(second.stored).toBe(true);
    expect(emoji.activity).toMatchObject({
      likeCount: 0,
      dislikeCount: 1,
      emojiCount: 1,
      reactionCount: 2,
      zapCount: 0,
      zapMsats: 0,
      lastActivityAt: 200,
    });
    expect(other.stored).toBe(true);
    const { key, data } = await storedUrl(db);
    expect(data.updatedAt).toBeInstanceOf(FieldValue);
    expect(data.hidden).toBeUndefined();
    expect(data.rolledUp).toBeUndefined();
    const alice = await db
      .collection(URL_ACTIVITY_COLLECTION)
      .doc(key)
      .collection("reactions")
      .doc(ALICE_PK)
      .get();
    expect(alice.data()).toMatchObject({
      pubkey: ALICE_PK,
      reaction: "dislike",
      content: "-",
      url: PAGE,
      urlKey: key,
      domain: "x.com",
      source: "sweep",
    });
  });

  it("leaves counts alone when an older reaction arrives later", async () => {
    const db = memoryDb();
    await ingestUrlEvent(db, reaction(ALICE, "-", 200), { source: "sweep" });
    const older = await ingestUrlEvent(db, reaction(ALICE, "+", 100), {
      source: "sweep",
    });
    expect(older).toMatchObject({ ok: true, stored: false });
    expect(older.activity).toMatchObject({ dislikeCount: 1, likeCount: 0 });
    const { key } = await storedUrl(db);
    const doc = await db
      .collection(URL_ACTIVITY_COLLECTION)
      .doc(key)
      .collection("reactions")
      .doc(ALICE_PK)
      .get();
    expect(doc.data().content).toBe("-");
    expect(doc.data().pubkey).toBe(ALICE_PK);
  });

  it("fills pubkey on an older reaction document that was stored without it", async () => {
    const key = urlKey(canonicalUrl(PAGE));
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/${key}`]: {
        url: PAGE,
        likeCount: 0,
        dislikeCount: 1,
        emojiCount: 0,
        reactionCount: 1,
      },
      [`${URL_ACTIVITY_COLLECTION}/${key}/reactions/${ALICE_PK}`]: {
        eventId: "f".repeat(64),
        content: "-",
        reaction: "dislike",
        createdAt: 200,
        url: PAGE,
        urlKey: key,
        domain: "x.com",
      },
    });
    const older = await ingestUrlEvent(db, reaction(ALICE, "+", 100), {
      source: "sweep",
    });
    expect(older).toMatchObject({ ok: true, stored: false });
    const doc = await db
      .collection(URL_ACTIVITY_COLLECTION)
      .doc(key)
      .collection("reactions")
      .doc(ALICE_PK)
      .get();
    expect(doc.data()).toMatchObject({
      pubkey: ALICE_PK,
      content: "-",
      reaction: "dislike",
    });
  });

  it("rejects a reaction that is not a signed web page", async () => {
    const db = memoryDb();
    const unsigned = reaction(ALICE, "+", 100);
    unsigned.sig = "0".repeat(128);
    expect(
      (await ingestUrlEvent(db, unsigned, { source: "sweep" })).reason,
    ).toBe("event-sig");
    expect(
      (
        await ingestUrlEvent(db, reaction(ALICE, "+", 100, PAGE, "note"), {
          source: "sweep",
        })
      ).reason,
    ).toBe("not-web");
    expect(
      (
        await ingestUrlEvent(db, reaction(ALICE, "+", 100, "isbn:123"), {
          source: "sweep",
        })
      ).reason,
    ).toBe("invalid-url");
    expect((await ingestUrlEvent(db, reaction(ALICE, "+", 100), {})).reason).toBe(
      "invalid-source",
    );
    expect(db.docs.size).toBe(0);
  });

  it("strips www from the domain and keeps the canonical host in the URL", async () => {
    const db = memoryDb();
    const result = await ingestUrlEvent(
      db,
      reaction(ALICE, "+", 10, "https://www.Example.com/a/"),
      { source: "web-pulse-import" },
    );
    expect(result.activity).toMatchObject({
      url: "https://www.example.com/a",
      domain: "example.com",
    });
    expect(domainFromCanonical("https://www.youtube.com/watch?v=abcdefghijk")).toBe(
      "youtube.com",
    );
  });
});

describe("ingestUrlEvent receipts", () => {
  it("stores a validated receipt and the recipient total once", async () => {
    const db = dbWithProvider();
    const event = receipt();
    const stored = await ingestUrlEvent(
      db,
      event,
      { source: "sweep", relay: "wss://relay.ditto.pub/" },
      { nowMs: NOW_MS },
    );
    const again = await ingestUrlEvent(
      db,
      event,
      { source: "sweep", relay: "wss://relay.ditto.pub/" },
      { nowMs: NOW_MS },
    );
    expect(stored.activity).toMatchObject({
      url: PAGE,
      domain: "x.com",
      zapCount: 1,
      zapMsats: BOLT11_AMOUNT_MSATS,
      reactionCount: 0,
    });
    expect(again).toMatchObject({ ok: true, stored: false });
    expect(again.activity.zapCount).toBe(1);
    const zap = await db.collection(URL_ZAPS_COLLECTION).doc(event.id).get();
    expect(zap.data()).toMatchObject({
      urlKey: urlKey(PAGE),
      recipientPubkey: RECIPIENT_PK,
      senderPubkey: getPublicKey(SENDER_SK),
      amountMsats: BOLT11_AMOUNT_MSATS,
      comment: "thanks",
      source: "sweep",
      relay: "wss://relay.ditto.pub/",
      aTag: A_TAG,
    });
    const recipient = await db
      .collection(URL_ACTIVITY_COLLECTION)
      .doc(urlKey(PAGE))
      .collection("recipients")
      .doc(RECIPIENT_PK)
      .get();
    expect(recipient.data()).toEqual({
      count: 1,
      msats: BOLT11_AMOUNT_MSATS,
      lastAt: event.created_at,
    });
  });

  it("stores an anonymous zap with no sender", async () => {
    const db = dbWithProvider();
    const event = receipt({ anon: true });
    const result = await ingestUrlEvent(
      db,
      event,
      { source: "push" },
      { nowMs: NOW_MS },
    );
    expect(result.ok).toBe(true);
    const zap = await db.collection(URL_ZAPS_COLLECTION).doc(event.id).get();
    expect(zap.data().senderPubkey).toBeNull();
    expect(zap.data().comment).toBe("");
  });

  it("does not fetch a provider for a receipt that is not one URL zap", async () => {
    const refreshProfiles = vi.fn();
    const db = memoryDb();
    const event = finalizeEvent(
      {
        kind: 9735,
        created_at: 10,
        content: "",
        tags: [
          ["p", RECIPIENT_PK],
          ["a", A_TAG],
          ["a", `39735:${RECIPIENT_PK}:https://example.com/other`],
        ],
      },
      PROVIDER_SK,
    );
    const duplicate = await ingestUrlEvent(
      db,
      event,
      { source: "sweep" },
      { refreshProfiles, nowMs: NOW_MS },
    );
    expect(duplicate.reason).toBe("duplicate-a");
    const ordinary = finalizeEvent(
      {
        kind: 9735,
        created_at: 10,
        content: "",
        tags: [["p", RECIPIENT_PK]],
      },
      PROVIDER_SK,
    );
    const missing = await ingestUrlEvent(
      db,
      ordinary,
      { source: "sweep" },
      { refreshProfiles, nowMs: NOW_MS },
    );
    expect(missing.reason).toBe("not-url-receipt");
    expect(refreshProfiles).not.toHaveBeenCalled();
    expect(db.docs.size).toBe(0);
  });

  it("uses a fresh provider and refreshes one older than 24 hours", async () => {
    const fresh = dbWithProvider();
    const refreshProfiles = vi.fn();
    await ingestUrlEvent(
      fresh,
      receipt(),
      { source: "sweep" },
      { refreshProfiles, nowMs: NOW_MS },
    );
    expect(refreshProfiles).not.toHaveBeenCalled();

    const stale = dbWithProvider(
      freshZap({
        checkedAt: new Date(NOW_MS - 25 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const refresh = vi.fn(async (db) => {
      await db
        .collection(PROFILE_COLLECTION)
        .doc(RECIPIENT_PK)
        .set({ zap: freshZap() }, { merge: true });
    });
    const event = receipt();
    const result = await ingestUrlEvent(
      stale,
      event,
      { source: "sweep" },
      { refreshProfiles: refresh, nowMs: NOW_MS },
    );
    expect(refresh).toHaveBeenCalledWith(
      stale,
      [{ pubkey: RECIPIENT_PK, role: "url-recipient" }],
      expect.objectContaining({ nowMs: NOW_MS }),
    );
    expect(result.stored).toBe(true);
  });

  it("rejects a finished non-zappable provider and retries a transient one", async () => {
    const closed = dbWithProvider(
      freshZap({ zappable: false, nostrPubkey: null, reason: "missing-lud16" }),
    );
    const rejected = await ingestUrlEvent(
      closed,
      receipt(),
      { source: "sweep" },
      { nowMs: NOW_MS },
    );
    expect(rejected).toMatchObject({
      ok: false,
      reason: "provider-not-zappable",
      retry: false,
    });

    const missing = memoryDb();
    const refresh = vi.fn(async () => {
      throw new Error("timeout");
    });
    const retry = await ingestUrlEvent(
      missing,
      receipt(),
      { source: "sweep" },
      { refreshProfiles: refresh, nowMs: NOW_MS },
    );
    expect(retry).toMatchObject({ reason: "provider-unavailable", retry: true });
    const givenUp = await ingestUrlEvent(
      missing,
      receipt(),
      { source: "sweep" },
      { refreshProfiles: refresh, nowMs: NOW_MS, giveUpOnProvider: true },
    );
    expect(givenUp).toMatchObject({
      reason: "provider-unavailable",
      retry: false,
    });
  });
});

describe("provider freshness", () => {
  it("treats a boolean result inside 24 hours as fresh", () => {
    expect(providerIsFresh(freshZap(), NOW_MS)).toBe(true);
    expect(
      providerIsFresh(
        freshZap({ checkedAt: new Date(NOW_MS - 25 * 60 * 60 * 1000).toISOString() }),
        NOW_MS,
      ),
    ).toBe(false);
    expect(providerIsFresh({ zappable: null, checkedAt: new Date(NOW_MS).toISOString() }, NOW_MS)).toBe(
      false,
    );
  });
});

describe("applyReactionChange", () => {
  it("moves one pubkey between buckets without changing the reaction total", () => {
    expect(applyReactionChange({ likeCount: 1, reactionCount: 1 }, "like", "emoji")).toEqual({
      likeCount: 0,
      dislikeCount: 0,
      emojiCount: 1,
      reactionCount: 1,
    });
  });
});
