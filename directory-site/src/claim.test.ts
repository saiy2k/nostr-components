import { describe, expect, it, vi } from "vitest";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";
import {
  claimProofComposerUrl,
  claimProofText,
  connectClaimSigner,
  createClaimEvent,
  normalizeClaimHandle,
  parseClaimRelays,
  publishClaimEvent,
  signClaimEvent,
  validateProofUrl,
} from "./claim";

describe("claim input validation", () => {
  it("normalizes X handles and rejects non-handle input", () => {
    expect(normalizeClaimHandle(" @Alice_1 ")).toBe("alice_1");
    expect(normalizeClaimHandle("alice/status/123")).toBeNull();
    expect(normalizeClaimHandle("x".repeat(16))).toBeNull();
    expect(normalizeClaimHandle("home")).toBeNull();
  });

  it("accepts only a matching X proof tweet URL", () => {
    expect(
      validateProofUrl(
        "https://twitter.com/Alice/status/1234567890123?s=20",
        "alice",
      ),
    ).toBe("https://x.com/alice/status/1234567890123");
    expect(
      validateProofUrl("https://x.com/bob/status/1234567890123", "alice"),
    ).toBeNull();
    expect(
      validateProofUrl(
        "https://evil.example/alice/status/1234567890123",
        "alice",
      ),
    ).toBeNull();
  });

  it("uses a bounded allowlist of secure configured relays", () => {
    expect(
      parseClaimRelays(
        "wss://one.example,wss://one.example,ws://bad.example,wss://two.example/path",
      ),
    ).toEqual(["wss://one.example/"]);
    expect(() => parseClaimRelays("ws://bad.example")).toThrow("No valid");
  });
});

describe("signed NIP-39 claim", () => {
  it("builds a proof composer URL containing the connected npub", () => {
    const npub = nip19.npubEncode("a".repeat(64));
    expect(claimProofText(npub)).toContain(npub);
    expect(new URL(claimProofComposerUrl(npub)).searchParams.get("text")).toBe(
      claimProofText(npub),
    );
  });

  it("connects, signs, and validates the exact claim event", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue(pubkey),
      signEvent: vi
        .fn()
        .mockImplementation(async (event) => finalizeEvent(event, secret)),
    };
    const connected = await connectClaimSigner(signer);
    expect(connected).toEqual({ pubkey, npub: nip19.npubEncode(pubkey) });

    const unsigned = createClaimEvent(
      "alice",
      "https://x.com/alice/status/1234567890123",
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(unsigned).toEqual({
      kind: 10011,
      created_at: 1790337600,
      content: "",
      tags: [
        ["i", "twitter:alice", "https://x.com/alice/status/1234567890123"],
      ],
    });
    await expect(
      signClaimEvent(signer, pubkey, unsigned),
    ).resolves.toMatchObject({ pubkey, kind: 10011 });
  });

  it("rejects an invalid key from a signer", async () => {
    await expect(
      connectClaimSigner({
        getPublicKey: vi.fn().mockResolvedValue("not-a-pubkey"),
        signEvent: vi.fn(),
      }),
    ).rejects.toThrow("invalid public key");
  });

  it("rejects a signer that changes claim fields", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const unsigned = createClaimEvent(
      "alice",
      "https://x.com/alice/status/1234567890123",
    );
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue(pubkey),
      signEvent: vi
        .fn()
        .mockImplementation(async (event) =>
          finalizeEvent({ ...event, tags: [["i", "twitter:bob"]] }, secret),
        ),
    };
    await expect(signClaimEvent(signer, pubkey, unsigned)).rejects.toThrow(
      "invalid claim event",
    );
  });

  it("succeeds after one relay acknowledges and always closes the pool", async () => {
    const event = finalizeEvent(
      createClaimEvent("alice", "https://x.com/alice/status/1234567890123"),
      generateSecretKey(),
    );
    const pool = {
      publish: vi
        .fn()
        .mockReturnValue([
          Promise.reject(new Error("rejected")),
          Promise.resolve("ok"),
        ]),
      close: vi.fn(),
    };
    const relays = ["wss://one.example/", "wss://two.example/"];
    await expect(
      publishClaimEvent(event, relays, pool),
    ).resolves.toBeUndefined();
    expect(pool.close).toHaveBeenCalledWith(relays);
  });

  it("reports when every relay rejects and still closes the pool", async () => {
    const event = finalizeEvent(
      createClaimEvent("alice", "https://x.com/alice/status/1234567890123"),
      generateSecretKey(),
    );
    const pool = {
      publish: vi.fn().mockReturnValue([Promise.reject(new Error("rejected"))]),
      close: vi.fn(),
    };
    const relays = ["wss://one.example/"];
    await expect(publishClaimEvent(event, relays, pool)).rejects.toThrow(
      "No claim relay acknowledged",
    );
    expect(pool.close).toHaveBeenCalledWith(relays);
  });
});
