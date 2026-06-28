// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey, nip19 } from "nostr-tools";
import {
  buildDirectoryOutputFromEvents,
  buildFirestoreWrites,
  buildProjectionProcessingWrites,
  buildProjectionQueueClaimData,
  buildProjectionQueueFailureWrites,
  buildProjectionQueueWrites,
  buildProjectionRawFailureWrites,
  firestoreRawDocToNostrEvent,
  lightningAddressToLnurlp,
  parseProjectionArgs,
  projectionStatusForRawEvent,
  queueDocIsClaimable,
  queueStatusForProjection,
} from "./projection.mjs";

const SECRET_KEY = new Uint8Array(32).fill(1);
const PUBKEY = getPublicKey(SECRET_KEY);
const NPUB = nip19.npubEncode(PUBKEY);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseProjectionArgs", () => {
  it("keeps X bio scanning opt-in", () => {
    expect(
      parseProjectionArgs(["--firestore-project", "gr-prod"]),
    ).toMatchObject({
      scanXProfiles: false,
      projectionSource: "queue",
    });
    expect(
      parseProjectionArgs([
        "--firestore-project",
        "gr-prod",
        "--scan-x-profiles",
        "--x-handles",
        "alice,bob",
      ]),
    ).toMatchObject({
      scanXProfiles: true,
      xHandles: ["alice", "bob"],
    });
  });
});

