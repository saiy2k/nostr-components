// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ingestion.js", () => ({
  createNdkRelayClient: () => ({
    connect: async () => {},
    close: () => {},
  }),
  isValidSignedEvent: (event) => event?.sig === "ok",
  queryRelay: vi.fn(),
}));

import { queryRelay } from "./ingestion.js";
import {
  PROJECTION_KIND0_RELAY_LIMIT,
  fetchKind0s,
  metadataFromKind0,
  preferNewerKind0,
  relaysForKind0Lookup,
} from "./kind0.js";

const PUBKEY = "a".repeat(64);

describe("kind 0 selection", () => {
  beforeEach(() => {
    queryRelay.mockReset();
  });

  it("rejects an event whose kind is not 0", () => {
    expect(
      metadataFromKind0({
        kind: 1,
        sig: "ok",
        content: JSON.stringify({ nip05: "alice@example.com" }),
      }),
    ).toBeNull();
  });

  it("keeps the newer kind 0 and ignores other kinds", () => {
    const older = { kind: 0, created_at: 10 };
    const newer = { kind: 0, created_at: 20 };
    expect(preferNewerKind0(older, newer)).toBe(newer);
    expect(preferNewerKind0(newer, older)).toBe(newer);
    expect(preferNewerKind0(older, { kind: 1, created_at: 99 })).toBe(older);
  });

  it("keeps all 50 directory relays for kind 0 lookup", () => {
    expect(PROJECTION_KIND0_RELAY_LIMIT).toBe(50);
    const relays = Array.from(
      { length: 50 },
      (_, index) => `wss://relay-${index}.example`,
    );
    expect(relaysForKind0Lookup(relays, PROJECTION_KIND0_RELAY_LIMIT)).toEqual(
      relays,
    );
  });

  it("puts profile relays first and caps a long list", () => {
    expect(
      relaysForKind0Lookup(
        [
          "wss://relay.momostr.pink",
          "wss://relay.ditto.pub",
          "wss://purplepag.es",
          "wss://relay.primal.net",
          "wss://extra.example",
        ],
        3,
      ),
    ).toEqual([
      "wss://purplepag.es",
      "wss://relay.primal.net",
      "wss://relay.momostr.pink",
    ]);
  });

  it("keeps the newest kind 0 across relays", async () => {
    queryRelay.mockImplementation(async (url) => {
      const createdAt = url.endsWith("new.example") ? 20 : 10;
      return {
        reason: "eose",
        events: [
          {
            kind: 0,
            pubkey: PUBKEY,
            created_at: createdAt,
            sig: "ok",
            content: "{}",
          },
          {
            kind: 1,
            pubkey: PUBKEY,
            created_at: 99,
            sig: "ok",
            content: JSON.stringify({ nip05: "evil@example.com" }),
          },
        ],
      };
    });

    const profiles = await fetchKind0s(
      [PUBKEY],
      ["wss://old.example", "wss://new.example"],
      { newest: true },
    );

    expect(profiles.get(PUBKEY).event.created_at).toBe(20);
  });

  it("stops at the first relay when a newer profile is not required", async () => {
    queryRelay.mockImplementation(async (url) => ({
      reason: "eose",
      events: [
        {
          kind: 0,
          pubkey: PUBKEY,
          created_at: url.endsWith("new.example") ? 20 : 10,
          sig: "ok",
          content: "{}",
        },
      ],
    }));

    const profiles = await fetchKind0s(
      [PUBKEY],
      ["wss://old.example", "wss://new.example"],
    );

    expect(profiles.get(PUBKEY).event.created_at).toBe(10);
    expect(queryRelay).toHaveBeenCalledTimes(1);
  });
});
