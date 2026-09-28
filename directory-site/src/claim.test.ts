import { describe, expect, it, vi } from "vitest";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type EventTemplate,
} from "nostr-tools";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import {
  claimProofComposerUrl,
  claimProofText,
  connectClaimSigner,
  crawlerCoveredRelays,
  createClaimEvent,
  IDENTITY_READ_TIMEOUT_MS,
  loadExistingClaimEvent,
  parseGithubProfile,
  parseYoutubeChannel,
  normalizeClaimHandle,
  parseClaimRelays,
  publishClaimEvent,
  signClaimEvent,
  validateProofUrl,
} from "./claim";
import {
  CLAIM_COPY,
  claimDialogAfterClose,
  claimProofEndpoint,
  fetchClaimProof,
  submitXClaim,
} from "./claim-flow";

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
    expect(
      validateProofUrl(
        "https://x.com/alice/status/1234567890123/photo/1",
        "alice",
      ),
    ).toBe("https://x.com/alice/status/1234567890123");
    expect(
      validateProofUrl(
        "https://x.com/alice/status/1234567890123/video/2",
        "alice",
      ),
    ).toBe("https://x.com/alice/status/1234567890123");
    expect(
      validateProofUrl("https://x.com/i/web/status/1234567890123", "alice"),
    ).toBeNull();
  });

  it("uses a bounded allowlist of secure configured relays", () => {
    expect(
      parseClaimRelays(
        "wss://one.example,wss://one.example,ws://bad.example,wss://two.example/path",
      ),
    ).toEqual(["wss://one.example/"]);
    expect(() => parseClaimRelays("ws://bad.example")).toThrow("No valid");
    expect(crawlerCoveredRelays(parseClaimRelays())).toEqual([
      "wss://relay.damus.io/",
      "wss://nos.lol/",
      "wss://relay.primal.net/",
    ]);
    expect(
      crawlerCoveredRelays([
        "wss://relay.damus.io/",
        "wss://not-covered.example/",
      ]),
    ).toEqual(["wss://relay.damus.io/"]);
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
        ["client", "Nostr Atlas"],
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

  it("rejects a signer that mutates the claim event in place", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const unsigned = createClaimEvent(
      "alice",
      "https://x.com/alice/status/1234567890123",
    );
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue(pubkey),
      signEvent: vi.fn().mockImplementation(async (event) => {
        event.tags = [
          ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
        ];
        return finalizeEvent(event, secret);
      }),
    };
    await expect(signClaimEvent(signer, pubkey, unsigned)).rejects.toThrow(
      "invalid claim event",
    );
  });

  it("replaces only the claimed X identity and keeps other identities", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    expect(
      createClaimEvent(
        "alice",
        "https://x.com/alice/status/1234567890123",
        now,
        {
          createdAt: now.getTime() / 1000 - 10,
          tags: [
            ["i", "github:alice", "gist"],
            ["i", "twitter:alice", "https://x.com/alice/status/1111111111"],
            ["i", "x:Alice", "old"],
            ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
            ["client", "nostr-atlas"],
          ],
        },
      ),
    ).toEqual({
      kind: 10011,
      created_at: 1790337600,
      content: "",
      tags: [
        ["i", "github:alice", "gist"],
        ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
        ["i", "twitter:alice", "https://x.com/alice/status/1234567890123"],
        ["client", "Nostr Atlas"],
      ],
    });
    expect(() =>
      createClaimEvent(
        "alice",
        "https://x.com/alice/status/1234567890123",
        now,
        {
          createdAt: 1790337600 + 121,
        },
      ),
    ).toThrow("too far in the future");
  });

  it("accepts optional YouTube and GitHub profile links", () => {
    expect(parseYoutubeChannel("")).toEqual({ status: "empty" });
    expect(parseGithubProfile("  ")).toEqual({ status: "empty" });
    expect(parseYoutubeChannel("https://www.youtube.com/@Satoshi_1")).toEqual({
      status: "ok",
      link: {
        platform: "youtube",
        name: "satoshi_1",
        url: "https://www.youtube.com/@satoshi_1",
      },
    });
    expect(
      parseGithubProfile("https://github.com/Satoshi/nostr-components"),
    ).toEqual({ status: "invalid" });
    expect(parseYoutubeChannel("https://www.youtube.com/watch?v=abc")).toEqual({
      status: "invalid",
    });
    expect(parseGithubProfile("https://github.com/Satoshi")).toEqual({
      status: "ok",
      link: {
        platform: "github",
        name: "satoshi",
        url: "https://github.com/satoshi",
      },
    });

    const now = new Date("2026-09-25T12:00:00.000Z");
    expect(
      createClaimEvent(
        "alice",
        "https://x.com/alice/status/1234567890123",
        now,
        {
          tags: [
            ["i", "github:old", "https://github.com/old"],
            ["i", "mastodon:alice", "post"],
          ],
        },
        [
          {
            platform: "github",
            name: "alice",
            url: "https://github.com/alice",
          },
          {
            platform: "youtube",
            name: "alice",
            url: "https://www.youtube.com/@alice",
          },
        ],
      ).tags,
    ).toEqual([
      ["i", "mastodon:alice", "post"],
      ["i", "twitter:alice", "https://x.com/alice/status/1234567890123"],
      ["i", "github:alice", "https://github.com/alice"],
      ["i", "youtube:alice", "https://www.youtube.com/@alice"],
      ["client", "Nostr Atlas"],
    ]);
  });

  it("uses a newer timestamp when replacing an existing identity", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    expect(
      createClaimEvent(
        "alice",
        "https://x.com/alice/status/1234567890123",
        now,
        {
          createdAt: 1790337600,
        },
      ).created_at,
    ).toBe(1790337601);
  });

  it("reads the newest verified identity and refuses an unreadable relay response", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const older = finalizeEvent(
      createClaimEvent(
        "alice",
        "https://x.com/alice/status/1234567890123",
        new Date("2026-09-25T12:00:00.000Z"),
      ),
      secret,
    );
    const newer = finalizeEvent(
      {
        ...createClaimEvent(
          "alice",
          "https://x.com/alice/status/1234567890123",
          new Date("2026-09-25T12:00:10.000Z"),
        ),
        tags: [
          ["i", "github:alice", "gist"],
          ["i", "twitter:alice", "https://x.com/alice/status/1234567890123"],
        ],
      },
      secret,
    );
    const relays = ["wss://one.example/"];
    const readable = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onevent(older);
        params.onevent(newer);
        params.onclose(["closed by caller"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(pubkey, relays, readable),
    ).resolves.toMatchObject({ id: newer.id });
    expect(readable.close).toHaveBeenCalledWith(relays);

    const unverified = {
      id: newer.id,
      pubkey: newer.pubkey,
      created_at: newer.created_at,
      kind: newer.kind,
      tags: [["i", "twitter:mallory"]],
      content: newer.content,
      sig: newer.sig,
    };
    const unreadable = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onevent(unverified);
        params.onclose(["closed by caller"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(pubkey, relays, unreadable),
    ).rejects.toThrow("Could not read the existing Nostr identity");

    const unavailable = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onclose(["connection timed out"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(pubkey, relays, unavailable),
    ).rejects.toThrow("Could not read the existing Nostr identity");

    const empty = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onclose(["closed by caller"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(pubkey, relays, empty),
    ).resolves.toBeNull();

    const partial = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onevent(newer);
        params.onclose(["connection timed out", "closed by caller"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(
        pubkey,
        ["wss://one.example/", "wss://two.example/"],
        partial,
      ),
    ).resolves.toMatchObject({ id: newer.id });

    const partialEmpty = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onclose([
          "Received network error or non-101 status code.",
          "closed by caller",
        ]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(
        pubkey,
        ["wss://one.example/", "wss://two.example/"],
        partialEmpty,
      ),
    ).resolves.toBeNull();
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
    await expect(publishClaimEvent(event, relays, pool)).resolves.toBe(
      "wss://two.example/",
    );
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
      "No crawler-covered relay acknowledged",
    );
    expect(pool.close).toHaveBeenCalledWith(relays);
  });

  it("does not treat an uncovered relay acknowledgement as success", async () => {
    const event = finalizeEvent(
      createClaimEvent("alice", "https://x.com/alice/status/1234567890123"),
      generateSecretKey(),
    );
    const relays = ["wss://relay.damus.io/", "wss://not-covered.example/"];
    const pool = {
      publish: vi
        .fn()
        .mockReturnValue([
          Promise.reject(new Error("rejected")),
          Promise.resolve("ok"),
        ]),
      close: vi.fn(),
    };
    await expect(
      publishClaimEvent(event, relays, pool, ["wss://relay.damus.io/"]),
    ).rejects.toThrow("No crawler-covered relay acknowledged");
    expect(pool.close).toHaveBeenCalledWith(relays);
  });

  it("accepts a covered acknowledgement when another relay rejects", async () => {
    const event = finalizeEvent(
      createClaimEvent("alice", PROOF),
      generateSecretKey(),
    );
    const relays = ["wss://not-covered.example/", "wss://relay.damus.io/"];
    const pool = {
      publish: vi
        .fn()
        .mockReturnValue([
          Promise.reject(new Error("rejected")),
          Promise.resolve("ok"),
        ]),
      close: vi.fn(),
    };
    await expect(
      publishClaimEvent(event, relays, pool, ["wss://relay.damus.io/"]),
    ).resolves.toBe("wss://relay.damus.io/");
    expect(pool.close).toHaveBeenCalledWith(relays);
  });

  it("closes the pool when the required relay is missing", async () => {
    const event = finalizeEvent(
      createClaimEvent("alice", PROOF),
      generateSecretKey(),
    );
    const pool = { publish: vi.fn(), close: vi.fn() };
    const relays = ["wss://not-covered.example/"];
    await expect(publishClaimEvent(event, relays, pool, [])).rejects.toThrow(
      "No crawler-covered claim relay is configured",
    );
    await expect(
      publishClaimEvent(event, relays, pool, ["wss://relay.damus.io/"]),
    ).rejects.toThrow("No crawler-covered claim relay is configured");
    expect(pool.publish).not.toHaveBeenCalled();
    expect(pool.close).toHaveBeenCalledTimes(2);
    expect(pool.close).toHaveBeenCalledWith(relays);
  });
});

const PROOF = "https://x.com/alice/status/1234567890123";
const NOW = new Date("2026-09-25T12:00:00.000Z");
const NOW_SECONDS = 1_790_337_600;
const RESERVED_HANDLES = [
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "search",
  "share",
  "settings",
];

function claimSigner(secret = generateSecretKey()) {
  const pubkey = getPublicKey(secret);
  const signer = {
    getPublicKey: vi.fn(async () => pubkey),
    signEvent: vi.fn(async (event: EventTemplate) =>
      finalizeEvent(event, secret),
    ),
  };
  return { secret, pubkey, signer };
}

describe("claim input tables", () => {
  const handleCases: Array<[string, string | null]> = [
    [" @Alice_1 ", "alice_1"],
    ["A", "a"],
    ["a".repeat(15), "a".repeat(15)],
    ["", null],
    ["@", null],
    ["alice bob", null],
    ["alice-bob", null],
    ["älice", null],
    ["a".repeat(16), null],
    ...RESERVED_HANDLES.flatMap(
      (handle): Array<[string, string | null]> => [
        [handle, null],
        [handle.toUpperCase(), null],
      ],
    ),
  ];

  it.each(handleCases)("normalizes handle %j to %j", (input, expected) => {
    expect(normalizeClaimHandle(input)).toBe(expected);
  });

  const proofCases: Array<[string, string | null]> = [
    [
      "https://x.com/alice/status/1234567890",
      "https://x.com/alice/status/1234567890",
    ],
    [
      `https://x.com/alice/status/${"1".repeat(25)}`,
      `https://x.com/alice/status/${"1".repeat(25)}`,
    ],
    [
      "https://www.x.com/Alice/status/1234567890",
      "https://x.com/alice/status/1234567890",
    ],
    [
      "https://twitter.com/@alice/status/1234567890/",
      "https://x.com/alice/status/1234567890",
    ],
    [
      "https://www.twitter.com/alice/status/1234567890?s=20#top",
      "https://x.com/alice/status/1234567890",
    ],
    [
      "https://x.com:443/alice/status/1234567890",
      "https://x.com/alice/status/1234567890",
    ],
    [
      "https://x.com/alice/status/1234567890/photo/1",
      "https://x.com/alice/status/1234567890",
    ],
    [
      "https://x.com/alice/status/1234567890/video/12",
      "https://x.com/alice/status/1234567890",
    ],
    ["http://x.com/alice/status/1234567890123", null],
    ["https://user:pass@x.com/alice/status/1234567890123", null],
    ["https://x.com:444/alice/status/1234567890123", null],
    ["https://x.com/bob/status/1234567890123", null],
    ["https://x.com.evil/alice/status/1234567890123", null],
    ["https://x.com/i/web/status/1234567890123", null],
    [`https://x.com/alice/status/${"1".repeat(9)}`, null],
    [`https://x.com/alice/status/${"1".repeat(26)}`, null],
    ["https://x.com/alice/status/1234567890123/photo/123456", null],
    ["https://mobile.twitter.com/alice/status/1234567890123", null],
    ["not a url", null],
  ];

  it.each(proofCases)("validates proof %j as %j", (input, expected) => {
    expect(validateProofUrl(input, "alice")).toBe(expected);
  });

  it("keeps five canonical secure relay roots and drops the rest", () => {
    expect(
      parseClaimRelays(
        [
          "wss://one.example",
          "wss://ONE.example/",
          "wss://user:pass@two.example",
          "wss://three.example/path",
          "wss://four.example/?q=1",
          "wss://five.example/#hash",
          "ws://six.example",
          "wss://seven.example",
          "wss://eight.example",
          "wss://nine.example",
          "wss://ten.example",
          "wss://eleven.example",
        ].join(","),
      ),
    ).toEqual([
      "wss://one.example/",
      "wss://seven.example/",
      "wss://eight.example/",
      "wss://nine.example/",
      "wss://ten.example/",
    ]);
    expect(() => parseClaimRelays(",")).toThrow("No valid");
    expect(() => parseClaimRelays("   ,  ")).toThrow("No valid");
    expect(parseClaimRelays("")).toEqual([
      "wss://relay.damus.io/",
      "wss://nos.lol/",
      "wss://relay.primal.net/",
    ]);
    expect(crawlerCoveredRelays(["wss://not-in-directory.example/"])).toEqual(
      [],
    );
  });
});

describe("claim event boundaries", () => {
  it("replaces every X prefix for the claimed handle only", () => {
    expect(
      createClaimEvent("alice", PROOF, NOW, {
        tags: [
          ["i", "com.twitter:alice", "old"],
          ["i", "mastodon:alice", "post"],
          ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
        ],
      }).tags,
    ).toEqual([
      ["i", "mastodon:alice", "post"],
      ["i", "twitter:bob", "https://x.com/bob/status/1234567890123"],
      ["i", "twitter:alice", PROOF],
      ["client", "Nostr Atlas"],
    ]);
  });

  it("rejects an identity that cannot be copied safely", () => {
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        tags: [["i", 1 as unknown as string]],
      }),
    ).toThrow("could not be preserved safely");
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        tags: [["i", "github:alice", "x".repeat(2001)]],
      }),
    ).toThrow("could not be preserved safely");
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        tags: [
          ["i", "github:alice", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        ],
      }),
    ).toThrow("could not be preserved safely");
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        tags: Array.from({ length: 21 }, (_, index) => [
          "i",
          `github:user${index}`,
          "https://github.com/user",
        ]),
      }),
    ).toThrow("too many linked accounts");
  });

  it("keeps nineteen other identities and bumps timestamps only when needed", () => {
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        tags: Array.from({ length: 20 }, (_, index) => [
          "i",
          `github:user${index}`,
          "https://github.com/user",
        ]),
      }),
    ).toThrow("too many linked accounts");
    const event = createClaimEvent("alice", PROOF, NOW, {
      tags: Array.from({ length: 19 }, (_, index) => [
        "i",
        `github:user${index}`,
        "https://github.com/user",
      ]),
    });
    expect(event.tags).toHaveLength(21);
    expect(event.tags.at(-2)).toEqual(["i", "twitter:alice", PROOF]);
    expect(event.tags.at(-1)).toEqual(["client", "Nostr Atlas"]);
    expect(
      createClaimEvent("alice", PROOF, NOW, {
        createdAt: NOW_SECONDS - 50,
      }).created_at,
    ).toBe(NOW_SECONDS);
    expect(
      createClaimEvent("alice", PROOF, NOW, {
        createdAt: NOW_SECONDS,
      }).created_at,
    ).toBe(NOW_SECONDS + 1);
    expect(
      createClaimEvent("alice", PROOF, NOW, {
        createdAt: NOW_SECONDS + 120,
      }).created_at,
    ).toBe(NOW_SECONDS + 121);
    expect(
      createClaimEvent("alice", PROOF, NOW, {
        createdAt: Number.NaN,
      }).created_at,
    ).toBe(NOW_SECONDS);
    expect(() =>
      createClaimEvent("alice", PROOF, NOW, {
        createdAt: NOW_SECONDS + 121,
      }),
    ).toThrow("too far in the future");
  });
});

