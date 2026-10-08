// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import test from "node:test";
import {
  createHiddenCache,
  createPulseOverviewHandler,
  getPulseDomain,
  getPulseOverview,
  listPulseActivity,
} from "./pulse.js";

const NOW = 1_700_000_000_000;
const SINCE = 1_700_000_000 - 24 * 60 * 60;

function pulseDb(records) {
  const queries = [];
  function matching(collection, group) {
    return Object.entries(records)
      .filter(([path]) => {
        if (group) return path.split("/").at(-2) === collection;
        const rest = path.startsWith(`${collection}/`) ? path.slice(collection.length + 1) : null;
        return rest != null && !rest.includes("/");
      })
      .map(([path, data]) => ({ id: path.split("/").pop(), ...data }));
  }
  function query(collection, group = false) {
    const state = { filters: [], orders: [], max: Infinity };
    const api = {
      where(field, op, value) {
        state.filters.push([field, op, value]);
        return api;
      },
      orderBy(field, direction = "asc") {
        state.orders.push([field, direction]);
        return api;
      },
      limit(max) {
        state.max = max;
        return api;
      },
      async get() {
        queries.push({
          collection,
          group,
          filters: state.filters.map((filter) => [...filter]),
          orders: state.orders.map((order) => [...order]),
          limit: state.max,
        });
        let rows = matching(collection, group);
        for (const [field, op, value] of state.filters) {
          rows = rows.filter((row) => {
            if (op === "==") return row[field] === value;
            if (op === ">=") return row[field] >= value;
            if (op === "<=") return row[field] <= value;
            return false;
          });
        }
        if (state.orders.length) {
          const [field, direction] = state.orders[0];
          rows = [...rows].sort((left, right) => {
            const delta = left[field] > right[field] ? 1 : left[field] < right[field] ? -1 : 0;
            return direction === "desc" ? -delta : delta;
          });
        }
        return {
          docs: rows.slice(0, state.max).map((row) => ({
            id: row.id,
            data: () => row,
          })),
        };
      },
    };
    return api;
  }
  return {
    queries,
    collection(name) {
      return {
        ...query(name),
        doc(id) {
          const path = `${name}/${id}`;
          return {
            async get() {
              const data = records[path];
              return {
                exists: data !== undefined,
                id,
                data: () => data,
              };
            },
          };
        },
      };
    },
    collectionGroup(name) {
      return query(name, true);
    },
  };
}

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

const records = {
  "nostrPulseSweepState/rollup": {
    domainCount: 1,
    likeCount: 4,
    dislikeCount: 0,
    emojiCount: 0,
    reactionCount: 4,
    zapCount: 1,
    zapMsats: 5000,
  },
  "nostrUrlDomains/example.com": {
    domain: "example.com",
    urlCount: 2,
    likeCount: 4,
    reactionCount: 4,
    zapCount: 1,
    zapMsats: 5000,
    lastActivityAt: 20,
  },
  "nostrUrlDomains/extra.com": {
    domain: "extra.com",
    urlCount: 1,
    reactionCount: 1,
    zapMsats: 9000,
    lastActivityAt: 3,
  },
  "nostrUrlDomains/hidden.example": {
    domain: "hidden.example",
    hidden: true,
    urlCount: 1,
    reactionCount: 99,
    zapMsats: 99,
  },
  "nostrUrlActivity/aa": {
    domain: "example.com",
    url: "https://example.com/a",
    zapMsats: 1000,
    reactionCount: 1,
    lastActivityAt: 10,
  },
  "nostrUrlActivity/bb": {
    domain: "example.com",
    url: "https://example.com/b",
    zapMsats: 4000,
    reactionCount: 3,
    hidden: true,
    lastActivityAt: 30,
  },
  "nostrUrlZaps/zap-new": {
    urlKey: "aa",
    url: "https://example.com/a",
    domain: "example.com",
    amountMsats: 5000,
    createdAt: SINCE + 10,
    senderPubkey: null,
    comment: "thanks",
  },
  "nostrUrlZaps/zap-old": {
    urlKey: "aa",
    url: "https://example.com/a",
    domain: "example.com",
    amountMsats: 1000,
    createdAt: SINCE - 10,
    senderPubkey: "ab".repeat(32),
    comment: "",
  },
  "nostrUrlActivity/aa/reactions/person": {
    pubkey: "cd".repeat(32),
    reaction: "like",
    content: "+",
    createdAt: SINCE + 5,
    urlKey: "aa",
    url: "https://example.com/a",
    domain: "example.com",
  },
  "nostrUrlActivity/bb/reactions/other": {
    pubkey: "ef".repeat(32),
    reaction: "emoji",
    content: "⚡",
    createdAt: SINCE + 6,
    urlKey: "bb",
    url: "https://example.com/b",
    domain: "example.com",
  },
};