describe("projection input and queue helpers", () => {
  it("rebuilds exact Nostr events from eventJson", () => {
    const event = {
      id: "evt-json",
      kind: 10011,
      pubkey: PUBKEY,
      created_at: 1710000000,
      content: "",
      tags: [["i", "twitter:alice", "proof"]],
      sig: "sig",
    };
    expect(
      firestoreRawDocToNostrEvent({ eventJson: JSON.stringify(event) }),
    ).toEqual(event);
  });

  it("rebuilds Firestore-safe tag objects", () => {
    expect(
      firestoreRawDocToNostrEvent({
        event: {
          id: "evt-safe",
          tags: [{ values: ["i", "twitter:alice", "proof"] }],
        },
      }),
    ).toMatchObject({
      id: "evt-safe",
      tags: [["i", "twitter:alice", "proof"]],
    });
  });

  it("claims only due or expired queue docs", () => {
    const now = Date.parse("2026-06-19T12:00:00.000Z");
    expect(queueDocIsClaimable({ status: "pending" }, now)).toBe(true);
    expect(
      queueDocIsClaimable(
        {
          status: "retry_later",
          nextAttemptAt: new Date("2026-06-19T12:00:01.000Z"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      queueDocIsClaimable(
        {
          status: "processing",
          lockExpiresAt: new Date("2026-06-19T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(queueDocIsClaimable({ status: "done" }, now)).toBe(false);
  });

  it("builds queue claim writes", () => {
    const lockExpiresAt = new Date("2026-06-19T12:10:00.000Z");
    expect(
      buildProjectionQueueClaimData("worker-a", lockExpiresAt),
    ).toMatchObject({
      status: "processing",
      lockedBy: "worker-a",
      lockExpiresAt,
    });
  });
});

describe("projection status writes", () => {
  it("classifies raw events", () => {
    expect(
      projectionStatusForRawEvent(
        "verified",
        new Set(["verified"]),
        new Set(["verified"]),
        new Map(),
      ),
    ).toEqual({
      processingStatus: "processed",
      identityStatus: "verified",
      reason: "verified_identity_proof",
    });
    expect(
      projectionStatusForRawEvent(
        "retry",
        new Set(),
        new Set(),
        new Map(),
        new Map([["retry", "timeout"]]),
      ),
    ).toEqual({
      processingStatus: "retry_later",
      identityStatus: "unknown",
      reason: "timeout",
    });
  });

  it("maps terminal queue statuses", () => {
    expect(queueStatusForProjection({ processingStatus: "processed" })).toBe(
      "done",
    );
    expect(queueStatusForProjection({ processingStatus: "ignored" })).toBe(
      "ignored",
    );
    expect(queueStatusForProjection({ processingStatus: "retry_later" })).toBe(
      "retry_later",
    );
  });

  it("builds raw processing and queue completion writes", () => {
    const rawDocs = [
      { id: "verified-doc", data: { id: "verified-event" } },
      { id: "ignored-doc", data: { id: "ignored-event" } },
    ];
    const output = {
      generatedAt: "2026-06-18T00:00:00.000Z",
      strategy: {},
      directory: [
        {
          sourceEventId: "verified-event",
          identityStatus: "verified",
        },
      ],
      rejected: [],
      retryLater: [],
    };

    expect(
      buildProjectionProcessingWrites(rawDocs, output, {
        firestoreEventsCollection: "events",
      }),
    ).toMatchObject([
      {
        collection: "events",
        id: "verified-doc",
        data: {
          identity: {
            status: "verified",
            reason: "verified_identity_proof",
          },
        },
      },
      {
        id: "ignored-doc",
        data: {
          identity: {
            status: "none",
            reason: "no_identity_signal",
          },
        },
      },
    ]);

    expect(
      buildProjectionQueueWrites(rawDocs, output, {
        firestoreQueueCollection: "queue",
      }),
    ).toMatchObject([
      {
        collection: "queue",
        id: "verified-event",
        data: {
          status: "done",
          reason: "verified_identity_proof",
        },
      },
      {
        id: "ignored-event",
        data: {
          status: "ignored",
          reason: "no_identity_signal",
        },
      },
    ]);
  });

  it("keeps transient proof failures retryable", () => {
    const writes = buildProjectionQueueWrites(
      [{ id: "retry-doc", data: { id: "retry-event" } }],
      {
        strategy: {},
        directory: [],
        rejected: [],
        retryLater: [{ sourceEventId: "retry-event", retryReason: "timeout" }],
      },
      {
        firestoreQueueCollection: "queue",
        projectionExternalRetryMs: 60000,
      },
    );
    expect(writes[0]).toMatchObject({
      id: "retry-event",
      data: {
        status: "retry_later",
        reason: "timeout",
      },
    });
    expect(writes[0].data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("marks missing and corrupt docs as failed", () => {
    expect(
      buildProjectionQueueFailureWrites(
        [{ id: "queue-doc", eventId: "missing-event", data: {} }],
        "missing_raw_event",
        { firestoreQueueCollection: "queue" },
      ),
    ).toMatchObject([
      {
        collection: "queue",
        id: "missing-event",
        data: {
          status: "failed",
          reason: "missing_raw_event",
        },
      },
    ]);
    expect(
      buildProjectionRawFailureWrites(
        [{ id: "raw-doc", data: { id: "bad-event" } }],
        { firestoreEventsCollection: "events" },
      ),
    ).toMatchObject([
      {
        collection: "events",
        id: "raw-doc",
        data: {
          identity: {
            status: "unknown",
            reason: "invalid_raw_event",
          },
        },
      },
    ]);
  });
});

describe("directory projection", () => {
  it("converts lud16 addresses to LNURL-pay endpoints", () => {
    expect(lightningAddressToLnurlp("alice@example.com")).toBe(
      "https://example.com/.well-known/lnurlp/alice",
    );
  });

  it("writes directory entries and handle summaries", () => {
    const writes = buildFirestoreWrites(
      {
        generatedAt: "2026-06-18T00:00:00.000Z",
        directory: [
          {
            platform: "twitter",
            handle: "alice",
            pubkey: PUBKEY,
            npub: NPUB,
            identityStatus: "verified",
            directoryStatus: "verified_not_zappable",
            verificationMethods: ["x_profile_bio_npub"],
            zappable: false,
            autoZapAllowed: false,
          },
        ],
      },
      {
        firestoreEntriesCollection: "entries",
        firestoreHandlesCollection: "handles",
      },
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({
      collection: "entries",
      id: `twitter:alice:${PUBKEY}`,
    });
    expect(writes[1]).toMatchObject({
      collection: "handles",
      id: "twitter:alice",
      data: {
        verifiedCount: 1,
        best: {
          pubkey: PUBKEY,
          verificationMethods: ["x_profile_bio_npub"],
        },
      },
    });
  });

  it("upgrades a kind:0 X claim when the X bio contains the same npub", async () => {
    const metadataEvent = finalizeEvent(
      {
        kind: 0,
        created_at: 1710000000,
        content: JSON.stringify({
          name: "Alice",
          twitter: "alice",
        }),
        tags: [],
      },
      SECRET_KEY,
    );
    vi.stubGlobal("fetch", async (url) => {
      expect(String(url)).toContain("/2/users/by/username/alice");
      return {
        ok: true,
        json: async () => ({
          data: {
            id: "x-user-1",
            username: "alice",
            description: `Nostr: ${NPUB}`,
          },
        }),
      };
    });

    const output = await buildDirectoryOutputFromEvents({
      events: [metadataEvent],
      args: {
        maxProofs: 10,
        verifyTweets: false,
        checkZaps: false,
        scanXProfiles: true,
        xHandles: [],
        xBearerToken: "token",
        xProfileMax: 10,
        timeoutMs: 1000,
      },
    });

    expect(output.stats).toMatchObject({
      xProfilesAttempted: 1,
      xBioIdentifiersResolved: 1,
      xBioVerified: 1,
      verified: 1,
      claimedOnly: 0,
    });
    expect(output.directory).toMatchObject([
      {
        handle: "alice",
        pubkey: PUBKEY,
        identityStatus: "verified",
        directoryStatus: "verified_not_zappable",
        sourceEventId: metadataEvent.id,
        verificationMethods: ["x_profile_bio_npub"],
      },
    ]);
  });
});
