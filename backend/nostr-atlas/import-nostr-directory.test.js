// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  loadDirectoryClaims,
  planDirectoryImport,
} from "./import-nostr-directory.js";

const PUBKEY = "a".repeat(64);

function sourceRecord(documentId, createdAt = "2024-01-01T00:00:00.000Z") {
  return {
    collection: "twitter",
    document_id: documentId,
    document_created_at: createdAt,
    data: {
      verified: true,
      screenName: "alice",
      hexPubKey: PUBKEY,
      createdAt,
    },
  };
}

describe("loadDirectoryClaims", () => {
  it("skips a verified record that has no document id", () => {
    const loaded = loadDirectoryClaims([
      {
        collection: "twitter",
        data: { verified: true, screenName: "alice", hexPubKey: PUBKEY },
      },
    ]);

    expect(loaded.byHandle.size).toBe(0);
    expect(loaded.skippedKey).toBe(1);
  });
});

describe("planDirectoryImport", () => {
  it("does not revive a rejected claim that has no tombstone", () => {
    const incoming = loadDirectoryClaims([sourceRecord("doc-1")]).byHandle.get(
      "alice",
    );
    const plan = planDirectoryImport(
      {
        claims: [{ claimId: "nd:doc-1", status: "rejected", pubkey: PUBKEY }],
      },
      incoming,
    );

    expect(plan).toEqual({ changed: false, added: 0 });
  });

  it("does not report an incoming claim discarded by the inactive limit", () => {
    const existingClaims = Array.from({ length: 11 }, (_, index) => ({
      claimId: `nd:keep-${index}`,
      status: "verified",
      pubkey: PUBKEY,
      handle: "alice",
      proofPublishedAt: 2_000_000_000 + index,
    }));
    const incoming = loadDirectoryClaims([
      sourceRecord("old", "2020-01-01T00:00:00.000Z"),
    ]).byHandle.get("alice");
    const plan = planDirectoryImport(
      { claims: existingClaims, activeIdentity: existingClaims.at(-1) },
      incoming,
    );

    expect(plan).toEqual({ changed: false, added: 0 });
  });
});