describe("signer rejection", () => {
  it("accepts an uppercase hex public key", async () => {
    const { pubkey, signer } = claimSigner();
    signer.getPublicKey.mockResolvedValue(pubkey.toUpperCase());
    await expect(connectClaimSigner(signer)).resolves.toEqual({
      pubkey,
      npub: nip19.npubEncode(pubkey),
    });
  });

  it("rejects a signature, pubkey, kind, time, or content the signer changed", async () => {
    const { secret, pubkey } = claimSigner();
    const unsigned = createClaimEvent("alice", PROOF, NOW);
    const badSig = {
      getPublicKey: vi.fn(async () => pubkey),
      signEvent: vi.fn(async (event: EventTemplate) => {
        const signed = finalizeEvent(event, secret);
        const tampered = { ...signed, sig: "0".repeat(128) };
        for (const symbol of Object.getOwnPropertySymbols(tampered)) {
          delete tampered[symbol as keyof typeof tampered];
        }
        return tampered;
      }),
    };
    await expect(signClaimEvent(badSig, pubkey, unsigned)).rejects.toThrow(
      "invalid claim event",
    );

    const other = claimSigner();
    await expect(
      signClaimEvent(other.signer, pubkey, unsigned),
    ).rejects.toThrow("invalid claim event");

    const changedKind = {
      getPublicKey: vi.fn(async () => pubkey),
      signEvent: vi.fn(async (event: EventTemplate) =>
        finalizeEvent({ ...event, kind: 1 }, secret),
      ),
    };
    await expect(signClaimEvent(changedKind, pubkey, unsigned)).rejects.toThrow(
      "invalid claim event",
    );

    const changedTime = {
      getPublicKey: vi.fn(async () => pubkey),
      signEvent: vi.fn(async (event: EventTemplate) =>
        finalizeEvent({ ...event, created_at: event.created_at + 5 }, secret),
      ),
    };
    await expect(signClaimEvent(changedTime, pubkey, unsigned)).rejects.toThrow(
      "invalid claim event",
    );

    const changedContent = {
      getPublicKey: vi.fn(async () => pubkey),
      signEvent: vi.fn(async (event: EventTemplate) =>
        finalizeEvent({ ...event, content: "changed" }, secret),
      ),
    };
    await expect(
      signClaimEvent(changedContent, pubkey, unsigned),
    ).rejects.toThrow("invalid claim event");
  });
});

