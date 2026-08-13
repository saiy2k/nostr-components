// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReactionEvent,
  fetchLikeStateForUrl,
  fetchLikesForUrl,
  hasUserLiked,
  invalidateLikeStateCache,
  publishSignedReaction,
} from "../like-utils";

const RELAYS = ["wss://relay.damus.io"];
const STATUS_URL = "https://x.com/alokdangre/status/42";

afterEach(() => {
  invalidateLikeStateCache();
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
    const getLikeState = vi.fn(async () => ({
      totalCount: 1,
      likedCount: 1,
      dislikedCount: 0,
      isLiked: true,
    }));
    const query = vi.fn();
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getLikeState: getLikeState,
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
    expect(getLikeState).toHaveBeenCalledWith(RELAYS, STATUS_URL);
    expect(query).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent hydration and reuses the short-lived cache", async () => {
    const getLikeState = vi.fn(async () => ({
      totalCount: 0,
      likedCount: 0,
      dislikedCount: 0,
      isLiked: false,
    }));
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getLikeState: getLikeState,
        query: vi.fn(),
        publish: vi.fn(),
      },
    });

    const [first, second] = await Promise.all([
      fetchLikeStateForUrl(STATUS_URL, RELAYS),
      fetchLikeStateForUrl(STATUS_URL, RELAYS),
    ]);
    const third = await fetchLikeStateForUrl(STATUS_URL, RELAYS);

    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(getLikeState).toHaveBeenCalledOnce();
  });

  it("bounds concurrent timeline hydration requests", async () => {
    let active = 0;
    let maximumActive = 0;
    const getLikeState = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return {
        totalCount: 0,
        likedCount: 0,
        dislikedCount: 0,
        isLiked: false,
      };
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getLikeState: getLikeState,
        query: vi.fn(),
        publish: vi.fn(),
      },
    });

    await Promise.all(
      Array.from({ length: 10 }, (_value, index) =>
        fetchLikeStateForUrl(
          `https://x.com/alokdangre/status/${100 + index}`,
          RELAYS,
        ),
      ),
    );

    expect(maximumActive).toBeLessThanOrEqual(4);
  });

  it("canonicalizes published tags and user-state queries", async () => {
    const nonCanonicalUrl = "http://mobile.x.com/alokdangre//status/42/";
    const query = vi.fn(async () => []);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query: query, publish: vi.fn() },
    });

    expect(createReactionEvent(nonCanonicalUrl, "+").tags).toContainEqual([
      "i",
      STATUS_URL,
    ]);
    await hasUserLiked(nonCanonicalUrl, "a".repeat(64), RELAYS);

    expect(query).toHaveBeenCalledWith(RELAYS, {
      kinds: [17],
      authors: ["a".repeat(64)],
      "#k": ["web"],
      "#i": [STATUS_URL],
      limit: 1,
    });
  });

  it("selects the newest user reaction across relay responses", async () => {
    const query = vi.fn(async () => [
      { id: "1".repeat(64), created_at: 10, content: "+" },
      { id: "2".repeat(64), created_at: 11, content: "-" },
    ]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query: query, publish: vi.fn() },
    });

    await expect(
      hasUserLiked(STATUS_URL, "a".repeat(64), RELAYS),
    ).resolves.toBe(false);
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
