// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { handleDocumentId } from "./handle-state.js";
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
    store: documents,
    collection(collection) {
      return {
        doc(id) {
          return {
            collection,
            id,
            get: async () => {
              await db.onGet?.(`${collection}/${id}`);
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

const onRelay = async () => true;

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
        { relays: [RELAY], eventOnRelay: onRelay, verifyHandleClaims },
      ),
    ).resolves.toEqual({ ok: false, error: "invalid-event" });
  });

  it("writes one handle and projects only that handle", async () => {
    const event = signedClaim();
    const db = fakeFirestore();
    const seen = [];
    const result = await ingestPublishedClaim(
      db,
      { event, relay: "wss://relay.damus.io/", handle: "@Alice" },
      {
        relays: ["wss://relay.damus.io"],
        eventOnRelay: onRelay,
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
      .doc(handleDocumentId("alice"))
      .get();
    expect(stored.exists).toBe(true);
    expect(stored.data().handle).toBe("alice");
    expect(stored.data().activeIdentity.status).toBe("verified");
    expect(stored.data().activeIdentity.claimId).toBe(event.id);
  });

  it("projects the claimed handle when the event also links another account", async () => {
    const event = signedClaim([
      ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
      ["i", "twitter:alice", PROOF],
    ]);
    const db = fakeFirestore();
    const seen = [];
    const result = await ingestPublishedClaim(
      db,
      { event, relay: RELAY, handle: "alice" },
      {
        relays: [RELAY],
        eventOnRelay: onRelay,
        verifyHandleClaims: async (handleData) => {
          seen.push(handleData.handle);
          const claim = handleData.claims.find(
            (item) => item.handle === "alice",
          );
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
  });

  it("does not verify again while the claim retry time is still in the future", async () => {
    const event = signedClaim();
    const db = fakeFirestore();
    let checks = 0;
    const config = {
      relays: [RELAY],
      eventOnRelay: onRelay,
      verifyHandleClaims: async (handleData) => {
        checks += 1;
        const claim = handleData.claims[0];
        return {
          results: [
            {
              claimId: claim.claimId,
              identityStatus: "retry_later",
              retryReason: "temporary_verification_failure",
            },
          ],
          proofTweetsAttempted: 1,
          attemptedClaimIds: [claim.claimId],
          deferReason: "temporary_verification_failure",
        };
      },
    };
    await expect(
      ingestPublishedClaim(db, { event, relay: RELAY, handle: "alice" }, config),
    ).resolves.toMatchObject({ ok: true, handle: "alice", status: "pending" });
    await expect(
      ingestPublishedClaim(db, { event, relay: RELAY, handle: "alice" }, config),
    ).resolves.toMatchObject({ ok: true, handle: "alice", status: "pending" });
    expect(checks).toBe(1);
  });

  it("rejects a claimed handle that is not on the event", async () => {
    const db = fakeFirestore();
    const event = signedClaim();
    await expect(
      ingestPublishedClaim(
        db,
        { event, relay: RELAY, handle: "carol" },
        { relays: [RELAY], eventOnRelay: onRelay },
      ),
    ).resolves.toEqual({ ok: false, error: "no-claim" });
    const stored = await db
      .collection("nostrDirectoryHandles")
      .doc(handleDocumentId("alice"))
      .get();
    expect(stored.exists).toBe(false);
  });

  it("does not persist a claim the covered relay does not have", async () => {
    const db = fakeFirestore();
    const event = signedClaim();
    await expect(
      ingestPublishedClaim(
        db,
        { event, relay: RELAY, handle: "alice" },
        { relays: [RELAY], eventOnRelay: async () => false },
      ),
    ).resolves.toEqual({ ok: false, error: "event-not-on-relay" });
    const stored = await db
      .collection("nostrDirectoryHandles")
      .doc(handleDocumentId("alice"))
      .get();
    expect(stored.exists).toBe(false);
  });

  it("keeps a claim written after the planning read", async () => {
    const first = signedClaim();
    const second = signedClaim([
      ["i", "twitter:alice", "https://x.com/alice/status/2234567890123"],
    ]);
    const db = fakeFirestore();
    const quiet = {
      relays: [RELAY],
      eventOnRelay: onRelay,
      verifyHandleClaims: async () => ({
        results: [],
        proofTweetsAttempted: 0,
        attemptedClaimIds: [],
        deferReason: null,
      }),
    };
    await ingestPublishedClaim(
      db,
      { event: first, relay: RELAY, handle: "alice" },
      quiet,
    );
    let reads = 0;
    db.onGet = async (key) => {
      reads += 1;
      if (reads !== 2) return;
      const current = db.store.get(key);
      current.claims = [
        ...(current.claims || []),
        { claimId: "racer", handle: "alice", status: "pending" },
      ];
    };
    await ingestPublishedClaim(
      db,
      { event: second, relay: RELAY, handle: "alice" },
      quiet,
    );
    const stored = await db
      .collection("nostrDirectoryHandles")
      .doc(handleDocumentId("alice"))
      .get();
    const ids = stored.data().claims.map((claim) => claim.claimId);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id, "racer"]));
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
