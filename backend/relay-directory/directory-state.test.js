// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  checkXHandleExists,
  directoryHandleId,
  extractIdentityClaims,
  mergeHandleClaims,
  normalizeTwitterHandle,
  planDirectoryHandleWrites,
} from "./directory-state.js";

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
        ["i", "twitter:Alice", "https://x.com/alice/status/1234567890123"],
      ],
    });
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

  it("accepts plain @handles only when the X profile does not return 404", async () => {
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
          const exists = String(url).endsWith("/saiy2k");
          return {
            status: exists ? 200 : 404,
            url,
            text: async () =>
              exists ? '<meta property="og:title" content="@saiy2k">' : "",
          };
        },
      },
    );

    expect(claims.map((claim) => claim.handle)).toEqual(["saiy2k"]);
    expect(claims[0]).toMatchObject({
      sources: ["kind0.about_mention"],
      evidence: [{ source: "kind0.about_mention", value: "@saiy2k" }],
    });
  });

  it("does not accept generic X shells or challenge redirects", async () => {
    await expect(
      checkXHandleExists("alice", {
        fetchImpl: async () => ({
          status: 200,
          url: "https://x.com/alice",
          text: async () => "<html><title>X</title></html>",
        }),
      }),
    ).resolves.toBeNull();

    await expect(
      checkXHandleExists("alice", {
        fetchImpl: async () => ({
          status: 200,
          url: "https://x.com/i/flow/login",
          text: async () => '<meta content="@alice">',
        }),
      }),
    ).resolves.toBeNull();
  });

  it("reports indeterminate X lookup failures separately from missing users", async () => {
    const failures = [];
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
      data: {
        handle: "alice",
        pendingClaimCount: 1,
        projectionStatus: "pending",
      },
    });

    const repeated = await planDirectoryHandleWrites(db, [claim], {
      handleStateCache,
    });
    expect(repeated.writes).toEqual([]);
    expect(repeated.stats.handlesRead).toBe(0);
    expect(repeated.stats.claimsSkippedExisting).toBe(1);
  });
});