describe("existing identity reads", () => {
  it("matches an uppercase pubkey and ignores other authors and kinds", async () => {
    const { secret, pubkey } = claimSigner();
    const event = finalizeEvent(createClaimEvent("alice", PROOF, NOW), secret);
    const other = finalizeEvent(
      createClaimEvent("alice", PROOF, NOW),
      generateSecretKey(),
    );
    const note = finalizeEvent(
      { kind: 1, created_at: NOW_SECONDS + 10, tags: [], content: "hi" },
      secret,
    );
    const relays = ["wss://one.example/"];
    const pool = {
      subscribe: vi.fn((_relays, _filter, params) => {
        params.onevent(other);
        params.onevent(note);
        params.onevent(event);
        params.onclose(["closed by caller"]);
        return { close: vi.fn() };
      }),
      close: vi.fn(),
    };
    await expect(
      loadExistingClaimEvent(pubkey.toUpperCase(), relays, pool),
    ).resolves.toMatchObject({ id: event.id });
    expect(pool.subscribe).toHaveBeenCalledWith(
      relays,
      { kinds: [10011], authors: [pubkey], limit: 1 },
      expect.objectContaining({
        maxWait: expect.any(Number),
      }),
    );
    const params = pool.subscribe.mock.calls[0][2] as { maxWait: number };
    expect(params.maxWait).toBeGreaterThan(IDENTITY_READ_TIMEOUT_MS);
    expect(pool.close).toHaveBeenCalledWith(relays);
  });

  it("rejects a timed-out read even if close later looks complete", async () => {
    vi.useFakeTimers();
    try {
      const relays = ["wss://one.example/"];
      const pool = {
        subscribe: vi.fn((_relays, _filter, params) => ({
          close() {
            setTimeout(() => params.onclose(["closed by caller"]), 0);
          },
        })),
        close: vi.fn(),
      };
      const pending = loadExistingClaimEvent("ab".repeat(32), relays, pool);
      const outcome = pending.then(
        () => "resolved",
        () => "rejected",
      );
      await vi.advanceTimersByTimeAsync(IDENTITY_READ_TIMEOUT_MS);
      await expect(outcome).resolves.toBe("rejected");
      expect(pool.close).toHaveBeenCalledWith(relays);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not treat a silent open relay as a finished identity read", async () => {
    vi.useFakeTimers();
    class SilentSocket {
      static opened = 0;
      onopen: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor(_url: string) {
        queueMicrotask(() => {
          SilentSocket.opened += 1;
          this.onopen?.();
        });
      }
      send() {}
      close() {}
    }
    useWebSocketImplementation(SilentSocket);
    try {
      const pool = new SimplePool();
      let failure: unknown;
      const pending = loadExistingClaimEvent(
        "ab".repeat(32),
        ["wss://silent.example/"],
        pool,
      ).then(
        () => {
          failure = null;
        },
        (error: unknown) => {
          failure = error;
        },
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(SilentSocket.opened).toBe(1);
      await vi.advanceTimersByTimeAsync(IDENTITY_READ_TIMEOUT_MS - 1);
      expect(failure).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(
        /Could not read the existing Nostr identity/,
      );
    } finally {
      useWebSocketImplementation(globalThis.WebSocket);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe("claim publish flow", () => {
  const liveRelays = ["wss://relay.damus.io/"];
  const readProof = vi.fn(async () => ({
    ok: true as const,
    crawlerRelays: liveRelays,
  }));
  const identityFor = async () => {
    const connected = claimSigner();
    return {
      ...connected,
      identity: await connectClaimSigner(connected.signer),
    };
  };

  it("refuses to publish without a signer or a matching proof", async () => {
    const { signer, identity } = await identityFor();
    const onStart = vi.fn();
    await expect(
      submitXClaim({
        identity: null,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        onStart,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing-identity",
      message: CLAIM_COPY.connectFirst,
    });
    await expect(
      submitXClaim({
        identity,
        signer: null,
        handle: "alice",
        proofUrl: PROOF,
        onStart,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing-signer",
      message: CLAIM_COPY.signerGone,
    });
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "home",
        proofUrl: PROOF,
        onStart,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid-handle",
      field: "handle",
      message: CLAIM_COPY.reservedHandle,
    });
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: "https://x.com/bob/status/1234567890123",
        onStart,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid-proof",
      field: "proofUrl",
      message: CLAIM_COPY.proofMismatch,
    });
    expect(onStart).not.toHaveBeenCalled();
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("clears the identity when the signer key changes and does not sign", async () => {
    const { identity } = await identityFor();
    const switched = claimSigner();
    const onStart = vi.fn();
    await expect(
      submitXClaim({
        identity,
        signer: switched.signer,
        handle: "alice",
        proofUrl: PROOF,
        onStart,
        loadExisting: vi.fn(),
        publish: vi.fn(),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "signer-changed",
      message: CLAIM_COPY.signerChanged,
      clearIdentity: true,
    });
    expect(onStart).toHaveBeenCalledOnce();
    expect(switched.signer.signEvent).not.toHaveBeenCalled();
  });

  it("stops before signing when no crawler relay or the identity read fails", async () => {
    const { signer, identity } = await identityFor();
    const loadExisting = vi.fn();
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://not-covered.example",
        readProof,
        loadExisting,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "failed",
      message: CLAIM_COPY.noCoveredRelay,
    });
    expect(loadExisting).not.toHaveBeenCalled();
    expect(signer.signEvent).not.toHaveBeenCalled();

    loadExisting.mockRejectedValue(new Error("read failed"));
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://relay.damus.io",
        readProof,
        loadExisting,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "failed",
      message: "read failed",
    });
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("reports sign and publish failures without claiming success", async () => {
    const { secret, pubkey, signer, identity } = await identityFor();
    signer.signEvent.mockImplementation(async (event: EventTemplate) =>
      finalizeEvent({ ...event, tags: [["i", "twitter:bob", PROOF]] }, secret),
    );
    const publish = vi.fn();
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://relay.damus.io",
        now: NOW,
        readProof,
        loadExisting: vi.fn().mockResolvedValue(null),
        publish,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "failed",
      message: "The Nostr signer returned an invalid claim event.",
    });
    expect(publish).not.toHaveBeenCalled();

    signer.signEvent.mockImplementation(async (event: EventTemplate) =>
      finalizeEvent(event, secret),
    );
    publish.mockRejectedValue(new Error("relay down"));
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://relay.damus.io",
        now: NOW,
        readProof,
        loadExisting: vi.fn().mockResolvedValue(null),
        publish,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "failed",
      message: "relay down",
    });
    expect(pubkey).toBe(identity.pubkey);
  });

  it("publishes a signed claim and still requires backend verification", async () => {
    const { secret, signer, identity } = await identityFor();
    const order: string[] = [];
    const publish = vi.fn(async () => {
      order.push("publish");
      return "wss://relay.damus.io/";
    });
    const ingest = vi.fn(async () => {
      order.push("ingest");
      return {
        ok: true as const,
        handle: "alice",
        status: "verified" as const,
      };
    });
    const proof = vi.fn(async () => {
      order.push("proof");
      return { ok: true as const, crawlerRelays: liveRelays };
    });
    signer.signEvent.mockImplementation(async (event: EventTemplate) => {
      order.push("sign");
      return finalizeEvent(event, secret);
    });
    const result = await submitXClaim({
      identity,
      signer,
      handle: "@Alice",
      proofUrl: "https://twitter.com/Alice/status/1234567890123?s=20",
      relayConfig: "wss://relay.damus.io",
      now: NOW,
      readProof: proof,
      loadExisting: vi.fn(async () => {
        order.push("read");
        return null;
      }),
      publish,
      ingestClaim: ingest,
    });
    expect(result).toEqual({
      ok: true,
      message: CLAIM_COPY.verified,
      toast: CLAIM_COPY.publishedToast,
      ingestStatus: "verified",
    });
    expect(order).toEqual(["proof", "read", "sign", "publish", "ingest"]);
  });

  it("keeps a published claim when ingest cannot finish", async () => {
    const { secret, signer, identity } = await identityFor();
    signer.signEvent.mockImplementation(async (event: EventTemplate) =>
      finalizeEvent(event, secret),
    );
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://relay.damus.io",
        now: NOW,
        readProof,
        loadExisting: vi.fn().mockResolvedValue(null),
        publish: vi.fn(async () => "wss://relay.damus.io/"),
        ingestClaim: vi.fn(async () => ({
          ok: false as const,
          message: CLAIM_COPY.published,
        })),
      }),
    ).resolves.toMatchObject({
      ok: true,
      ingestStatus: "pending",
      message: CLAIM_COPY.published,
    });
  });

  it("does not sign when the proof tweet omits the npub", async () => {
    const { signer, identity } = await identityFor();
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        readProof: async () => ({
          ok: false,
          message: CLAIM_COPY.proofMissingNpub,
        }),
      }),
    ).resolves.toMatchObject({
      ok: false,
      message: CLAIM_COPY.proofMissingNpub,
    });
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("ignores a baked-in relay that the crawler is not reading", async () => {
    const { signer, identity } = await identityFor();
    await expect(
      submitXClaim({
        identity,
        signer,
        handle: "alice",
        proofUrl: PROOF,
        relayConfig: "wss://relay.damus.io",
        readProof: async () => ({
          ok: true,
          crawlerRelays: ["wss://other.example"],
        }),
      }),
    ).resolves.toMatchObject({
      ok: false,
      message: CLAIM_COPY.noCoveredRelay,
    });
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it("asks checkClaimProof for the tweet and the crawler relay list", async () => {
    const directoryApiUrl =
      "https://us-central1-nostr-components.cloudfunctions.net/listDirectoryProfiles";
    expect(claimProofEndpoint(directoryApiUrl)).toBe(
      "https://us-central1-nostr-components.cloudfunctions.net/checkClaimProof",
    );
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const request = new URL(String(url));
      expect(request.origin + request.pathname).toBe(
        "https://us-central1-nostr-components.cloudfunctions.net/checkClaimProof",
      );
      expect(request.searchParams.get("url")).toBe(PROOF);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "npub-not-in-proof-tweet",
        }),
        { status: 400 },
      );
    });
    await expect(
      fetchClaimProof({
        directoryApiUrl,
        proofUrl: PROOF,
        npub: "npub1example",
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      message: CLAIM_COPY.proofMissingNpub,
    });
  });

  it("resets a closed dialog only after publishing finishes", () => {
    expect(
      claimDialogAfterClose({
        publishing: true,
        hasIdentity: true,
        status: "success",
      }),
    ).toBeNull();
    expect(
      claimDialogAfterClose({
        publishing: false,
        hasIdentity: false,
        status: "idle",
      }),
    ).toEqual({
      publishDisabled: true,
      statusMessage: CLAIM_COPY.idle,
      status: "idle",
    });
    expect(
      claimDialogAfterClose({
        publishing: false,
        hasIdentity: true,
        status: "error",
      }),
    ).toEqual({
      publishDisabled: false,
      statusMessage: CLAIM_COPY.signerConnected,
      status: "success",
    });
    expect(
      claimDialogAfterClose({
        publishing: false,
        hasIdentity: true,
        status: "success",
      }),
    ).toEqual({
      publishDisabled: false,
      statusMessage: CLAIM_COPY.signerConnected,
      status: "success",
    });
  });
});
