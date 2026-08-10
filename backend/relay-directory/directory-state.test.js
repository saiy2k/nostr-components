// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  checkXHandleExists,
  directoryHandleId,
  extractIdentityClaims,
  mergeHandleClaims,
  planDirectoryHandleWrites,
} from "./directory-state.js";
import { normalizeTwitterHandle } from "./utils.js";

const PUBKEY_A =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";
const PUBKEY_B =
  "8e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4f";

describe("identity claim extraction", () => {
  it("extracts a pending NIP-39 proof with bounded source-event evidence", async () => {
    const claims = await extractIdentityClaims(
      [
        {
          id: "event-a",
          kind: 10011,
          pubkey: PUBKEY_A,
          created_at: 200,
          content: "proof metadata",
          tags: [
            ["i", "twitter:Alice", "https://x.com/alice/status/1234567890123"],
          ],
        },
      ],
      "wss://relay.example",
      new Date("2026-07-03T00:00:00.000Z"),
    );

    expect(claims).toEqual([
      expect.objectContaining({
        claimId: "event-a",
        handle: "alice",
        pubkey: PUBKEY_A,
        proofTweetId: "1234567890123",
        sourceKind: 10011,
        sourceRelay: "wss://relay.example",
        status: "pending",
        signatureVerified: true,
      }),
    ]);
    expect(claims[0]).not.toHaveProperty("event");
    expect(claims[0]).not.toHaveProperty("eventJson");
    expect(claims[0].sourceEvent).toMatchObject({
      id: "event-a",
      kind: 10011,
      pubkey: PUBKEY_A,
      content: "proof metadata",
      tags: [
        {
          values: [
            "i",
            "twitter:Alice",
            "https://x.com/alice/status/1234567890123",
          ],
        },
      ],
    });
    expect(claims[0].sourceEvent.tags.every((tag) => !Array.isArray(tag))).toBe(
      true,
    );
    expect(claims[0].evidence[0].value).toEqual([
      "i",
      "twitter:Alice",
      "https://x.com/alice/status/1234567890123",
    ]);
  });

  it("bounds oversized i-tag evidence before planning writes", async () => {
    const huge = "x".repeat(5000);
    const claims = await extractIdentityClaims(
      [
        {
          id: "event-huge-tag",
          kind: 10011,
          pubkey: PUBKEY_A,
          created_at: 200,
          content: "",
          tags: [
            [
              "i",
              "twitter:Alice",
              `https://x.com/alice/status/1234567890123${huge}`,
              ...Array.from({ length: 20 }, () => huge),
            ],
          ],
        },
      ],
      "wss://relay.example",
    );

    expect(claims[0].evidence[0].value).toHaveLength(10);
    expect(claims[0].evidence[0].value.every((part) => part.length <= 2000)).toBe(
      true,
    );
  });

  it("extracts X handles and exact evidence from kind-0 metadata", async () => {
    const claims = await extractIdentityClaims(
      [
        {
          id: "event-profile",
          kind: 0,
          pubkey: PUBKEY_A,
          created_at: 100,
          content: JSON.stringify({
            name: "Alice",
            about: "Find me at https://x.com/Alice",
            nip05: "alice@example.com",
          }),
          tags: [],
        },
      ],
      "wss://relay.example",
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      claimId: "event-profile",
      handle: "alice",
      sources: ["kind0.about"],
      evidence: [
        {
          source: "kind0.about",
          value: "https://x.com/Alice",
        },
      ],
      metadata: {
        name: "Alice",
        nip05: "alice@example.com",
      },
    });
  });

  it("stores enough about text to explain handles found after 1000 characters", async () => {
    const about = `${"x".repeat(1200)} https://x.com/_wir_de`;
    const claims = await extractIdentityClaims(
      [
        {
          id: "event-long-about",
          kind: 0,
          pubkey: PUBKEY_A,
          created_at: 100,
          content: JSON.stringify({ about }),
          tags: [],
        },
      ],
      "wss://relay.example",
    );

    expect(claims[0]).toMatchObject({
      handle: "_wir_de",
      evidence: [{ source: "kind0.about", value: "https://x.com/_wir_de" }],
    });
    expect(claims[0].metadata.about).toContain("_wir_de");
  });

  it("accepts plain @handles only when FxTwitter confirms the profile", async () => {
    const requestedUrls = [];
    const event = {
      id: "event-mention",
      kind: 0,
      pubkey: PUBKEY_A,
      created_at: 100,
      content: JSON.stringify({ about: "Thanks @saiy2k and @missing_user" }),
      tags: [],
    };
    const claims = await extractIdentityClaims(
      [event],
      "wss://relay.example",
      new Date("2026-07-07T00:00:00.000Z"),
      {
        fetchImpl: async (url) => {
          requestedUrls.push(String(url));
          const exists = String(url).endsWith("/saiy2k");
          return {
            ok: exists,
            status: exists ? 200 : 404,
            json: async () =>
              exists
                ? {
                    code: 200,
                    user: { id: "1", screen_name: "saiy2k" },
                  }
                : { code: 404 },
          };
        },
      },
    );

    expect(requestedUrls).toEqual([
      "https://api.fxtwitter.com/2/profile/saiy2k",
      "https://api.fxtwitter.com/2/profile/missing_user",
    ]);
    expect(claims.map((claim) => claim.handle)).toEqual(["saiy2k"]);
    expect(claims[0]).toMatchObject({
      sources: ["kind0.about_mention"],
      evidence: [{ source: "kind0.about_mention", value: "@saiy2k" }],
    });
  });

  it("does not accept incomplete or mismatched FxTwitter profile payloads", async () => {
    await expect(
      checkXHandleExists("alice", {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, user: { id: "1" } }),
        }),
      }),
    ).resolves.toBeNull();

    await expect(
      checkXHandleExists("alice", {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            user: { id: "1", screen_name: "bob" },
          }),
        }),
      }),
    ).resolves.toBeNull();
  });

  it("reports indeterminate FxTwitter lookup failures separately from missing users", async () => {
    const failures = [];
    await expect(
      checkXHandleExists("alice", {
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          json: async () => ({ code: 404 }),
        }),
      }),
    ).resolves.toBe(false);

    const result = await checkXHandleExists("alice", {
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
      onXLookupError: (error, handle) =>
        failures.push({ message: error.message, handle }),
    });

    expect(result).toBeNull();
    expect(failures).toEqual([
      { message: "network unavailable", handle: "alice" },
    ]);
  });

  it("normalizes handles and rejects reserved X paths", () => {
    expect(normalizeTwitterHandle("https://x.com/Alice")).toBe("alice");
    expect(normalizeTwitterHandle("@Home")).toBeNull();
  });
});

