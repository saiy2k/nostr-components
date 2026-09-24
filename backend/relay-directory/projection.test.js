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

  it("preserves zero-valued numeric environment overrides", () => {
    expect(
      loadProjectionConfig({
        FIRESTORE_PROJECT: "gr-prod",
        MAX_PENDING_CLAIMS: "0",
        MAX_INACTIVE_VERIFIED_CLAIMS: "0",
        MAX_REJECTION_TOMBSTONES: "0",
      }),
    ).toMatchObject({
      maxPendingClaims: 0,
      maxInactiveVerifiedClaims: 0,
      maxRejectionTombstones: 0,
    });
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

  it("caps hostile far-future retry hints", () => {
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
          retryAfter: String(60 * 60 * 24 * 365),
        },
      ],
      {
        now: NOW,
        retryDelayMs: 60000,
        maxExternalRetryMs: 60 * 60 * 1000,
      },
    );

    expect(transition.state.claims[0].retryAt).toBe(
      new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    );
    expect(transition.state.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + 60 * 60 * 1000),
    );
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

  it("counts empty-result deferrals toward the retry cap", () => {
    const handle = {
      claims: [pendingClaim("waiting", PUBKEY_A, 100, null)],
      pendingClaimCount: 1,
      projectionStatus: "pending",
      nextAttemptAt: NOW,
    };
    const options = {
      now: NOW,
      retryDelayMs: 60000,
      maxRetryAttempts: 2,
      deferReason: "http_500",
      attemptedClaimIds: ["waiting"],
    };
    const first = applyProjectionResults(handle, [], options);

    expect(first.stats).toMatchObject({ retryLater: 1, rejected: 0 });
    expect(first.state).toMatchObject({
      projectionStatus: "retry_later",
      pendingClaimCount: 1,
      nextAttemptAt: new Date("2026-07-03T12:01:00.000Z"),
    });
    expect(first.state.claims[0]).toMatchObject({
      claimId: "waiting",
      status: "pending",
      attemptCount: 1,
      retryReason: "http_500",
      lastAttemptAt: NOW.toISOString(),
      retryAt: "2026-07-03T12:01:00.000Z",
    });

    const exhausted = applyProjectionResults(first.state, [], options);

    expect(exhausted.stats).toMatchObject({ retryLater: 0, rejected: 1 });
    expect(exhausted.state.claims).toEqual([]);
    expect(exhausted.state).toMatchObject({
      pendingClaimCount: 0,
      projectionStatus: "complete",
      nextAttemptAt: null,
    });
    expect(exhausted.state.rejectedClaimTombstones).toEqual([
      expect.objectContaining({
        claimId: "waiting",
        reason: "retry-attempts-exhausted:http_500",
      }),
    ]);
  });

  it("leaves unattempted claims pending without burning retry attempts", () => {
    const transition = applyProjectionResults(
      {
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
        pendingClaimCount: 1,
        projectionStatus: "pending",
        nextAttemptAt: NOW,
      },
      [],
      { now: NOW, retryDelayMs: 60000, attemptedClaimIds: [] },
    );

    expect(transition.stats).toMatchObject({ retryLater: 0, rejected: 0 });
    expect(transition.state).toMatchObject({
      projectionStatus: "retry_later",
      pendingClaimCount: 1,
      nextAttemptAt: new Date("2026-07-03T12:01:00.000Z"),
    });
    expect(transition.state.claims[0]).toMatchObject({
      claimId: "proof",
      status: "pending",
    });
    expect(transition.state.claims[0].attemptCount).toBeUndefined();
    expect(transition.state.rejectedClaimTombstones).toEqual([]);
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
  it("writes only the handle when a verified identity becomes active", () => {
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
      { firestoreHandlesCollection: "handles" },
    );

    expect(writes).toHaveLength(1);
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
    expect(writes[0].data.activeIdentity).toMatchObject({
      claimId: "claim",
      pubkey: PUBKEY_A,
      status: "verified",
    });
  });

  it("replaces the active identity on the handle when a newer pubkey verifies", () => {
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
      { firestoreHandlesCollection: "handles" },
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      collection: "handles",
      id: "twitter:alice",
    });
    expect(writes[0].data.activeIdentity).toMatchObject({
      claimId: "new",
      pubkey: PUBKEY_B,
      status: "verified",
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

  it("clears an invalid active pubkey on the handle", () => {
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
      { firestoreHandlesCollection: "handles" },
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].collection).toBe("handles");
    expect(writes[0].data.activeIdentity).toBeNull();
    expect(transition.state.activeIdentity).toBeNull();
  });
});