test("overview returns site totals and drops hidden domains", async () => {
  const db = pulseDb(records);
  const cache = createHiddenCache();
  const result = await getPulseOverview(db, {}, { nowMs: NOW, hiddenCache: cache });
  assert.equal(result.status, 200);
  assert.equal(result.body.totals.domainCount, 1);
  assert.equal(result.body.totals.zapMsats, 5000);
  assert.deepEqual(
    result.body.domains.map((row) => row.domain),
    ["example.com", "extra.com"],
  );
  assert.equal(result.body.domains[0].reactionCount, 4);
  assert.equal(
    db.queries.some(
      (query) =>
        query.collection === "nostrUrlDomains" &&
        query.orders[0]?.[0] === "reactionCount" &&
        query.orders[0]?.[1] === "desc",
    ),
    true,
  );

  db.queries.length = 0;
  await getPulseOverview(db, {}, { nowMs: NOW + 1000, hiddenCache: cache });
  assert.equal(
    db.queries.some((query) => query.filters.some((filter) => filter[0] === "hidden")),
    false,
  );
});

test("search sorts the prefix window instead of returning name order", async () => {
  const db = pulseDb(records);
  const result = await getPulseOverview(
    db,
    { search: "e", sort: "zapMsats" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.domains.map((row) => row.domain),
    ["extra.com", "example.com"],
  );
});

test("domain view rejects a hidden domain and a hidden URL row", async () => {
  const db = pulseDb(records);
  const hidden = await getPulseDomain(
    db,
    { domain: "hidden.example" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(hidden.status, 404);

  const result = await getPulseDomain(
    db,
    { domain: "Example.com" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.domain, "example.com");
  assert.equal(result.body.totals.zapMsats, 5000);
  assert.deepEqual(
    result.body.urls.map((row) => row.urlKey),
    ["aa"],
  );
  assert.equal(result.body.urls[0].url, "https://example.com/a");
});

test("activity keeps the latest window and drops hidden URLs", async () => {
  const db = pulseDb(records);
  const result = await listPulseActivity(
    db,
    { days: "1", domain: "example.com" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.zaps, [
    {
      id: "zap-new",
      sats: 5,
      createdAt: SINCE + 10,
      senderPubkey: null,
      comment: "thanks",
      url: "https://example.com/a",
      domain: "example.com",
    },
  ]);
  assert.equal(result.body.reactions.length, 1);
  assert.equal(result.body.reactions[0].pubkey, "cd".repeat(32));
  assert.equal(result.body.reactions[0].url, "https://example.com/a");
});

test("a trailing dot is a search prefix and not a domain name", async () => {
  const db = pulseDb(records);
  const search = await getPulseOverview(
    db,
    { search: "example." },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(search.status, 200);
  assert.deepEqual(
    search.body.domains.map((row) => row.domain),
    ["example.com"],
  );
  const domain = await getPulseDomain(
    db,
    { domain: "example." },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(domain.status, 400);
  assert.equal(domain.body.error, "invalid_domain");
});

test("rejects an unknown sort and a missing day window", async () => {
  const db = pulseDb(records);
  const sort = await getPulseOverview(
    db,
    { sort: "name" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(sort.status, 400);
  assert.equal(sort.body.error, "invalid_sort");
  const days = await listPulseActivity(
    db,
    { days: "2" },
    { nowMs: NOW, hiddenCache: createHiddenCache() },
  );
  assert.equal(days.status, 400);
  assert.equal(days.body.error, "invalid_days");
});

test("overview is cached for a minute and only answers GET", async () => {
  const handler = createPulseOverviewHandler(pulseDb(records), {
    nowMs: NOW,
    hiddenCache: createHiddenCache(),
  });
  const ok = responseDouble();
  await handler({ method: "GET", query: {} }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers["Cache-Control"], "public, max-age=60");
  const wrong = responseDouble();
  await handler({ method: "POST", query: {} }, wrong);
  assert.equal(wrong.statusCode, 405);
});
