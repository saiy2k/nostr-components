// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { nip19 } from "nostr-tools";
import {
  checkClaimProof,
  loadClaimRelayUrls,
  parseProofTweetUrl,
} from "./claim-proof.js";

const PUBKEY = "ab".repeat(32);
const NPUB = nip19.npubEncode(PUBKEY);

function tweetResponse(text, handle = "alice") {
  return {
    ok: true,
    json: async () => ({
      code: 200,
      tweet: { text, author: { screen_name: handle } },
    }),
  };
}

test("parses a proof status URL and rejects reserved handles", () => {
  assert.deepEqual(
    parseProofTweetUrl("https://x.com/Alice/status/1234567890123?s=20"),
    { handle: "alice", tweetId: "1234567890123" },
  );
  assert.equal(
    parseProofTweetUrl("https://x.com/home/status/1234567890123").reserved,
    true,
  );
  assert.equal(
    parseProofTweetUrl("https://evil.example/alice/status/1234567890123"),
    null,
  );
});

test("loads crawler relays from the repo file when CLAIM_RELAYS is unset", () => {
  const relays = loadClaimRelayUrls({});
  assert.ok(relays.some((relay) => relay.includes("relay.damus.io")));
});

test("uses CLAIM_RELAYS instead of the baked file", () => {
  assert.deepEqual(
    loadClaimRelayUrls({
      CLAIM_RELAYS: "wss://one.example, wss://two.example",
    }),
    ["wss://one.example", "wss://two.example"],
  );
});

test("accepts a proof tweet that contains the npub and returns crawler relays", async () => {
  const result = await checkClaimProof(
    {
      url: "https://x.com/alice/status/1234567890123",
      npub: NPUB,
    },
    {
      relays: ["wss://relay.damus.io"],
      fetchImpl: async (url) => {
        assert.equal(
          url,
          "https://api.fxtwitter.com/alice/status/1234567890123",
        );
        return tweetResponse(`Verifying my Nostr identity\n${NPUB}`);
      },
    },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    crawlerRelays: ["wss://relay.damus.io"],
  });
});

test("rejects a proof tweet that does not contain the npub", async () => {
  const result = await checkClaimProof(
    {
      url: "https://x.com/alice/status/1234567890123",
      npub: NPUB,
    },
    {
      fetchImpl: async () => tweetResponse("hello"),
    },
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "npub-not-in-proof-tweet");
});

test("rejects a proof tweet from a different author", async () => {
  const result = await checkClaimProof(
    {
      url: "https://x.com/alice/status/1234567890123",
      npub: NPUB,
    },
    {
      fetchImpl: async () => tweetResponse(NPUB, "bob"),
    },
  );
  assert.equal(result.body.error, "proof-author-mismatch");
});
