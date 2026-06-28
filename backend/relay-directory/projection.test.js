// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import {
  checkZapSupport,
  lightningAddressToLnurlp,
  parseProjectionArgs,
  runProjection,
  verifyHandleClaims,
} from "./projection.js";
import {
  applyProjectionResults,
  buildHandleProjectionWrites,
  directoryEntryId,
  pendingClaimsForHandle,
  projectionHandleIsDue,
} from "./projection-state.js";

const PUBKEY_A =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";
const PUBKEY_B =
  "8e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4f";
const NPUB_A = nip19.npubEncode(PUBKEY_A);
const NOW = new Date("2026-07-03T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("projection configuration", () => {
  it("reads handle claims directly and keeps a free-tier write budget", () => {
    expect(
      parseProjectionArgs(["--firestore-project", "gr-prod"]),
    ).toMatchObject({
      firestoreHandlesCollection: "nostrDirectoryHandles",
      firestoreEntriesCollection: "nostrDirectoryEntries",
      projectionLimit: 1000,
      projectionWriteBudget: 10000,
      maxPendingClaims: 20,
      maxInactiveVerifiedClaims: 10,
      maxRejectionTombstones: 100,
    });
  });

  it("removes the raw-event and queue source options", () => {
    expect(() =>
      parseProjectionArgs([
        "--firestore-project",
        "gr-prod",
        "--projection-source",
        "queue",
      ]),
    ).toThrow("Unknown projection argument: --projection-source");
  });

  it("validates write and retention limits", () => {
    expect(() =>
      parseProjectionArgs([
        "--firestore-project",
        "gr-prod",
        "--projection-write-budget",
        "-1",
      ]),
    ).toThrow("--projection-write-budget must be an integer >= 0.");
  });
});

describe("claim projection policy", () => {
  it("processes pending claims newest first", () => {
    expect(
      pendingClaimsForHandle({
        claims: [
          pendingClaim("old", PUBKEY_A, 100),
          pendingClaim("new", PUBKEY_B, 200),
        ],
      }).map((claim) => claim.claimId),
    ).toEqual(["new", "old"]);
  });

  it("keeps an existing active identity when backfill verifies an older claim", () => {
    const active = verifiedClaim("current", PUBKEY_A, 200);
    const transition = applyProjectionResults(
      {
        handle: "alice",
        activeIdentity: active,
        claims: [active, pendingClaim("historical", PUBKEY_B, 100)],
        pendingClaimCount: 1,
        projectionStatus: "pending",
      },
      [verifiedResult("historical")],
      { now: NOW },
    );

    expect(transition.state.activeIdentity.claimId).toBe("current");
    expect(transition.state.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimId: "historical", status: "verified" }),
      ]),
    );
    expect(transition.state.pendingClaimCount).toBe(0);
  });

  it("promotes a newer verified claim and retains the previous active claim", () => {
    const active = verifiedClaim("old", PUBKEY_A, 100);
    const transition = applyProjectionResults(
      {
        handle: "alice",
        activeIdentity: active,
        claims: [active, pendingClaim("new", PUBKEY_B, 200)],
        pendingClaimCount: 1,
      },
      [verifiedResult("new")],
      { now: NOW },
    );

    expect(transition.activeChanged).toBe(true);
    expect(transition.state.activeIdentity).toMatchObject({
      claimId: "new",
      pubkey: PUBKEY_B,
      status: "verified",
    });
    expect(transition.state.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimId: "old", status: "verified" }),
      ]),
    );
  });

  it("removes rejected claims and retains only a compact tombstone", () => {
    const transition = applyProjectionResults(
      {
        claims: [pendingClaim("bad", PUBKEY_A, 100)],
        pendingClaimCount: 1,
      },
      [
        {
          claimId: "bad",
          identityStatus: "rejected",
          rejectionReason: "proof-author-mismatch",
        },
      ],
      { now: NOW },
    );

    expect(transition.state.claims).toEqual([]);
    expect(transition.state.rejectedClaimTombstones).toEqual([
      {
        claimId: "bad",
        rejectedAt: NOW.toISOString(),
        reason: "proof-author-mismatch",
      },
    ]);
    expect(transition.state.projectionStatus).toBe("complete");
  });

  it("keeps transient failures pending until their retry time", () => {
    const transition = applyProjectionResults(
      {
        claims: [pendingClaim("retry", PUBKEY_A, 100)],
        pendingClaimCount: 1,
      },
      [
        {
          claimId: "retry",
          identityStatus: "retry_later",
          retryReason: "rate_limited",
        },
      ],
      { now: NOW, retryDelayMs: 60000 },
    );

    expect(transition.state).toMatchObject({
      pendingClaimCount: 1,
      projectionStatus: "retry_later",
      claims: [
        expect.objectContaining({
          claimId: "retry",
          status: "pending",
          retryReason: "rate_limited",
        }),
      ],
    });
    expect(transition.state.nextAttemptAt).toEqual(
      new Date("2026-07-03T12:01:00.000Z"),
    );
    expect(projectionHandleIsDue(transition.state, NOW.getTime())).toBe(false);
  });

  it("bounds inactive verified claims and rejected tombstones", () => {
    const active = verifiedClaim("active", PUBKEY_A, 500);
    const transition = applyProjectionResults(
      {
        activeIdentity: active,
        claims: [
          active,
          verifiedClaim("inactive-old", PUBKEY_B, 100),
          verifiedClaim("inactive-new", PUBKEY_B, 200),
          pendingClaim("bad", PUBKEY_B, 50),
        ],
        pendingClaimCount: 1,
        rejectedClaimTombstones: [
          { claimId: "older-bad", rejectedAt: "2026-07-01T00:00:00.000Z" },
        ],
      },
      [{ claimId: "bad", identityStatus: "rejected" }],
      {
        now: NOW,
        maxInactiveVerifiedClaims: 1,
        maxRejectionTombstones: 1,
      },
    );

    expect(transition.state.claims.map((claim) => claim.claimId)).toEqual([
      "active",
      "inactive-new",
    ]);
    expect(transition.state.rejectedClaimTombstones).toHaveLength(1);
    expect(transition.state.rejectedClaimTombstones[0].claimId).toBe("bad");
  });
});

