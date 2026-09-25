// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { nip19 } from "nostr-tools";
import {
  createDirectoryListHandler,
  directorySearchFilter,
  listDirectoryProfiles,
  publicDirectoryProfile,
} from "./directory.js";

function handleRecord(handle, overrides = {}) {
  return {
    platform: "twitter",
    handle,
    claims: [{ evidence: "private-evidence" }],
    activeIdentity: {
      status: "verified",
      pubkey: "A".repeat(64),
      npub: "npub1incorrect",
      metadata: {
        name: "Alice",
        nip05: "alice@example.com",
        about: "not-public-here",
      },
      lud16: "do-not-expose@example.com",
    },
    ...overrides,
  };
}

function fakeDatabase(records) {
  const reads = [];

  function nestedValue(value, path) {
    return path.split(".").reduce((current, key) => current?.[key], value);
  }

  return {
    reads,
    collection(name) {
      const operation = { name, filters: [], offset: 0 };
      reads.push(operation);
      const query = {
        where(field, operator, value) {
          operation.filters.push([field, operator, value]);
          operation.filter ||= [field, operator, value];
          return this;
        },
        orderBy(field) {
          operation.order = field;
          return this;
        },
        offset(offset) {
          operation.offset = offset;
          return this;
        },
        select(...fields) {
          operation.fields = fields;
          return this;
        },
        limit(limit) {
          operation.limit = limit;
          return this;
        },
        count() {
          operation.counted = true;
          return {
            async get() {
              return { data: () => ({ count: matchingEntries().length }) };
            },
          };
        },
        async get() {
          return {
            docs: matchingEntries()
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(operation.offset)
              .slice(0, operation.limit)
              .map(([id, data]) => ({ id, data: () => data })),
          };
        },
      };

      function matchingEntries() {
        return Object.entries(records).filter(([, data]) =>
          operation.filters.every(([field, operator, value]) => {
            assert.equal(operator, "==");
            return nestedValue(data, field) === value;
          }),
        );
      }

      return query;
    },
  };
}

test("exposes an allowlist of current identity fields, never evidence or payment data", () => {
  assert.deepEqual(
    publicDirectoryProfile("twitter:alice", handleRecord("alice")),
    {
      id: "twitter:alice",
      platform: "twitter",
      handle: "alice",
      pubkey: "a".repeat(64),
      verified: true,
      name: "Alice",
      nip05: "alice@example.com",
    },
  );
});

test("rejects unverified, malformed, mismatched, or unsupported records", () => {
  const valid = handleRecord("alice");
  for (const data of [
    { ...valid, activeIdentity: null },
    {
      ...valid,
      activeIdentity: { ...valid.activeIdentity, status: "pending" },
    },
    {
      ...valid,
      activeIdentity: { ...valid.activeIdentity, pubkey: "bad-key" },
    },
    { ...valid, platform: "youtube" },
    { ...valid, handle: "bob" },
  ]) {
    assert.equal(publicDirectoryProfile("twitter:alice", data), null);
  }
  assert.equal(
    publicDirectoryProfile("twitter:home", handleRecord("home")),
    null,
  );
  assert.equal(publicDirectoryProfile("other:alice", valid), null);
});

test("handles absent metadata and bounds display fields", () => {
  const data = handleRecord("alice");
  delete data.activeIdentity.metadata;
  assert.equal(publicDirectoryProfile("twitter:alice", data).name, "alice");
  assert.equal(publicDirectoryProfile("twitter:alice", data).nip05, "");
  data.activeIdentity.metadata = {
    name: "n".repeat(120),
    nip05: "x".repeat(300),
  };
  assert.equal(publicDirectoryProfile("twitter:alice", data).name.length, 100);
  assert.equal(publicDirectoryProfile("twitter:alice", data).nip05.length, 255);
});

test("returns database totals and supports arbitrary page offsets", async () => {
  const db = fakeDatabase({
    "twitter:alice": handleRecord("alice"),
    "twitter:bob": handleRecord("bob", {
      activeIdentity: { status: "pending" },
    }),
    "twitter:carol": handleRecord("carol"),
    "twitter:dave": handleRecord("dave"),
  });
  const first = await listDirectoryProfiles(db, { limit: "2" });
  assert.deepEqual(
    first.body.profiles.map((p) => p.handle),
    ["alice", "carol"],
  );
  assert.equal(first.body.total, 3);
  assert.equal(first.body.offset, 0);
  const second = await listDirectoryProfiles(db, {
    limit: "2",
    offset: "2",
  });
  assert.deepEqual(
    second.body.profiles.map((p) => p.handle),
    ["dave"],
  );
  assert.equal(second.body.total, 3);
  assert.equal(second.body.offset, 2);
  assert.equal(db.reads[0].limit, 2);
  assert.equal(db.reads[0].offset, 0);
  assert.equal(db.reads[1].offset, 2);
  assert.deepEqual(db.reads[0].filter, [
    "activeIdentity.status",
    "==",
    "verified",
  ]);
  assert.equal(db.reads[0].name, "nostrDirectoryHandles");
  assert.equal(db.reads[0].fields.includes("claims"), false);
});

