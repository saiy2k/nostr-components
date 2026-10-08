// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfileLookupHandler,
  displayProfileView,
  lookupNostrProfiles,
  profileLookupView,
  profileNeedsFetch,
} from "./profile-lookup.js";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";

const NOW = Date.parse("2026-10-07T00:00:00.000Z");
const PUBKEY = "ab".repeat(32);

function profileDb(initial = {}) {
  const docs = { ...initial };
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const path = `${name}/${id}`;
          return {
            async get() {
              const data = docs[path];
              return {
                exists: data !== undefined,
                data: () => (data === undefined ? null : data),
              };
            },
          };
        },
      };
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

test("fetches at most ten missing profiles and leaves the rest unknown", async () => {
  const pubkeys = Array.from({ length: 12 }, (_, index) =>
    index.toString(16).padStart(64, "0"),
  );
  const db = profileDb();
  const refreshed = [];
  const result = await lookupNostrProfiles(
    db,
    { pubkeys: pubkeys.join(",") },
    {
      nowMs: NOW,
      refreshProfiles: async (_db, targets, options) => {
        refreshed.push({ targets, options });
        for (const target of targets) {
          db.docs[`nostrProfiles/${target.pubkey}`] = {
            kind0Json: JSON.stringify({ kind: 0, pubkey: target.pubkey }),
            fetchedAt: new Date(NOW).toISOString(),
            zap: { zappable: true },
          };
        }
      },
    },
  );

  assert.equal(result.status, 200);
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].targets.length, 10);
  assert.equal(refreshed[0].targets[0].role, "lookup");
  assert.equal(refreshed[0].options.timeoutMs, 3000);
  assert.equal(refreshed[0].options.deadlineMs, NOW + 3000);
  assert.equal(result.body.profiles[0].zappable, true);
  assert.equal(result.body.profiles[0].profileEvent, null);
  assert.equal(result.body.profiles[10].profileEvent, null);
  assert.equal(result.body.profiles[10].zappable, null);
  assert.equal(result.body.profiles[11].relayListEvent, null);
});

test("remembers a real miss for an hour and refetches it when fresh=1 is older than ten minutes", async () => {
  const missedAt = new Date(NOW - 30 * 60 * 1000).toISOString();
  const db = profileDb({
    [`nostrProfiles/${PUBKEY}`]: {
      fetchedAt: missedAt,
      missingUntil: new Date(NOW + 60 * 60 * 1000).toISOString(),
      zap: { zappable: null, transient: true },
    },
  });
  let calls = 0;
  const refreshProfiles = async () => {
    calls += 1;
  };

  const cached = await lookupNostrProfiles(
    db,
    { pubkeys: PUBKEY },
    { nowMs: NOW, refreshProfiles },
  );
  assert.equal(calls, 0);
  assert.equal(cached.body.profiles[0].zappable, null);

  const forced = await lookupNostrProfiles(
    db,
    { pubkeys: PUBKEY, fresh: "1" },
    { nowMs: NOW, refreshProfiles },
  );
  assert.equal(calls, 1);
  assert.equal(forced.status, 200);
});

test("does not refetch a stored profile unless fresh=1 and the copy is older than ten minutes", async () => {
  const db = profileDb({
    [`nostrProfiles/${PUBKEY}`]: {
      kind0Json: JSON.stringify({ kind: 0, content: "{}" }),
      relayListJson: JSON.stringify({ kind: 10002, tags: [] }),
      fetchedAt: new Date(NOW - 11 * 60 * 1000).toISOString(),
      zap: { zappable: false },
    },
  });
  let calls = 0;
  const refreshProfiles = async () => {
    calls += 1;
  };
  const stored = await lookupNostrProfiles(
    db,
    { pubkeys: PUBKEY },
    { nowMs: NOW, refreshProfiles },
  );
  assert.equal(calls, 0);
  assert.equal(stored.body.profiles[0].zappable, false);
  assert.equal(stored.body.profiles[0].relayListEvent, null);

  const recent = await lookupNostrProfiles(
    db,
    { pubkeys: PUBKEY, fresh: "1" },
    {
      nowMs: NOW - 5 * 60 * 1000,
      refreshProfiles,
    },
  );
  assert.equal(calls, 0);
  assert.equal(recent.status, 200);

  await lookupNostrProfiles(
    db,
    { pubkeys: PUBKEY, fresh: "1" },
    { nowMs: NOW, refreshProfiles },
  );
  assert.equal(calls, 1);
});