describe("projection writes", () => {
  it("uses two writes when a verified identity becomes active", () => {
    const data = {
      handle: "alice",
      claims: [pendingClaim("claim", PUBKEY_A, 100)],
      pendingClaimCount: 1,
    };
    const transition = applyProjectionResults(data, [verifiedResult("claim")], {
      now: NOW,
    });
    const writes = buildHandleProjectionWrites(
      { id: "twitter:alice", data },
      transition,
      {
        firestoreHandlesCollection: "handles",
        firestoreEntriesCollection: "entries",
      },
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({
      collection: "handles",
      id: "twitter:alice",
      data: { pendingClaimCount: 0, projectionStatus: "complete" },
    });
    expect(writes[1]).toMatchObject({
      collection: "entries",
      id: directoryEntryId("alice", PUBKEY_A),
      data: {
        handle: "alice",
        pubkey: PUBKEY_A,
        identityStatus: "verified",
      },
    });
  });

  it("uses one write for rejection without an active identity", () => {
    const data = {
      handle: "alice",
      claims: [pendingClaim("bad", PUBKEY_A, 100)],
      pendingClaimCount: 1,
    };
    const transition = applyProjectionResults(
      data,
      [{ claimId: "bad", identityStatus: "rejected" }],
      { now: NOW },
    );
    expect(
      buildHandleProjectionWrites({ id: "twitter:alice", data }, transition),
    ).toHaveLength(1);
  });
});

describe("external verification", () => {
  it("verifies a kind-0 claim from an npub in the current X bio", async () => {
    vi.stubGlobal("fetch", async (url) => {
      expect(String(url)).toContain("/2/users/by/username/alice");
      return response({
        data: {
          id: "x-user-1",
          username: "alice",
          description: `Nostr: ${NPUB_A}`,
        },
      });
    });
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({
        scanXProfiles: true,
        xBearerToken: "token",
        checkZaps: false,
      }),
      { profilesRemaining: 1, proofsRemaining: 1 },
    );

    expect(result).toMatchObject({
      xProfilesAttempted: 1,
      xBioIdentifiersResolved: 1,
      proofTweetsAttempted: 0,
      results: [
        expect.objectContaining({
          claimId: "kind0",
          identityStatus: "verified",
          verificationMethod: "x_profile_bio_npub",
        }),
      ],
    });
  });

  it("treats a current X bio link as newer than an older active claim", async () => {
    const npubB = nip19.npubEncode(PUBKEY_B);
    vi.stubGlobal("fetch", async () =>
      response({
        data: {
          id: "x-user-1",
          username: "alice",
          description: `Current Nostr: ${npubB}`,
        },
      }),
    );
    const active = verifiedClaim("active", PUBKEY_A, 200);
    const handleData = {
      handle: "alice",
      activeIdentity: active,
      claims: [active, pendingClaim("bio", PUBKEY_B, 100, null)],
      pendingClaimCount: 1,
    };
    const verification = await verifyHandleClaims(
      handleData,
      projectionArgs({
        scanXProfiles: true,
        xBearerToken: "token",
        checkZaps: false,
      }),
      { profilesRemaining: 1, proofsRemaining: 1 },
    );
    const transition = applyProjectionResults(
      handleData,
      verification.results,
      { now: NOW },
    );

    expect(transition.state.activeIdentity).toMatchObject({
      claimId: "bio",
      pubkey: PUBKEY_B,
      verificationMethods: ["x_profile_bio_npub"],
    });
  });

  it("rejects a proofless claim after a checked X bio has no Nostr link", async () => {
    vi.stubGlobal("fetch", async () =>
      response({
        data: {
          id: "x-user-1",
          username: "alice",
          description: "No Nostr profile here",
        },
      }),
    );
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({
        scanXProfiles: true,
        xBearerToken: "token",
        checkZaps: false,
      }),
      { profilesRemaining: 1, proofsRemaining: 1 },
    );

    expect(result.results).toEqual([
      {
        claimId: "kind0",
        identityStatus: "rejected",
        rejectionReason: "x_bio_does_not_link_claimed_pubkey",
      },
    ]);
  });

  it("verifies proof tweets without storing the source event", async () => {
    vi.stubGlobal("fetch", async () =>
      response({
        text: `My Nostr profile is ${NPUB_A}`,
        user: { screen_name: "alice", id_str: "x-user-1" },
      }),
    );
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1, profilesRemaining: 0 },
    );

    expect(result.results[0]).toMatchObject({
      claimId: "proof",
      identityStatus: "verified",
      verificationMethod: "nip39_proof_tweet",
    });
  });

  it("checks NIP-57 support after identity verification", async () => {
    expect(lightningAddressToLnurlp("alice@example.com")).toBe(
      "https://example.com/.well-known/lnurlp/alice",
    );
    const result = await checkZapSupport(
      { identityStatus: "verified" },
      { lud16: "alice@example.com" },
      1000,
      async () => response({ allowsNostr: true, nostrPubkey: PUBKEY_A }),
    );
    expect(result).toMatchObject({
      identityStatus: "verified",
      zappable: true,
      zapReason: "nip57-ready",
    });
  });
});

