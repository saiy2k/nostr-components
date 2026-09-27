// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { directoryHandleId } from "./directory-state.js";
import { ingestPublishedClaim } from "./ingest-claim.js";

const RELAY = "wss://relay.damus.io";
const PROOF = "https://x.com/alice/status/1234567890123";

function signedClaim(tags = [["i", "twitter:alice", PROOF]]) {
  return finalizeEvent(
    {
      kind: 10011,
      created_at: 1_790_337_600,
      tags,
      content: "",
    },
    generateSecretKey(),
  );
}

function fakeFirestore() {
  const documents = new Map();
  const projected = [];
  const db = {
    projected,
    collection(collection) {
      return {
        doc(id) {
          return {
            collection,
            id,
            get: async () => {
              const data = documents.get(`${collection}/${id}`);
              return {
                exists: data !== undefined,
                data: () => (data === undefined ? null : data),
              };
            },
          };
        },
      };
    },
    batch() {
      const pending = [];
      return {
        set(ref, data) {
          pending.push({ collection: ref.collection, id: ref.id, data });
        },
        commit: async () => {
          for (const write of pending) {
            documents.set(`${write.collection}/${write.id}`, {
              ...(documents.get(`${write.collection}/${write.id}`) || {}),
              ...write.data,
            });
          }
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set(ref, data) {
          documents.set(`${ref.collection}/${ref.id}`, {
            ...(documents.get(`${ref.collection}/${ref.id}`) || {}),
            ...data,
          });
        },
      };
      return fn(tx);
    },
  };
  return db;
}

describe("ingestPublishedClaim", () => {
  it("rejects an event whose signature does not verify", async () => {
    const signed = signedClaim();
    const event = { ...signed, sig: "0".repeat(128) };
    for (const symbol of Object.getOwnPropertySymbols(event)) {
      delete event[symbol];
    }
    const db = fakeFirestore();
    const verifyHandleClaims = async () => {
      throw new Error("projection should not run");
    };
    await expect(
      ingestPublishedClaim(
        db,
        { event, relay: RELAY },
        { relays: [RELAY], verifyHandleClaims },
      ),
    ).resolves.toEqual({ ok: false, error: "invalid-event" });
  });

  it("writes one handle and projects only that handle", async () => {
    const event = signedClaim();
    const db = fakeFirestore();
    const seen = [];
    const result = await ingestPublishedClaim(
      db,
      { event, relay: "wss://relay.damus.io/" },
      {
        relays: ["wss://relay.damus.io"],
        verifyHandleClaims: async (handleData) => {
          seen.push(handleData.handle);
          const claim = handleData.claims[0];
          return {
            results: [
              {
                claimId: claim.claimId,
                identityStatus: "verified",
                verificationMethod: "nip39_proof_tweet",
              },
            ],
            proofTweetsAttempted: 1,
            attemptedClaimIds: [claim.claimId],
            deferReason: null,
          };
        },
      },
    );

    expect(result).toEqual({ ok: true, handle: "alice", status: "verified" });
    expect(seen).toEqual(["alice"]);
    const stored = await db
      .collection("nostrDirectoryHandles")
      .doc(directoryHandleId("alice"))
      .get();
    expect(stored.exists).toBe(true);
    expect(stored.data().handle).toBe("alice");
    expect(stored.data().activeIdentity.status).toBe("verified");
    expect(stored.data().activeIdentity.claimId).toBe(event.id);
  });

  it("rejects a relay the crawler does not read", async () => {
    const db = fakeFirestore();
    await expect(
      ingestPublishedClaim(
        db,
        { event: signedClaim(), relay: "wss://not-covered.example" },
        { relays: [RELAY] },
      ),
    ).resolves.toEqual({ ok: false, error: "relay-not-covered" });
  });
});