describe("external verification", () => {
  it("verifies a kind-0 claim from an npub in the current X bio", async () => {
    let requestedUrl;
    vi.stubGlobal("fetch", async (url) => {
      requestedUrl = String(url);
      return fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: `Nostr: ${NPUB_A}`,
      });
    });
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
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
    expect(requestedUrl).toBe("https://api.fxtwitter.com/2/profile/alice");
  });

  it("treats a current X bio link as newer than an older active claim", async () => {
    const npubB = nip19.npubEncode(PUBKEY_B);
    vi.stubGlobal("fetch", async () =>
      fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: `Current Nostr: ${npubB}`,
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
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
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
      fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: "No Nostr profile here",
      }),
    );
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result.results).toEqual([
      {
        claimId: "kind0",
        identityStatus: "rejected",
        rejectionReason: "x_bio_does_not_link_claimed_pubkey",
      },
    ]);
  });

  it("rejects a proofless claim when the X profile no longer exists", async () => {
    vi.stubGlobal("fetch", async () => fxTwitterProfile(null, 404));
    const handleData = {
      handle: "alice",
      claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      pendingClaimCount: 1,
    };
    const result = await verifyHandleClaims(
      handleData,
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result).toMatchObject({
      xProfilesAttempted: 1,
      xProfilesFailed: 1,
      xProfileFailures: { http_404: 1 },
      deferReason: "http_404",
      results: [
        {
          claimId: "kind0",
          identityStatus: "rejected",
          rejectionReason: "x_profile_not_found",
        },
      ],
    });

    const transition = applyProjectionResults(handleData, result.results, {
      now: NOW,
    });
    expect(transition.state).toMatchObject({
      projectionStatus: "complete",
      pendingClaimCount: 0,
      claims: [],
    });
    expect(transition.state.rejectedClaimTombstones).toEqual([
      expect.objectContaining({
        claimId: "kind0",
        reason: "x_profile_not_found",
      }),
    ]);
  });

  it("lets the proof tweet path settle a claim when the X profile is gone", async () => {
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("/2/profile/")) return fxTwitterProfile(null, 404);
      return fxTwitterTweet({
        text: `My Nostr profile is ${NPUB_A}`,
        author: { id: "x-user-1", screen_name: "alice" },
      });
    });
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result.xProfileFailures).toEqual({ http_404: 1 });
    expect(result.results).toEqual([
      expect.objectContaining({
        claimId: "proof",
        identityStatus: "verified",
        verificationMethod: "nip39_proof_tweet",
      }),
    ]);
  });

  it("keeps the tweet failure terminal when profile and proof tweet are gone", async () => {
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("/2/profile/")) return fxTwitterProfile(null, 404);
      return fxTwitterTweet(null, 404);
    });
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result.results).toEqual([
      expect.objectContaining({
        claimId: "proof",
        identityStatus: "rejected",
        rejectionReason: "proof-tweet-unavailable",
      }),
    ]);
  });

  it("defers without a claim result when the profile fetch is retryable", async () => {
    vi.stubGlobal("fetch", async () => fxTwitterProfile(null, 500));
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result).toMatchObject({
      results: [],
      xProfilesFailed: 1,
      xProfileFailures: { http_500: 1 },
      deferReason: "http_500",
      stopRun: false,
      stoppedReason: null,
      attemptedClaimIds: ["kind0"],
    });
  });

  it("stops the run without rejecting claims when FxTwitter rate-limits", async () => {
    vi.stubGlobal("fetch", async () => fxTwitterProfile(null, 429));
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result).toMatchObject({
      results: [],
      stopRun: true,
      stoppedReason: "x_rate_limited",
      deferReason: "x_rate_limited",
      attemptedClaimIds: ["kind0"],
    });
  });

  it("does not burn retry attempts for proof tweets skipped by the budget", async () => {
    vi.stubGlobal("fetch", async () =>
      fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: "No Nostr profile here",
      }),
    );
    const handleData = {
      handle: "alice",
      claims: [pendingClaim("proof", PUBKEY_A, 100)],
      pendingClaimCount: 1,
    };
    const result = await verifyHandleClaims(
      handleData,
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 0 },
    );

    expect(result).toMatchObject({
      results: [],
      proofTweetsAttempted: 0,
      deferReason: "proof_budget_exhausted",
      attemptedClaimIds: [],
    });

    const transition = applyProjectionResults(handleData, result.results, {
      now: NOW,
      deferReason: result.deferReason,
      attemptedClaimIds: result.attemptedClaimIds,
    });
    expect(transition.stats).toMatchObject({ retryLater: 0, rejected: 0 });
    expect(transition.state).toMatchObject({
      projectionStatus: "retry_later",
      pendingClaimCount: 1,
    });
    expect(transition.state.claims[0].attemptCount).toBeUndefined();
  });

  it("keeps an unchecked proof tweet pending when the X profile is gone", async () => {
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("/2/profile/")) return fxTwitterProfile(null, 404);
      return fxTwitterTweet(null, 404);
    });
    const handleData = {
      handle: "alice",
      claims: [pendingClaim("proof", PUBKEY_A, 100)],
      pendingClaimCount: 1,
    };
    const result = await verifyHandleClaims(
      handleData,
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 0 },
    );

    expect(result).toMatchObject({
      results: [],
      proofTweetsAttempted: 0,
      deferReason: "http_404",
      attemptedClaimIds: [],
    });

    const transition = applyProjectionResults(handleData, result.results, {
      now: NOW,
      deferReason: result.deferReason,
      attemptedClaimIds: result.attemptedClaimIds,
    });
    expect(transition.stats).toMatchObject({ retryLater: 0, rejected: 0 });
    expect(transition.state).toMatchObject({
      projectionStatus: "retry_later",
      pendingClaimCount: 1,
    });
    expect(transition.state.rejectedClaimTombstones).toEqual([]);
  });

  it("normalizes a stored handle before matching checked X profiles", async () => {
    vi.stubGlobal("fetch", async () =>
      fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: "No Nostr profile here",
      }),
    );
    const result = await verifyHandleClaims(
      {
        handle: "Alice",
        claims: [pendingClaim("kind0", PUBKEY_A, 100, null)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result.results[0]).toMatchObject({
      claimId: "kind0",
      identityStatus: "rejected",
    });
  });

  it("creates a fresh bio claim instead of reusing a rejected claim", async () => {
    vi.stubGlobal("fetch", async () =>
      fxTwitterProfile({
        id: "x-user-1",
        screen_name: "alice",
        description: `Nostr: ${NPUB_A}`,
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
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
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
    const fetchImpl = vi.fn(async (url) =>
      fxTwitterFetch(url, {
        tweetText: `My Nostr profile is ${NPUB_A}`,
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    const result = await verifyHandleClaims(
      {
        handle: "alice",
        claims: [pendingClaim("proof", PUBKEY_A, 100)],
      },
      projectionArgs({ checkZaps: false }),
      { proofsRemaining: 1 },
    );

    expect(result.results[0]).toMatchObject({
      claimId: "proof",
      identityStatus: "verified",
      verificationMethod: "nip39_proof_tweet",
      proofSource: "fxtwitter-tweet",
      zapReason: "zap-check-skipped",
    });
    expect(fetchImpl).toHaveBeenCalled();
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
    expect(writes).toHaveLength(1);
    expect(writes[0].data.activeIdentity).toMatchObject({
      claimId: "proof",
      zapReason: "zap-check-skipped",
      status: "verified",
    });
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
    expect(writes).toHaveLength(1);
    expect(writes[0].data.activeIdentity).toMatchObject({
      zapCheckTransient: true,
      zapCheckedAt: expect.any(String),
    });
  });
});

describe("projection execution", () => {
  it("writes the handle and a run summary", async () => {
    vi.stubGlobal("fetch", async (url) =>
      fxTwitterFetch(url, {
        profileDescription: "No Nostr profile here",
        tweetText: `My Nostr profile is ${NPUB_A}`,
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
      async runTransaction(fn) {
        const tx = {
          get: (ref) => ref.get(),
          set: (ref, data, options) =>
            writes.push({
              collection: ref.collection,
              id: ref.id,
              data,
              options,
            }),
        };
        return fn(tx);
      }
    }

    const output = await runProjection(
      projectionArgs({
        firestoreProject: "gr-prod",
        firestoreHandlesCollection: "handles",
        checkZaps: false,
      }),
      FakeFirestore,
      { db: new FakeFirestore() },
    );

    expect(output.stats).toMatchObject({
      verified: 1,
      handlesChanged: 1,
      firestoreWrites: 1,
    });
    expect(writes.map((write) => write.collection)).toEqual([
      "handles",
      "relayProjectionRuns",
    ]);
    expect(writes[1].data).toMatchObject({
      mode: "projection",
      source: "directory-handle-claims",
      runId: expect.stringMatching(/^projection-/),
      stats: expect.objectContaining({ verified: 1, handlesChanged: 1 }),
    });
    expect(queryCalls).toContainEqual(["orderBy", "nextAttemptAt"]);
    expect(writes[0].options).toEqual({ merge: true });
  });

  it("persists the run summary to the configured collection", async () => {
    vi.stubGlobal("fetch", async (url) =>
      fxTwitterFetch(url, {
        profileDescription: "No Nostr profile here",
        tweetText: `My Nostr profile is ${NPUB_A}`,
      }),
    );
    const writes = [];
    const db = fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)], writes);

    const output = await runProjection(
      projectionArgs({ firestoreProjectionRunsCollection: "customRuns" }),
      null,
      { db },
    );

    const summary = writes.find((write) => write.collection === "customRuns");
    expect(summary).toBeDefined();
    expect(summary.id).toBe(output.run.runId);
    expect(summary.data).toMatchObject({
      module: "projection",
      mode: "projection",
      durationMs: expect.any(Number),
      stats: expect.objectContaining({ handleDocsRead: 1 }),
      firestore: expect.objectContaining({ project: "gr-prod" }),
    });
  });

  it("still succeeds when the run summary write fails", async () => {
    vi.stubGlobal("fetch", async (url) =>
      fxTwitterFetch(url, {
        profileDescription: "No Nostr profile here",
        tweetText: `My Nostr profile is ${NPUB_A}`,
      }),
    );
    const writes = [];
    const db = fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)], writes);
    const baseBatch = db.batch.bind(db);
    db.batch = () => {
      const batch = baseBatch();
      const commit = batch.commit;
      batch.commit = async () => {
        if (batch.pendingWrites?.some((w) => w.collection === "runs")) {
          throw new Error("firestore unavailable");
        }
        return commit();
      };
      return batch;
    };

    const output = await runProjection(
      projectionArgs({ firestoreProjectionRunsCollection: "runs" }),
      null,
      { db },
    );

    expect(output.stats).toMatchObject({ verified: 1, handlesChanged: 1 });
    expect(writes.map((write) => write.collection)).toEqual(["handles"]);
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

  it("surfaces legacy pending handles missing nextAttemptAt", async () => {
    const legacy = {
      handle: "legacy",
      claims: [pendingClaim("legacy-claim", PUBKEY_A, 100)],
      pendingClaimCount: 1,
      projectionStatus: "pending",
    };
    const verifyClaims = vi.fn(async (handleData) =>
      verificationOutput({
        results: [
          {
            claimId: handleData.claims[0].claimId,
            identityStatus: "rejected",
            rejectionReason: "test",
          },
        ],
      }),
    );

    const output = await runProjection(projectionArgs(), null, {
      db: fakeFirestore([legacy]),
      verifyHandleClaims: verifyClaims,
    });

    expect(output.stats).toMatchObject({
      handleDocsRead: 1,
      handlesDue: 1,
      rejected: 1,
    });
    expect(verifyClaims).toHaveBeenCalledTimes(1);
  });

  it("records pendingHandleCount when the read limit is saturated", async () => {
    const handles = [
      dueHandle("alice", "one", PUBKEY_A),
      dueHandle("bob", "two", PUBKEY_B),
      dueHandle("carol", "three", PUBKEY_A),
    ];
    const writes = [];
    const verifyClaims = vi.fn(async (handleData) =>
      verificationOutput({
        results: [
          {
            claimId: handleData.claims[0].claimId,
            identityStatus: "rejected",
            rejectionReason: "test",
          },
        ],
      }),
    );

    const output = await runProjection(
      projectionArgs({ projectionLimit: 2 }),
      null,
      {
        db: fakeFirestore(handles, writes),
        verifyHandleClaims: verifyClaims,
      },
    );

    expect(output.stats).toMatchObject({
      pendingHandleCount: 3,
      projectionLimitSaturated: true,
      handleDocsRead: 2,
    });
    const summary = writes.find(
      (write) => write.collection === "relayProjectionRuns",
    );
    expect(summary.data.stats).toMatchObject({
      pendingHandleCount: 3,
      projectionLimitSaturated: true,
    });
  });

  it("keeps projection healthy when the pending handle count fails", async () => {
    const db = fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)]);
    const originalCollection = db.collection.bind(db);
    db.collection = (name) => {
      const adapter = originalCollection(name);
      const wrap = (query) => ({
        where: (...args) => wrap(query.where(...args)),
        orderBy: (...args) => wrap(query.orderBy(...args)),
        limit: (...args) => wrap(query.limit(...args)),
        count: () => ({
          get: async () => {
            throw new Error("count unavailable");
          },
        }),
        get: (...args) => query.get(...args),
        doc: (...args) => query.doc(...args),
      });
      return wrap(adapter);
    };
    const verifyClaims = vi.fn(async (handleData) =>
      verificationOutput({
        results: [
          {
            claimId: handleData.claims[0].claimId,
            identityStatus: "rejected",
            rejectionReason: "test",
          },
        ],
      }),
    );

    const output = await runProjection(projectionArgs(), null, {
      db,
      verifyHandleClaims: verifyClaims,
    });

    expect(output.stats).toMatchObject({
      pendingHandleCount: null,
      projectionLimitSaturated: false,
      handlesDue: 1,
      rejected: 1,
    });
  });

  it("counts deferred handles and their reasons in the run summary", async () => {
    const writes = [];
    const verifyClaims = vi.fn(async () =>
      verificationOutput({
        deferReason: "timeout",
        attemptedClaimIds: ["claim"],
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const output = await runProjection(projectionArgs(), null, {
        db: fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)], writes),
        verifyHandleClaims: verifyClaims,
      });

      expect(output.stats).toMatchObject({
        handlesDue: 1,
        handlesDeferred: 1,
        deferReasons: { timeout: 1 },
        retryLater: 1,
        rejected: 0,
      });
      const summary = writes.find(
        (write) => write.collection === "relayProjectionRuns",
      );
      expect(summary.data.stats).toMatchObject({
        handlesDeferred: 1,
        deferReasons: { timeout: 1 },
      });
      expect(
        loggedProjectionEvent(logSpy, "projection_handle_result"),
      ).toMatchObject({ deferredReason: "timeout" });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("counts handles deferred by a claim retry in the run summary", async () => {
    const writes = [];
    const verifyClaims = vi.fn(async (handleData) =>
      verificationOutput({
        results: [
          {
            claimId: handleData.claims[0].claimId,
            identityStatus: "retry_later",
            retryReason: "http_500",
          },
        ],
        attemptedClaimIds: [handleData.claims[0].claimId],
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const output = await runProjection(projectionArgs(), null, {
        db: fakeFirestore([dueHandle("alice", "claim", PUBKEY_A)], writes),
        verifyHandleClaims: verifyClaims,
      });

      expect(output.stats).toMatchObject({
        handlesDue: 1,
        handlesDeferred: 1,
        deferReasons: { http_500: 1 },
        retryLater: 1,
        rejected: 0,
      });
      expect(
        loggedProjectionEvent(logSpy, "projection_handle_result"),
      ).toMatchObject({ deferredReason: "http_500" });
    } finally {
      logSpy.mockRestore();
    }
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

function fxTwitterProfile(user, status = 200) {
  return response(
    {
      code: status,
      message: status === 200 ? "OK" : "error",
      user,
    },
    status >= 400 ? status : 200,
  );
}

function fxTwitterTweet(tweet, status = 200) {
  return response(
    {
      code: status,
      message: status === 200 ? "OK" : "error",
      tweet,
    },
    status >= 400 ? status : 200,
  );
}

function fxTwitterFetch(
  url,
  {
    handle = "alice",
    profileDescription = "No Nostr profile here",
    tweetText,
    userId = "x-user-1",
  } = {},
) {
  if (String(url).includes("/2/profile/")) {
    return fxTwitterProfile({
      id: userId,
      screen_name: handle,
      description: profileDescription,
    });
  }
  return fxTwitterTweet({
    text: tweetText,
    author: { id: userId, screen_name: handle },
  });
}

function collectionAdapter(name, handle, calls = []) {
  const handles = Array.isArray(handle) ? handle : [handle];
  const make = (ordered, maxDocs = Infinity) => ({
    where: (...args) => {
      calls.push(["where", ...args]);
      return make(ordered, maxDocs);
    },
    orderBy: (...args) => {
      calls.push(["orderBy", ...args]);
      return make(true, maxDocs);
    },
    limit: (...args) => {
      calls.push(["limit", ...args]);
      return make(ordered, args[0]);
    },
    count: () => {
      calls.push(["count"]);
      return {
        get: async () => ({
          data: () => ({
            count:
              name === "handles"
                ? handles.filter(
                    (data) => Number(data.pendingClaimCount || 0) > 0,
                  ).length
                : 0,
          }),
        }),
      };
    },
    get: async () => {
      if (name !== "handles") return { docs: [] };
      const docs = handles
        .filter((data) => !ordered || data.nextAttemptAt != null)
        .map((data, index) => ({
          id: `twitter:${data.handle || index}`,
          data: () => data,
        }));
      return {
        docs: Number.isFinite(maxDocs) ? docs.slice(0, maxDocs) : docs,
      };
    },
    doc: (id) => ({
      collection: name,
      id,
      get: async () => {
        const data = handles.find((item) => `twitter:${item.handle}` === id);
        return { exists: Boolean(data), data: () => data || null };
      },
    }),
  });
  return make(false);
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
    deferReason: null,
    attemptedClaimIds: [],
    ...overrides,
  };
}

function loggedProjectionEvent(logSpy, message) {
  return logSpy.mock.calls
    .map((call) => call[0])
    .filter((line) => typeof line === "string")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.message === message);
}

function fakeFirestore(handles, writes = []) {
  return {
    collection: (name) => collectionAdapter(name, handles),
    async runTransaction(fn) {
      const pendingWrites = [];
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, options) =>
          pendingWrites.push({
            collection: ref.collection,
            id: ref.id,
            data,
            options,
          }),
      };
      const result = await fn(tx);
      writes.push(...pendingWrites);
      return result;
    },
    batch: () => {
      const pendingWrites = [];
      return {
        pendingWrites,
        set: (ref, data, options) =>
          pendingWrites.push({
            collection: ref.collection,
            id: ref.id,
            data,
            options,
          }),
        commit: async () => {
          writes.push(...pendingWrites);
        },
      };
    },
  };
}