test("omits malformed profiles while retaining the Firestore verified total", async () => {
  const db = fakeDatabase({
    "twitter:alice": handleRecord("alice", {
      activeIdentity: { status: "verified", pubkey: "invalid" },
    }),
    "twitter:bob": handleRecord("bob"),
  });
  const result = await listDirectoryProfiles(db, { limit: "1" });
  assert.deepEqual(result.body.profiles, []);
  assert.equal(result.body.total, 2);
  assert.equal(result.body.offset, 0);
});

test("empty collections are successful and collection overrides stay server controlled", async () => {
  const db = fakeDatabase({});
  assert.deepEqual(
    await listDirectoryProfiles(
      db,
      { collection: "ignored" },
      { collection: "testHandles" },
    ),
    {
      status: 200,
      body: { profiles: [], total: 0, offset: 0 },
    },
  );
  assert.equal(db.reads[0].name, "testHandles");
  assert.equal(db.reads[0].limit, 50);
});

test("rejects invalid limits, offsets, searches, and obsolete cursors before reading Firestore", async () => {
  const db = fakeDatabase({});
  for (const limit of [
    "0",
    "101",
    "-1",
    "1.5",
    "1e2",
    "abc",
    "",
    ["2"],
    {},
    2,
  ]) {
    assert.equal((await listDirectoryProfiles(db, { limit })).status, 400);
  }
  for (const cursor of [
    "",
    "twitter:alice/claims/secret",
    "../private",
    ["twitter:alice"],
    {},
    2,
  ]) {
    assert.equal((await listDirectoryProfiles(db, { cursor })).status, 400);
  }
  for (const offset of ["-1", "1.5", "1000001", "", ["2"], {}, 2]) {
    assert.equal((await listDirectoryProfiles(db, { offset })).status, 400);
  }
  for (const search of ["x".repeat(256), ["alice"], {}, 2]) {
    assert.equal((await listDirectoryProfiles(db, { search })).status, 400);
  }
  assert.equal(db.reads.length, 0);
});

test("parses exact handle, X URL, NIP-05, and npub searches", () => {
  const pubkey = "a".repeat(64);
  assert.deepEqual(directorySearchFilter("@Alice"), {
    field: "handle",
    value: "alice",
  });
  assert.deepEqual(directorySearchFilter("https://x.com/Alice"), {
    field: "handle",
    value: "alice",
  });
  assert.deepEqual(directorySearchFilter("alice@example.com"), {
    field: "activeIdentity.metadata.nip05",
    value: "alice@example.com",
  });
  assert.deepEqual(directorySearchFilter(nip19.npubEncode(pubkey)), {
    field: "activeIdentity.pubkey",
    value: pubkey,
  });
  assert.deepEqual(directorySearchFilter("npub1invalid"), {
    matchesNothing: true,
  });
});

test("searches the whole verified collection before paginating", async () => {
  const pubkey = "b".repeat(64);
  const db = fakeDatabase({
    "twitter:alice": handleRecord("alice"),
    "twitter:bob": handleRecord("bob", {
      activeIdentity: {
        status: "verified",
        pubkey,
        metadata: { name: "Bob", nip05: "bob@example.com" },
      },
    }),
  });

  for (const search of ["@bob", "bob@example.com", nip19.npubEncode(pubkey)]) {
    const result = await listDirectoryProfiles(db, { search });
    assert.equal(result.status, 200);
    assert.equal(result.body.total, 1);
    assert.deepEqual(
      result.body.profiles.map((profile) => profile.handle),
      ["bob"],
    );
  }
});

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("HTTP handler is read only and caches only successful responses", async () => {
  const db = fakeDatabase({});
  const handler = createDirectoryListHandler(db);
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const response = responseRecorder();
    await handler({ method, query: {} }, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, "GET");
    assert.equal(response.headers["Cache-Control"], "no-store");
  }
  assert.equal(db.reads.length, 0);
  const response = responseRecorder();
  await handler({ method: "GET", query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers["Cache-Control"],
    "public, max-age=60, s-maxage=60",
  );
  const invalid = responseRecorder();
  await handler({ method: "GET", query: { limit: "1000" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.headers["Cache-Control"], "no-store");
});

test("Firestore failures return a retryable error without internal details", async (context) => {
  context.mock.method(console, "error", () => {});
  const handler = createDirectoryListHandler({
    collection() {
      throw new Error("private-project-details");
    },
  });
  const response = responseRecorder();
  await handler({ method: "GET", query: {} }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: "directory_unavailable" });
  assert.equal(response.headers["Cache-Control"], "no-store");
});
