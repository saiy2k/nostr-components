// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { createIngestClaimHandler } from "./ingest-claim.js";

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

test("rejects non-POST ingest requests", async () => {
  const handler = createIngestClaimHandler();
  const response = responseDouble();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.body.error, "method_not_allowed");
});

test("ingests the posted event and does not cache the result", async () => {
  const seen = [];
  const handler = createIngestClaimHandler({
    db: { id: "db" },
    ingestPublishedClaim: async (db, input) => {
      seen.push({ db, input });
      return { ok: true, handle: "alice", status: "verified" };
    },
  });
  const response = responseDouble();
  await handler(
    {
      method: "POST",
      rawBody: Buffer.from("{}"),
      body: {
        event: { kind: 10011 },
        relay: "wss://relay.damus.io/",
        handle: "alice",
      },
    },
    response,
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.body, {
    ok: true,
    handle: "alice",
    status: "verified",
  });
  assert.equal(seen[0].db.id, "db");
  assert.equal(seen[0].input.relay, "wss://relay.damus.io/");
  assert.equal(seen[0].input.handle, "alice");
});

test("rejects an oversized ingest body", async () => {
  const handler = createIngestClaimHandler({
    ingestPublishedClaim: async () => {
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
});
