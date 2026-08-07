// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import {
  checkZapSupport,
  lightningAddressToLnurlp,
  loadProjectionConfig,
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
  it("reads bounded projection controls from environment variables", () => {
    expect(
      loadProjectionConfig({ FIRESTORE_PROJECT: "gr-prod" }),
    ).toMatchObject({
      firestoreHandlesCollection: "nostrDirectoryHandles",
      firestoreEntriesCollection: "nostrDirectoryEntries",
      projectionLimit: 1000,
      maxPendingClaims: 20,
      maxInactiveVerifiedClaims: 10,
      maxRejectionTombstones: 100,
      maxRetryAttempts: 5,
      runDeadlineMs: 0,
    });
  });

  it("loads and validates a graceful run deadline from the environment", () => {
    expect(
      loadProjectionConfig({
        FIRESTORE_PROJECT: "gr-prod",
        PROJECTION_RUN_DEADLINE_MS: "3300000",
      }),
    ).toMatchObject({ runDeadlineMs: 3300000 });
    expect(() =>
      loadProjectionConfig({
        FIRESTORE_PROJECT: "gr-prod",
        PROJECTION_RUN_DEADLINE_MS: "-1",
      }),
    ).toThrow("PROJECTION_RUN_DEADLINE_MS must be an integer >= 0.");
  });

  it("does not allow the required X profile scan budget to be disabled", () => {
    expect(() =>
      loadProjectionConfig({
        FIRESTORE_PROJECT: "gr-prod",
        X_PROFILE_MAX: "0",
      }),
    ).toThrow("X_PROFILE_MAX must be a positive integer.");
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

  it("honors retry hints and rejects claims after the retry cap", () => {
    const first = applyProjectionResults(
      {
        claims: [pendingClaim("retry", PUBKEY_A, 100)],
        pendingClaimCount: 1,
      },
      [
        {
          claimId: "retry",
          identityStatus: "retry_later",
          retryReason: "rate_limited",
          retryAfter: "120",
          rateLimitResetAt: String(NOW.getTime() / 1000 + 180),
        },
      ],
      { now: NOW, retryDelayMs: 60000, maxRetryAttempts: 2 },
    );

    expect(first.state.claims[0]).toMatchObject({
      attemptCount: 1,
      retryAt: "2026-07-03T12:03:00.000Z",
    });

    const exhausted = applyProjectionResults(
      first.state,
      [
        {
          claimId: "retry",
          identityStatus: "retry_later",
          retryReason: "rate_limited",
        },
      ],
      { now: NOW, retryDelayMs: 60000, maxRetryAttempts: 2 },
    );

    expect(exhausted.state.claims).toEqual([]);
    expect(exhausted.state.rejectedClaimTombstones).toEqual([
      expect.objectContaining({
        claimId: "retry",
        reason: "retry-attempts-exhausted:rate_limited",
      }),
    ]);
  });

  it("backs off a due handle when verification produces no results", () => {
    const transition = applyProjectionResults(
      {
        claims: [pendingClaim("waiting", PUBKEY_A, 100, null)],
        pendingClaimCount: 1,
        projectionStatus: "pending",
        nextAttemptAt: NOW,
      },
      [],
      { now: NOW, retryDelayMs: 60000 },
    );

    expect(transition.changed).toBe(true);
    expect(transition.state).toMatchObject({
      projectionStatus: "retry_later",
      nextAttemptAt: new Date("2026-07-03T12:01:00.000Z"),
    });
  });

  it("does not resurrect an active identity after its claim is rejected", () => {
    const active = verifiedClaim("active", PUBKEY_A, 100);
    const transition = applyProjectionResults(
      {
        activeIdentity: active,
        claims: [active],
        pendingClaimCount: 0,
      },
      [{ claimId: "active", identityStatus: "rejected" }],
      { now: NOW },
    );

    expect(transition.state.activeIdentity).toBeNull();
    expect(transition.state.claims).toEqual([]);
    expect(transition.activeChanged).toBe(true);
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

  it("reports pending claims dropped by the retention limit", () => {
    const transition = applyProjectionResults(
      {
        claims: [
          pendingClaim("new", PUBKEY_A, 200),
          pendingClaim("old", PUBKEY_B, 100),
        ],
        pendingClaimCount: 2,
      },
      [],
      { now: NOW, maxPendingClaims: 1 },
    );

    expect(transition.state.claims.map((claim) => claim.claimId)).toEqual([
      "new",
    ]);
    expect(transition.stats.pendingDropped).toBe(1);
  });

  it("ignores object key insertion order when detecting state changes", () => {
    const activeIdentity = {
      claimId: "active",
      pubkey: PUBKEY_A,
      status: "verified",
      sourceCreatedAt: 100,
    };
    const claimWithDifferentKeyOrder = {
      status: "verified",
      sourceCreatedAt: 100,
      pubkey: PUBKEY_A,
      claimId: "active",
    };
    const transition = applyProjectionResults(
      {
        activeIdentity,
        claims: [claimWithDifferentKeyOrder],
        rejectedClaimTombstones: [],
        pendingClaimCount: 0,
        projectionStatus: "complete",
        nextAttemptAt: null,
      },
      [],
      { now: NOW },
    );

    expect(transition.changed).toBe(false);
    expect(transition.activeChanged).toBe(false);
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
    expect(Object.keys(writes[0].data).sort()).toEqual([
      "activeIdentity",
      "claims",
      "nextAttemptAt",
      "pendingClaimCount",
      "projectedAt",
      "projectionStatus",
      "rejectedClaimTombstones",
      "updatedAt",
    ]);
    expect(writes[0].data.handle).toBeUndefined();
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

  it("marks the previous directory entry obsolete when a new pubkey becomes active", () => {
    const previous = verifiedClaim("old", PUBKEY_A, 100);
    const data = {
      handle: "alice",
      activeIdentity: previous,
      claims: [previous, pendingClaim("new", PUBKEY_B, 200)],
      pendingClaimCount: 1,
    };
    const transition = applyProjectionResults(data, [verifiedResult("new")], {
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

    expect(writes).toHaveLength(3);
    expect(writes[1]).toMatchObject({
      collection: "entries",
      id: directoryEntryId("alice", PUBKEY_A),
      data: {
        identityStatus: "obsolete",
        directoryStatus: "obsolete",
        autoZapAllowed: false,
        supersededByEntryId: directoryEntryId("alice", PUBKEY_B),
      },
    });
    expect(writes[2]).toMatchObject({
      collection: "entries",
      id: directoryEntryId("alice", PUBKEY_B),
      data: {
        identityStatus: "verified",
        pubkey: PUBKEY_B,
        obsoleteAt: null,
        supersededByEntryId: null,
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

  it("does not build a directory entry for an invalid active pubkey", () => {
    const data = {
      handle: "alice",
      activeIdentity: { claimId: "invalid", pubkey: "not-a-pubkey" },
      claims: [],
      pendingClaimCount: 0,
    };
    const transition = applyProjectionResults(data, [], { now: NOW });
    const writes = buildHandleProjectionWrites(
      { id: "twitter:alice", data },
      transition,
      {
        firestoreHandlesCollection: "handles",
        firestoreEntriesCollection: "entries",
      },
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].collection).toBe("handles");
    expect(transition.state.activeIdentity).toBeNull();
  });
});

describe("external verification", () => {
  it("verifies a kind-0 claim from an npub in the current X bio", async () => {
    let requestedUrl;
    vi.stubGlobal("fetch", async (url) => {
      requestedUrl = String(url);
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
    expect(requestedUrl).toContain("/2/users/by/username/alice");
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

  it("normalizes a stored handle before matching checked X profiles", async () => {
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
        handle: "Alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({
        xBearerToken: "token",
        checkZaps: false,
      }),
      { profilesRemaining: 1, proofsRemaining: 1 },
    );

    expect(result.results[0]).toMatchObject({
      claimId: "kind0",
      identityStatus: "rejected",
    });
  });

  it("creates a fresh bio claim instead of reusing a rejected claim", async () => {
    vi.stubGlobal("fetch", async () =>
      response({
        data: {
          id: "x-user-1",
          username: "alice",
          description: `Nostr: ${NPUB_A}`,
        },
      }),
    );
    const rejected = {
      ...pendingClaim("rejected", PUBKEY_A, 100, null),
      status: "rejected",
    };
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [rejected, pendingClaim("other", PUBKEY_B, 200, null)],
      },
      projectionArgs({
        xBearerToken: "token",
        checkZaps: false,
      }),
      { profilesRemaining: 1, proofsRemaining: 1 },
    );

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimId: `x-bio:alice:${PUBKEY_A}`,
          identityStatus: "verified",
          claim: expect.objectContaining({ pubkey: PUBKEY_A }),
        }),
      ]),
    );
  });

  it("verifies proof tweets without storing the source event", async () => {
    vi.stubEnv("X_BEARER_TOKEN", undefined);
    vi.stubEnv("TWITTER_BEARER_TOKEN", undefined);
    const fetchImpl = vi.fn(async () =>
      response({
        text: `My Nostr profile is ${NPUB_A}`,
        user: { screen_name: "alice", id_str: "x-user-1" },
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);
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
      zapReason: "zap-check-skipped",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const transition = applyProjectionResults(
      {
        handle: "alice",
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
        pendingClaimCount: 1,
      },
      result.results,
      { now: NOW },
    );
    const writes = buildHandleProjectionWrites(
      { id: "twitter:alice", data: { handle: "alice" } },
      transition,
    );
    expect(writes[1].data.directoryStatus).toBe("verified_zap_unknown");
  });

  it("checks NIP-57 support after identity verification", async () => {
    expect(lightningAddressToLnurlp("alice@example.com")).toBe(
      "https://example.com/.well-known/lnurlp/alice",
    );
    let requestOptions;
    const result = await checkZapSupport(
      { identityStatus: "verified" },
      { lud16: "alice@example.com" },
      1000,
      async (_url, options) => {
        requestOptions = options;
        return response({ allowsNostr: true, nostrPubkey: PUBKEY_A });
      },
    );
    expect(result).toMatchObject({
      identityStatus: "verified",
      zappable: true,
      zapReason: "nip57-ready",
      zapCheckTransient: false,
    });
    expect(requestOptions.redirect).toBe("error");
  });

  it("rejects private or path-injecting lightning addresses", () => {
    expect(lightningAddressToLnurlp("alice@127.0.0.1")).toBeNull();
    expect(lightningAddressToLnurlp("alice@localhost")).toBeNull();
    expect(lightningAddressToLnurlp("alice@metadata.google.internal")).toBeNull();
    expect(lightningAddressToLnurlp("../admin@example.com")).toBeNull();
    expect(lightningAddressToLnurlp("..@example.com")).toBeNull();
  });

  it("records transient LNURL failures distinctly", async () => {
    const result = await checkZapSupport(
      { identityStatus: "verified" },
      { lud16: "alice@example.com" },
      1000,
      async () => {
        throw new Error("network down");
      },
    );

    expect(result).toMatchObject({
      zappable: false,
      zapReason: "lnurl-fetch-failed",
      zapCheckTransient: true,
      zapCheckedAt: expect.any(String),
    });
    const transition = applyProjectionResults(
      {
        handle: "alice",
        claims: [pendingClaim("transient-zap", PUBKEY_A, 100)],
        pendingClaimCount: 1,
      },
      [{ ...result, claimId: "transient-zap" }],
      { now: NOW },
    );
    const writes = buildHandleProjectionWrites(
      { id: "twitter:alice", data: { handle: "alice" } },
      transition,
    );
    expect(transition.state.activeIdentity).toMatchObject({
      zapCheckTransient: true,
      zapCheckedAt: expect.any(String),
    });
    expect(writes[1].data).toMatchObject({
      zapCheckTransient: true,
      zapCheckedAt: expect.any(String),
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
    const queryCalls = [];
    class FakeFirestore {
      collection(name) {
        return collectionAdapter(name, handle, queryCalls);
      }
      batch() {
        return {
          set: (ref, data, options) =>
            writes.push({
              collection: ref.collection,
              id: ref.id,
              data,
              options,
            }),
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
    expect(queryCalls).toContainEqual(["orderBy", "nextAttemptAt"]);
    expect(writes[0].options).toEqual({ merge: true });
  });

  it("stops iterating when verification requests a run stop", async () => {
    const handles = [
      dueHandle("alice", "first", PUBKEY_A),
      dueHandle("bob", "second", PUBKEY_B),
    ];
    const verifyClaims = vi.fn(async (handleData) =>
      verificationOutput({
        results: [
          {
            claimId: handleData.claims[0].claimId,
            identityStatus: "rejected",
          },
        ],
        stopRun: true,
        stoppedReason: "x_rate_limited",
      }),
    );

    const output = await runProjection(projectionArgs(), null, {
      db: fakeFirestore(handles),
      verifyHandleClaims: verifyClaims,
    });

    expect(output.stats).toMatchObject({
      handlesDue: 1,
      stoppedReason: "x_rate_limited",
    });
    expect(verifyClaims).toHaveBeenCalledTimes(1);
  });

  it("skips handle documents that are not due", async () => {
    const handle = {
      ...dueHandle("alice", "future", PUBKEY_A),
      nextAttemptAt: new Date("2099-01-01T00:00:00.000Z"),
    };
    const verifyClaims = vi.fn();

    const output = await runProjection(projectionArgs(), null, {
      db: fakeFirestore([handle]),
      verifyHandleClaims: verifyClaims,
    });

    expect(output.stats).toMatchObject({ handleDocsRead: 1, handlesDue: 0 });
    expect(verifyClaims).not.toHaveBeenCalled();
  });

  it("stops cleanly when the run deadline is reached", async () => {
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1);
    const verifyClaims = vi.fn();

    const output = await runProjection(
      projectionArgs({ runDeadlineMs: 1 }),
      null,
      {
        db: fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)]),
        verifyHandleClaims: verifyClaims,
        now,
      },
    );

    expect(output.stats.stoppedReason).toBe("run_deadline_reached");
    expect(verifyClaims).not.toHaveBeenCalled();
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
    projectionExternalRetryMs: 60000,
    runDeadlineMs: 0,
    maxPendingClaims: 20,
    maxInactiveVerifiedClaims: 10,
    maxRejectionTombstones: 100,
    maxRetryAttempts: 5,
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

function collectionAdapter(name, handle, calls = []) {
  const handles = Array.isArray(handle) ? handle : [handle];
  const adapter = {
    where: (...args) => {
      calls.push(["where", ...args]);
      return adapter;
    },
    orderBy: (...args) => {
      calls.push(["orderBy", ...args]);
      return adapter;
    },
    limit: (...args) => {
      calls.push(["limit", ...args]);
      return adapter;
    },
    get: async () => ({
      docs:
        name === "handles"
          ? handles.map((data, index) => ({
              id: `twitter:${data.handle || index}`,
              data: () => data,
            }))
          : [],
    }),
    doc: (id) => ({ collection: name, id }),
  };
  return adapter;
}

function dueHandle(handle, claimId, pubkey) {
  return {
    handle,
    claims: [{ ...pendingClaim(claimId, pubkey, 100), handle }],
    pendingClaimCount: 1,
    projectionStatus: "pending",
    nextAttemptAt: NOW,
  };
}

function verificationOutput(overrides = {}) {
  return {
    results: [],
    claimsConsidered: 1,
    proofTweetsAttempted: 0,
    xProfilesAttempted: 0,
    xProfilesFailed: 0,
    xProfileFailures: {},
    xBioIdentifiersResolved: 0,
    stopRun: false,
    stoppedReason: null,
    ...overrides,
  };
}

function fakeFirestore(handles, writes = []) {
  return {
    collection: (name) => collectionAdapter(name, handles),
    batch: () => ({
      set: (ref, data, options) =>
        writes.push({ collection: ref.collection, id: ref.id, data, options }),
      commit: async () => {},
    }),
  };
}