test("rejects a fresh lookup that names more than one pubkey", async () => {
  const result = await lookupNostrProfiles(
    profileDb(),
    { pubkeys: `${PUBKEY},${"cd".repeat(32)}`, fresh: "1" },
    { refreshProfiles: async () => {} },
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "fresh_requires_one");
});

test("a budget cutoff is not a remembered miss", () => {
  assert.equal(
    profileNeedsFetch(
      { fetchedAt: new Date(NOW - 1000).toISOString(), zap: { zappable: null } },
      NOW,
      false,
    ),
    true,
  );
  assert.equal(
    profileNeedsFetch(
      {
        kind0Json: "{}",
        fetchedAt: new Date(NOW - 1000).toISOString(),
        zap: { zappable: null, transient: true },
      },
      NOW,
      false,
    ),
    false,
  );
  assert.equal(
    profileNeedsFetch(
      {
        kind0Json: "{}",
        fetchedAt: new Date(NOW - 11 * 60 * 1000).toISOString(),
        zap: { zappable: null, transient: true },
      },
      NOW,
      false,
    ),
    true,
  );
});

test("returns a signed event only when it belongs to the requested pubkey", () => {
  const secret = generateSecretKey();
  const pubkey = getPublicKey(secret);
  const event = finalizeEvent(
    { kind: 0, created_at: 1_700_000_000, tags: [], content: "{}" },
    secret,
  );
  const other = finalizeEvent(
    { kind: 0, created_at: 1_700_000_000, tags: [], content: "{}" },
    generateSecretKey(),
  );
  assert.equal(
    profileLookupView(pubkey, { kind0Json: JSON.stringify(event) }).profileEvent.id,
    event.id,
  );
  assert.equal(
    profileLookupView(pubkey, { kind0Json: JSON.stringify(other) }).profileEvent,
    null,
  );
  assert.equal(
    profileLookupView(pubkey, {
      kind0Json: JSON.stringify({ kind: 0, pubkey, content: "{}" }),
    }).profileEvent,
    null,
  );
});

test("view=display prefers display_name and drops an http picture", () => {
  const secret = generateSecretKey();
  const pubkey = getPublicKey(secret);
  const event = finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [],
      content: JSON.stringify({
        display_name: "Ada",
        name: "ada",
        picture: "http://example.com/a.png",
      }),
    },
    secret,
  );
  const httpsEvent = finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [],
      content: JSON.stringify({
        name: "Bea",
        picture: "https://example.com/b.png",
      }),
    },
    secret,
  );
  assert.deepEqual(displayProfileView(pubkey, { kind0Json: JSON.stringify(event) }), {
    pubkey,
    name: "Ada",
    picture: "",
  });
  assert.equal(
    displayProfileView(pubkey, { kind0Json: JSON.stringify(httpsEvent) }).picture,
    "https://example.com/b.png",
  );
  assert.deepEqual(displayProfileView(pubkey, { kind0Json: "{}" }), {
    pubkey,
    name: "",
    picture: "",
  });
});

test("view=display returns only the name and picture", async () => {
  const secret = generateSecretKey();
  const pubkey = getPublicKey(secret);
  const event = finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [],
      content: JSON.stringify({ display_name: "Ada", name: "ada" }),
    },
    secret,
  );
  const db = profileDb({
    [`nostrProfiles/${pubkey}`]: {
      kind0Json: JSON.stringify(event),
      fetchedAt: new Date(NOW).toISOString(),
      zap: { zappable: true },
    },
  });
  const result = await lookupNostrProfiles(
    db,
    { pubkeys: pubkey, view: "display" },
    { nowMs: NOW, refreshProfiles: async () => {} },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.profiles, [{ pubkey, name: "Ada", picture: "" }]);
});

test("profile lookup answers GET and does not cache", async () => {
  const handler = createProfileLookupHandler({
    db: profileDb(),
    refreshProfiles: async () => {
      throw new Error("should not fetch");
    },
  });
  const missing = responseDouble();
  await handler({ method: "GET", query: {} }, missing);
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.headers["Cache-Control"], "no-store");

  const wrong = responseDouble();
  await handler({ method: "POST", query: {} }, wrong);
  assert.equal(wrong.statusCode, 405);
});
