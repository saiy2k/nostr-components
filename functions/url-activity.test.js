// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import test from "node:test";
import {
  createIngestUrlEventHandler,
  createUrlActivityHandler,
  createViewerReactionsHandler,
  getUrlActivity,
  ingestPushedUrlEvent,
  listUrlEvents,
  listViewerReactions,
} from "./url-activity.js";

const KEY = "ab".repeat(32);
const OTHER = "cd".repeat(32);
const PUBKEY = "ef".repeat(32);
const EVENT_ID = "12".repeat(32);

function responseDouble() {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) {
      response.headers[name] = value;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

function activityDb(records) {
  const queries = [];
  function rowsUnder(prefix) {
    return Object.entries(records)
      .filter(
        ([path]) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
      )
      .map(([path, data]) => ({
        id: path.slice(prefix.length),
        data: () => data,
      }));
  }
  function query(docs) {
    const state = { docs, filters: [], order: null, max: Infinity };
    const api = {
      where(field, op, value) {
        state.filters.push([field, op, value]);
        return api;
      },
      orderBy(field, direction) {
        state.order = [field, direction];
        return api;
      },
      limit(n) {
        state.max = n;
        return api;
      },
      async get() {
        queries.push({
          filters: state.filters.map((filter) => [...filter]),
          order: state.order,
          limit: state.max,
        });
        let rows = state.docs.filter((doc) =>
          state.filters.every(
            ([field, op, value]) => op === "==" && doc.data()[field] === value,
          ),
        );
        if (state.order) {
          const [field, direction] = state.order;
          rows = [...rows].sort((left, right) => {
            const delta = Number(left.data()[field]) - Number(right.data()[field]);
            return direction === "desc" ? -delta : delta;
          });
        }
        return { docs: rows.slice(0, state.max) };
      },
    };
    return api;
  }
  function collectionRef(path) {
    return {
      doc(id) {
        const docPath = `${path}/${id}`;
        return {
          async get() {
            const data = records[docPath];
            return {
              exists: data !== undefined,
              id,
              data: () => (data === undefined ? null : data),
            };
          },
          collection(name) {
            return collectionRef(`${docPath}/${name}`);
          },
        };
      },
      where(field, op, value) {
        return query(rowsUnder(`${path}/`)).where(field, op, value);
      },
      orderBy(field, direction) {
        return query(rowsUnder(`${path}/`)).orderBy(field, direction);
      },
    };
  }
  return {
    queries,
    collection(name) {
      return collectionRef(name);
    },
    collectionGroup(name) {
      const docs = Object.entries(records)
        .filter(([path]) => path.split("/").at(-2) === name)
        .map(([path, data]) => ({
          id: path.split("/").pop(),
          data: () => data,
        }));
      return query(docs);
    },
  };
}

test("returns likes, dislikes, and one recipient's zap total", async () => {
  const db = activityDb({
    [`nostrUrlActivity/${KEY}`]: { likeCount: 3, dislikeCount: 1 },
    [`nostrUrlActivity/${KEY}/recipients/${PUBKEY}`]: {
      count: 2,
      msats: 2500,
    },
    [`nostrUrlActivity/${OTHER}`]: { likeCount: 4, dislikeCount: 0 },
  });
  const result = await getUrlActivity(db, {
    item: [`${KEY}:${PUBKEY}`, OTHER],
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items, [
    {
      urlKey: KEY,
      recipient: PUBKEY,
      likes: 3,
      dislikes: 1,
      zapCount: 2,
      sats: 2.5,
    },
    {
      urlKey: OTHER,
      recipient: null,
      likes: 4,
      dislikes: 0,
      zapCount: null,
      sats: null,
    },
  ]);
});

test("rejects more than twenty activity items", async () => {
  const items = Array.from({ length: 21 }, () => KEY);
  const result = await getUrlActivity(activityDb({}), { item: items.join(",") });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "too_many_items");
});

test("lists a recipient's zaps and the page reactions", async () => {
  const db = activityDb({
    [`nostrUrlZaps/${EVENT_ID}`]: {
      urlKey: KEY,
      recipientPubkey: PUBKEY,
      amountMsats: 1000,
      createdAt: 20,
      senderPubkey: null,
      comment: "thanks",
    },
    [`nostrUrlZaps/${"34".repeat(32)}`]: {
      urlKey: KEY,
      recipientPubkey: OTHER,
      amountMsats: 5000,
      createdAt: 30,
      senderPubkey: PUBKEY,
      comment: "",
    },
    [`nostrUrlActivity/${KEY}/reactions/${PUBKEY}`]: {
      pubkey: PUBKEY,
      reaction: "like",
      content: "+",
      createdAt: 10,
      urlKey: KEY,
    },
  });
  const result = await listUrlEvents(db, { key: KEY, recipient: PUBKEY, limit: "10" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.zaps, [
    {
      id: EVENT_ID,
      sats: 1,
      createdAt: 20,
      senderPubkey: null,
      comment: "thanks",
    },
  ]);
  assert.equal(result.body.reactions[0].reaction, "like");
  assert.deepEqual(db.queries[0], {
    filters: [
      ["urlKey", "==", KEY],
      ["recipientPubkey", "==", PUBKEY],
    ],
    order: ["createdAt", "desc"],
    limit: 10,
  });
});

test("lists one viewer's latest reactions by pubkey", async () => {
  const db = activityDb({
    [`nostrUrlActivity/${KEY}/reactions/${PUBKEY}`]: {
      pubkey: PUBKEY,
      reaction: "like",
      content: "+",
      createdAt: 10,
      urlKey: KEY,
    },
    [`nostrUrlActivity/${OTHER}/reactions/${PUBKEY}`]: {
      pubkey: PUBKEY,
      reaction: "dislike",
      content: "-",
      createdAt: 40,
      urlKey: OTHER,
    },
    [`nostrUrlActivity/${KEY}/reactions/${OTHER}`]: {
      pubkey: OTHER,
      reaction: "emoji",
      content: "🔥",
      createdAt: 50,
      urlKey: KEY,
    },
  });
  const result = await listViewerReactions(db, { pubkey: PUBKEY.toUpperCase() });
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.reactions.map((row) => row.urlKey),
    [OTHER, KEY],
  );
  assert.deepEqual(db.queries[0].filters, [["pubkey", "==", PUBKEY]]);
  assert.deepEqual(db.queries[0].order, ["createdAt", "desc"]);
  assert.equal(db.queries[0].limit, 500);
});

test("caches a URL activity read for thirty seconds", async () => {
  const handler = createUrlActivityHandler(
    activityDb({ [`nostrUrlActivity/${KEY}`]: { likeCount: 1, dislikeCount: 0 } }),
  );
  const response = responseDouble();
  await handler({ method: "GET", query: { item: KEY } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "public, max-age=30");
  assert.equal(response.body.items[0].likes, 1);
});

test("does not cache a viewer's reaction list", async () => {
  const handler = createViewerReactionsHandler(
    activityDb({
      [`nostrUrlActivity/${KEY}/reactions/${PUBKEY}`]: {
        pubkey: PUBKEY,
        reaction: "like",
        content: "+",
        createdAt: 10,
        urlKey: KEY,
      },
    }),
  );
  const response = responseDouble();
  await handler({ method: "GET", query: { pubkey: PUBKEY } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("pushes a URL event only after a sweep relay returns it", async () => {
  const seen = [];
  const event = { id: EVENT_ID, kind: 9735 };
  const result = await ingestPushedUrlEvent(
    { id: "db" },
    { event, relay: "wss://Relay.Ditto.pub/" },
    {
      relays: ["wss://relay.ditto.pub/"],
      normalizeRelayUrl: (value) => String(value).toLowerCase(),
      eventOnRelay: async (relay, posted, timeoutMs) => {
        seen.push({ relay, id: posted.id, kind: posted.kind, timeoutMs });
        return true;
      },
      ingestUrlEvent: async (db, posted, meta, options) => {
        seen.push({ db, posted, meta, options });
        return { ok: true, stored: true };
      },
    },
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.stored, true);
  assert.equal(seen[0].relay, "wss://relay.ditto.pub/");
  assert.equal(seen[0].kind, 9735);
  assert.equal(seen[0].timeoutMs, 3000);
  assert.deepEqual(seen[1].meta, {
    relay: "wss://relay.ditto.pub/",
    source: "push",
  });
  assert.equal(seen[1].options.profileTimeoutMs, 3000);
});

test("rejects a push when the sweep relay does not return the event", async () => {
  let ingested = false;
  const result = await ingestPushedUrlEvent(
    {},
    { event: { id: EVENT_ID.toUpperCase(), kind: 17 }, relay: "wss://relay.ditto.pub/" },
    {
      relays: ["wss://relay.ditto.pub/"],
      normalizeRelayUrl: (value) => value,
      eventOnRelay: async (_relay, event) => {
        assert.equal(event.id, EVENT_ID);
        return false;
      },
      ingestUrlEvent: async () => {
        ingested = true;
        return { ok: true };
      },
    },
  );
  assert.equal(ingested, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "event-not-on-relay");
});

test("does not ask a relay outside the sweep set", async () => {
  let asked = false;
  const result = await ingestPushedUrlEvent(
    {},
    { event: { id: EVENT_ID, kind: 17 }, relay: "wss://relay.example/" },
    {
      relays: ["wss://relay.ditto.pub/"],
      normalizeRelayUrl: (value) => value,
      eventOnRelay: async () => {
        asked = true;
        return true;
      },
    },
  );
  assert.equal(asked, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "relay-not-covered");
});

test("rejects an oversized URL ingest body", async () => {
  const handler = createIngestUrlEventHandler({
    ingestUrlEvent: async () => {
      throw new Error("should not ingest");
    },
  });
  const response = responseDouble();
  await handler(
    {
      method: "POST",
      rawBody: Buffer.alloc(64 * 1024 + 1),
      body: {},
    },
    response,
  );
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.error, "body-too-large");
});
