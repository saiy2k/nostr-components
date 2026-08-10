// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import {
  discoverXBioIdentities,
  extractNostrIdentifiers,
  resolveNostrIdentifier,
  verifyTweetCandidate,
} from "./x-identity.js";
import { extractTweetId, normalizeTwitterHandle } from "./utils.js";

const PUBKEY =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";
const NPUB = "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg";

describe("X handle normalization", () => {
  it("normalizes handles and profile URLs", () => {
    expect(normalizeTwitterHandle("@Jack")).toBe("jack");
    expect(normalizeTwitterHandle("https://x.com/Bebop2077_")).toBe(
      "bebop2077_",
    );
    expect(normalizeTwitterHandle("https://x.com/i/communities/1")).toBeNull();
  });

  it("extracts tweet ids", () => {
    expect(
      extractTweetId("https://x.com/alice/status/2064733905014440088?s=20"),
    ).toBe("2064733905014440088");
    expect(extractTweetId("AldenCo18783")).toBeNull();
  });
});

describe("proof tweet verification", () => {
  it("rejects a claim with no npub before making a network request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      verifyTweetCandidate(
        {
          handle: "alice",
          proofTweetId: "2064733905014440088",
        },
        1000,
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      identityStatus: "rejected",
      rejectionReason: "claim-missing-npub",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an invalid persisted proof tweet id before fetching", async () => {
    const fetchImpl = vi.fn();
    await expect(
      verifyTweetCandidate(
        {
          handle: "alice",
          npub: NPUB,
          proofTweetId: "not-a-tweet-id",
        },
        1000,
        { fetchImpl },
      ),
    ).resolves.toMatchObject({
      identityStatus: "rejected",
      rejectionReason: "invalid-proof-tweet-id",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("threads an explicit bearer token into official X API verification", async () => {
    let requestedOptions;
    const result = await verifyTweetCandidate(
      {
        handle: "alice",
        npub: NPUB,
        proofTweetId: "2064733905014440088",
      },
      1000,
      {
        bearerToken: "token",
        fetchImpl: async (_url, options) => {
          requestedOptions = options;
          return {
            ok: true,
            json: async () => ({
              data: {
                author_id: "x-user-1",
                text: `My Nostr profile is ${NPUB}`,
              },
              includes: {
                users: [{ id: "x-user-1", username: "alice" }],
              },
            }),
          };
        },
      },
    );

    expect(result.identityStatus).toBe("verified");
    expect(requestedOptions.headers.Authorization).toBe("Bearer token");
  });
});

describe("Nostr identifiers in X profile bios", () => {
  it("extracts npub, nprofile, and NIP-05 values", () => {
    const nprofile = nip19.nprofileEncode({
      pubkey: PUBKEY,
      relays: ["wss://relay.example"],
    });
    expect(
      extractNostrIdentifiers(
        `nostr:${NPUB} backup ${nprofile} and alice@example.com`,
      ),
    ).toEqual([
      { type: "npub", value: NPUB },
      { type: "nprofile", value: nprofile },
      { type: "nip05", value: "alice@example.com" },
    ]);
  });

  it("resolves npub and nprofile to hex pubkeys", async () => {
    const nprofile = nip19.nprofileEncode({ pubkey: PUBKEY, relays: [] });

    await expect(
      resolveNostrIdentifier({ type: "npub", value: NPUB }, 1000),
    ).resolves.toMatchObject({ ok: true, pubkey: PUBKEY });
    await expect(
      resolveNostrIdentifier({ type: "nprofile", value: nprofile }, 1000),
    ).resolves.toMatchObject({ ok: true, pubkey: PUBKEY });
  });

  it("resolves NIP-05 without following redirects", async () => {
    let requestedUrl = null;
    let requestedOptions = null;
    const fetchImpl = async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return {
        ok: true,
        json: async () => ({ names: { alice: PUBKEY } }),
      };
    };

    await expect(
      resolveNostrIdentifier(
        { type: "nip05", value: "alice@example.com" },
        1000,
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      ok: true,
      pubkey: PUBKEY,
      identifierType: "nip05",
    });
    expect(requestedUrl).toBe(
      "https://example.com/.well-known/nostr.json?name=alice",
    );
    expect(requestedOptions.redirect).toBe("error");
  });

  it("normalizes uppercase NIP-05 pubkeys before encoding npub", async () => {
    await expect(
      resolveNostrIdentifier(
        { type: "nip05", value: "alice@example.com" },
        1000,
        async () => ({
          ok: true,
          json: async () => ({ names: { alice: PUBKEY.toUpperCase() } }),
        }),
      ),
    ).resolves.toMatchObject({ pubkey: PUBKEY, npub: NPUB });
  });

  it("rejects non-public NIP-05 hosts before fetching", async () => {
    const fetchImpl = vi.fn();
    await expect(
      resolveNostrIdentifier(
        { type: "nip05", value: "alice@metadata.google.internal" },
        1000,
        fetchImpl,
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid_nip05" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("discovers a verified Nostr pubkey from an FxTwitter profile response", async () => {
    let requestedUrl;
    const fetchImpl = async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: "OK",
          user: {
            id: "x-user-1",
            screen_name: "alice",
            description: `Find me on Nostr: ${NPUB}`,
          },
        }),
      };
    };

    const result = await discoverXBioIdentities({
      handleSeeds: [
        {
          handle: "alice",
          pubkey: PUBKEY,
          sourceEventId: "metadata-event",
          sourceKind: 0,
        },
      ],
      timeoutMs: 1000,
      maxProfiles: 10,
      fetchImpl,
    });

    expect(result).toMatchObject({
      profilesAttempted: 1,
      profilesWithIdentifiers: 1,
      identifiersResolved: 1,
      stoppedReason: null,
    });
    expect(result.records).toMatchObject([
      {
        handle: "alice",
        pubkey: PUBKEY,
        source: "x_profile.bio",
        sourceEventId: "metadata-event",
        identityStatus: "verified",
        verificationMethod: "x_profile_bio_npub",
        proofSource: "fxtwitter-profile",
        xUserId: "x-user-1",
      },
    ]);
    expect(requestedUrl).toBe("https://api.fxtwitter.com/2/profile/alice");
  });

  it("stops profile scanning when FxTwitter rate-limits the request", async () => {
    const result = await discoverXBioIdentities({
      handleSeeds: [{ handle: "alice" }],
      timeoutMs: 1000,
      maxProfiles: 10,
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => null },
      }),
    });

    expect(result).toMatchObject({
      records: [],
      profilesChecked: 0,
      profilesFailed: 0,
      stoppedReason: "x_rate_limited",
    });
  });

  it("reports non-rate-limited profile fetch failures by reason", async () => {
    const result = await discoverXBioIdentities({
      handleSeeds: [{ handle: "alice" }],
      timeoutMs: 1000,
      maxProfiles: 10,
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        headers: { get: () => null },
      }),
    });

    expect(result).toMatchObject({
      records: [],
      profilesAttempted: 1,
      profilesChecked: 0,
      profilesFailed: 1,
      profileFailures: { http_404: 1 },
      stoppedReason: null,
    });
  });

  it("never calls the official X profile API for bio discovery", async () => {
    const requestedUrls = [];
    await discoverXBioIdentities({
      handleSeeds: [{ handle: "alice", pubkey: PUBKEY }],
      timeoutMs: 1000,
      maxProfiles: 10,
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            message: "OK",
            user: {
              id: "x-user-1",
              screen_name: "alice",
              description: `Find me on Nostr: ${NPUB}`,
            },
          }),
        };
      },
    });

    expect(requestedUrls).toEqual([
      "https://api.fxtwitter.com/2/profile/alice",
    ]);
    expect(
      requestedUrls.some((url) => url.includes("api.x.com")),
    ).toBe(false);
  });
});
