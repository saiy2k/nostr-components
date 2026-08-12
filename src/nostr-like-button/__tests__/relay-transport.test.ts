// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLikeStateForUrl,
  fetchLikesForUrl,
  hasUserLiked,
  publishSignedReaction,
} from "../like-utils";

const RELAYS = ["wss://relay.damus.io"];
const STATUS_URL = "https://x.com/alokdangre/status/42";

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
});

describe("Like component relay transport", () => {
  it("routes count and active-user queries through the host transport", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "1".repeat(64),
          pubkey: "a".repeat(64),
          created_at: 10,
          kind: 17,
          content: "+",
          tags: [],
          sig: "2".repeat(128),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "3".repeat(64),
          pubkey: "a".repeat(64),
          created_at: 10,
          kind: 17,
          content: "+",
          tags: [],
          sig: "4".repeat(128),
        },
      ]);
    const publish = vi.fn();
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query: query, publish: publish },
    });

    await expect(fetchLikesForUrl(STATUS_URL, RELAYS)).resolves.toMatchObject({
      totalCount: 1,
      likedCount: 1,
    });
    await expect(
      hasUserLiked(STATUS_URL, "a".repeat(64), RELAYS),
    ).resolves.toBe(true);

    expect(query).toHaveBeenNthCalledWith(1, RELAYS, {
      kinds: [17],
      "#k": ["web"],
      "#i": [STATUS_URL],
      limit: 1000,
    });
    expect(query).toHaveBeenNthCalledWith(2, RELAYS, {
      kinds: [17],
      authors: ["a".repeat(64)],
      "#k": ["web"],
      "#i": [STATUS_URL],
      limit: 1,
    });
  });

  it("hydrates the liked state from an existing reaction when revisiting", async () => {
    const publicKey = "a".repeat(64);
    const existingLike = {
      id: "1".repeat(64),
      pubkey: publicKey,
      created_at: 10,
      kind: 17,
      content: "+",
      tags: [
        ["k", "web"],
        ["i", STATUS_URL],
      ],
      sig: "2".repeat(128),
    };
    const getKnownPublicKey = vi.fn(async () => publicKey);
    const query = vi.fn(async () => [existingLike]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getKnownPublicKey: getKnownPublicKey,
        query: query,
        publish: vi.fn(),
      },
    });

    await expect(
      fetchLikeStateForUrl(STATUS_URL, RELAYS),
    ).resolves.toMatchObject({
      totalCount: 1,
      isLiked: true,
    });
    expect(getKnownPublicKey).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledOnce();
  });

  it("publishes signed reactions through the transport without invoking NDK", async () => {
    const signedEvent = { id: "1".repeat(64), kind: 17, content: "+" };
    const publish = vi.fn(async () => {});
    const ndkFallback = vi.fn(async () => {});
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: vi.fn(),
        publish: publish,
      },
    });

    await publishSignedReaction(signedEvent, RELAYS, ndkFallback);

    expect(publish).toHaveBeenCalledWith(RELAYS, signedEvent);
    expect(ndkFallback).not.toHaveBeenCalled();
  });
});