describe("bounded handle state", () => {
  it("preserves the active claim while adding a newer pending claim", () => {
    const existing = {
      activeIdentity: { claimId: "old", pubkey: PUBKEY_A },
      claims: [
        {
          claimId: "old",
          pubkey: PUBKEY_A,
          status: "verified",
          sourceCreatedAt: 100,
        },
      ],
    };
    const merged = mergeHandleClaims(existing, [
      {
        claimId: "new",
        pubkey: PUBKEY_B,
        status: "pending",
        sourceCreatedAt: 200,
      },
    ]);

    expect(merged.changed).toBe(true);
    expect(merged.claims.map((claim) => claim.claimId)).toEqual(["new", "old"]);
    expect(merged.pendingClaimCount).toBe(1);
  });

  it("skips existing and compactly rejected claim ids", () => {
    const merged = mergeHandleClaims(
      {
        claims: [{ claimId: "existing", status: "pending" }],
        rejectedClaimTombstones: [{ claimId: "rejected" }],
      },
      [
        { claimId: "existing", status: "pending" },
        { claimId: "rejected", status: "pending" },
      ],
    );

    expect(merged.changed).toBe(false);
    expect(merged.stats).toMatchObject({
      added: 0,
      skippedExisting: 1,
      skippedRejected: 1,
    });
  });

  it("retains only the newest bounded pending claims", () => {
    const merged = mergeHandleClaims(
      { claims: [] },
      [
        { claimId: "old", status: "pending", sourceCreatedAt: 100 },
        { claimId: "new", status: "pending", sourceCreatedAt: 200 },
      ],
      { maxPendingClaims: 1 },
    );

    expect(merged.claims.map((claim) => claim.claimId)).toEqual(["new"]);
    expect(merged.stats.evicted).toBe(1);
  });

  it("converts rejected full claims into bounded tombstones", () => {
    const merged = mergeHandleClaims({
      claims: [
        {
          claimId: "bad",
          status: "rejected",
          rejectionReason: "proof-author-mismatch",
          verifiedAt: "2026-07-03T00:00:00.000Z",
        },
      ],
    });

    expect(merged.claims).toEqual([]);
    expect(merged.rejectedClaimTombstones).toEqual([
      {
        claimId: "bad",
        rejectedAt: "2026-07-03T00:00:00.000Z",
        reason: "proof-author-mismatch",
      },
    ]);
  });
});

describe("directory handle write planning", () => {
  it("reads once per handle and writes only changed documents", async () => {
    const documents = new Map();
    const db = {
      collection: () => ({
        doc: (id) => ({
          get: async () => ({
            exists: documents.has(id),
            data: () => documents.get(id),
          }),
        }),
      }),
    };
    const claim = {
      claimId: "event-a",
      handle: "alice",
      status: "pending",
      sourceCreatedAt: 100,
    };
    const handleStateCache = new Map();

    const first = await planDirectoryHandleWrites(db, [claim], {
      firestoreHandlesCollection: "handles",
      handleStateCache,
    });
    expect(first.writes).toHaveLength(1);
    expect(first.writes[0]).toMatchObject({
      collection: "handles",
      id: directoryHandleId("alice"),
      handle: "alice",
      data: {
        handle: "alice",
        pendingClaimCount: 1,
        projectionStatus: "pending",
      },
    });
    expect(first.writes[0].data.nextAttemptAt).toBeTruthy();
    // Planning alone must not treat the write as committed.
    expect(handleStateCache.get("alice")).toBeNull();

    // Simulate a successful commit updating the shared cache.
    for (const write of first.writes) {
      handleStateCache.set(write.handle, write.nextCacheState);
    }

    const repeated = await planDirectoryHandleWrites(db, [claim], {
      handleStateCache,
    });
    expect(repeated.writes).toEqual([]);
    expect(repeated.stats.handlesRead).toBe(0);
    expect(repeated.stats.claimsSkippedExisting).toBe(1);
  });

  it("does not poison the shared cache before a successful commit", async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    };
    const handleStateCache = new Map();
    const planned = await planDirectoryHandleWrites(
      db,
      [
        {
          claimId: "event-a",
          handle: "alice",
          status: "pending",
          sourceCreatedAt: 100,
        },
      ],
      { firestoreHandlesCollection: "handles", handleStateCache },
    );

    expect(planned.writes[0].nextCacheState.claims).toHaveLength(1);
    expect(handleStateCache.get("alice")).toBeNull();
  });
});