describe("projection execution", () => {
  it("writes only the handle and active directory entry, with stats in logs", async () => {
    vi.stubGlobal("fetch", async () =>
      response({
        text: `My Nostr profile is ${NPUB_A}`,
        user: { screen_name: "alice", id_str: "x-user-1" },
      }),
    );
    const writes = [];
    const handle = {
      handle: "alice",
      claims: [pendingClaim("proof", PUBKEY_A, 100)],
      pendingClaimCount: 1,
      projectionStatus: "pending",
    };
    class FakeFirestore {
      collection(name) {
        return collectionAdapter(name, handle);
      }
      batch() {
        return {
          set: (ref, data) =>
            writes.push({ collection: ref.collection, id: ref.id, data }),
          commit: async () => {},
        };
      }
    }

    const output = await runProjection(
      projectionArgs({
        firestoreProject: "gr-prod",
        firestoreHandlesCollection: "handles",
        firestoreEntriesCollection: "entries",
        checkZaps: false,
      }),
      FakeFirestore,
      { db: new FakeFirestore() },
    );

    expect(output.stats).toMatchObject({
      verified: 1,
      handlesChanged: 1,
      firestoreWrites: 2,
    });
    expect(writes.map((write) => write.collection)).toEqual([
      "handles",
      "entries",
    ]);
  });
});

function pendingClaim(
  claimId,
  pubkey,
  sourceCreatedAt,
  proofTweetId = "1234567890123",
) {
  return {
    claimId,
    platform: "twitter",
    handle: "alice",
    pubkey,
    npub: nip19.npubEncode(pubkey),
    proofTweetId,
    status: "pending",
    sourceCreatedAt,
  };
}

function verifiedClaim(claimId, pubkey, sourceCreatedAt) {
  return {
    ...pendingClaim(claimId, pubkey, sourceCreatedAt),
    status: "verified",
    verificationMethods: ["nip39_proof_tweet"],
  };
}

function verifiedResult(claimId) {
  return {
    claimId,
    identityStatus: "verified",
    verificationMethod: "nip39_proof_tweet",
    verifiedAt: NOW.toISOString(),
  };
}

function projectionArgs(overrides = {}) {
  return {
    firestoreProject: "gr-prod",
    firestoreDatabase: "(default)",
    firestoreHandlesCollection: "handles",
    firestoreEntriesCollection: "entries",
    timeoutMs: 1000,
    maxProofs: 10,
    verifyTweets: true,
    checkZaps: false,
    projectionLimit: 100,
    projectionWriteBudget: 10000,
    projectionExternalRetryMs: 60000,
    maxPendingClaims: 20,
    maxInactiveVerifiedClaims: 10,
    maxRejectionTombstones: 100,
    scanXProfiles: false,
    xProfileMax: 10,
    xBearerToken: null,
    out: null,
    ...overrides,
  };
}

function response(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => json,
  };
}

function collectionAdapter(name, handle) {
  const adapter = {
    where: () => adapter,
    limit: () => adapter,
    get: async () => ({
      docs:
        name === "handles" ? [{ id: "twitter:alice", data: () => handle }] : [],
    }),
    doc: (id) => ({ collection: name, id }),
  };
  return adapter;
}
