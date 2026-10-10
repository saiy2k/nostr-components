// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCachedLikeStateForUrl,
  fetchLikesForUrl,
  hasUserLiked,
  isDirectoryWriteError,
  publishSignedReaction,
  restoredViewerLiked,
  DIRECTORY_WRITE_ERROR,
} from '../like-utils';

const RELAYS = ['wss://relay.damus.io'];
const STATUS_URL = 'https://x.com/alokdangre/status/42';

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
  vi.unstubAllGlobals();
});

describe('Like component relay transport', () => {
  it('reads the recent extension cache before relay revalidation', async () => {
    const getCachedLikeState = vi.fn().mockResolvedValue({
      found: true,
      isLiked: true,
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getCachedLikeState: getCachedLikeState,
        query: vi.fn(),
        publish: vi.fn(),
      },
    });

    await expect(
      fetchCachedLikeStateForUrl(STATUS_URL, RELAYS),
    ).resolves.toBe(true);
    expect(getCachedLikeState).toHaveBeenCalledWith(RELAYS, STATUS_URL);
  });

  it('uses the host like-state request so a persisted active-user reaction is restored', async () => {
    const getLikeState = vi.fn().mockResolvedValue({
      totalCount: 4,
      likedCount: 4,
      dislikedCount: 1,
      isLiked: true,
    });
    const query = vi.fn();
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getLikeState: getLikeState,
        query: query,
        publish: vi.fn(),
      },
    });

    await expect(fetchLikesForUrl(STATUS_URL, RELAYS)).resolves.toMatchObject({
      totalCount: 4,
      likedCount: 4,
      dislikedCount: 1,
      isLiked: true,
    });
    expect(getLikeState).toHaveBeenCalledWith(RELAYS, STATUS_URL);
    expect(query).not.toHaveBeenCalled();
  });

  it('routes count and active-user queries through the host transport', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: '1'.repeat(64),
          pubkey: 'a'.repeat(64),
          created_at: 10,
          kind: 17,
          content: '+',
          tags: [],
          sig: '2'.repeat(128),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '3'.repeat(64),
          pubkey: 'a'.repeat(64),
          created_at: 10,
          kind: 17,
          content: '+',
          tags: [],
          sig: '4'.repeat(128),
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
      hasUserLiked(STATUS_URL, 'a'.repeat(64), RELAYS),
    ).resolves.toBe(true);

    expect(query).toHaveBeenNthCalledWith(1, RELAYS, {
      kinds: [17],
      '#k': ['web'],
      '#i': [STATUS_URL],
      limit: 1000,
    });
    expect(query).toHaveBeenNthCalledWith(2, RELAYS, {
      kinds: [17],
      authors: ['a'.repeat(64)],
      '#k': ['web'],
      '#i': [STATUS_URL],
      limit: 1,
    });
  });

  it('restores liked from the saved reaction when the signer is not loaded', async () => {
    const pubkey = 'c'.repeat(64);
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    await publishSignedReaction(
      {
        id: '7'.repeat(64),
        pubkey,
        created_at: 40,
        kind: 17,
        content: '+',
        tags: [['i', STATUS_URL]],
      },
      RELAYS,
      async () => {},
    );

    expect(restoredViewerLiked(STATUS_URL, [], null)).toBe(true);
    expect(restoredViewerLiked(STATUS_URL, [{
      authorPubkey: pubkey,
      date: new Date(80 * 1000),
      content: '-',
    }], null)).toBe(false);
  });

  it('throws when the host does not know whether the page is liked', async () => {
    const query = vi.fn();
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        getLikeState: vi.fn().mockResolvedValue({
          totalCount: 0,
          likedCount: 0,
          dislikedCount: 0,
          isLiked: null,
        }),
        query,
        publish: vi.fn(),
      },
    });

    await expect(
      hasUserLiked(STATUS_URL, 'a'.repeat(64), RELAYS),
    ).rejects.toThrow('Could not check whether this page is already liked');
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the newest reaction and a remembered like when the lookup is empty', async () => {
    const pubkey = 'a'.repeat(64);
    const olderLike = {
      id: '1'.repeat(64),
      pubkey,
      created_at: 10,
      kind: 17,
      content: '+',
      tags: [['i', STATUS_URL]],
      sig: '2'.repeat(128),
    };
    const newerUnlike = {
      id: '3'.repeat(64),
      pubkey,
      created_at: 30,
      kind: 17,
      content: '-',
      tags: [['i', STATUS_URL]],
      sig: '4'.repeat(128),
    };
    const query = vi.fn()
      .mockResolvedValueOnce([olderLike, newerUnlike])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('relay down'));
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query,
        publish: vi.fn(),
      },
    });

    await expect(hasUserLiked(STATUS_URL, pubkey, RELAYS)).resolves.toBe(false);

    await publishSignedReaction(
      {
        id: '5'.repeat(64),
        pubkey,
        created_at: 40,
        kind: 17,
        content: '+',
        tags: [['k', 'web'], ['i', STATUS_URL]],
      },
      RELAYS,
      async () => {},
    );
    delete (
      globalThis as typeof globalThis & {
        __nostrComponentsRelayTransport?: unknown;
      }
    ).__nostrComponentsRelayTransport;
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    await publishSignedReaction(
      {
        id: '5'.repeat(64),
        pubkey,
        created_at: 40,
        kind: 17,
        content: '+',
        tags: [['k', 'web'], ['i', STATUS_URL]],
      },
      RELAYS,
      async () => {},
    );
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(hasUserLiked(STATUS_URL, pubkey, RELAYS)).resolves.toBe(true);
    await expect(hasUserLiked(STATUS_URL, pubkey, RELAYS)).rejects.toThrow('relay down');
    expect(isDirectoryWriteError(new Error(DIRECTORY_WRITE_ERROR))).toBe(true);
    expect(isDirectoryWriteError(new Error('relay down'))).toBe(false);
  });

  it('forgets a local like once a relay returns the same event', async () => {
    const pubkey = 'b'.repeat(64);
    const id = '6'.repeat(64);
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    await publishSignedReaction(
      {
        id,
        pubkey,
        created_at: 50,
        kind: 17,
        content: '+',
        tags: [['i', STATUS_URL]],
      },
      RELAYS,
      async () => {},
    );
    const query = vi.fn()
      .mockResolvedValueOnce([
        {
          id,
          pubkey,
          created_at: 50,
          kind: 17,
          content: '+',
          tags: [['i', STATUS_URL]],
        },
      ])
      .mockResolvedValueOnce([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(hasUserLiked(STATUS_URL, pubkey, RELAYS)).resolves.toBe(true);
    await expect(hasUserLiked(STATUS_URL, pubkey, RELAYS)).resolves.toBe(false);
  });

  it('publishes signed reactions through the transport without invoking NDK', async () => {
    const signedEvent = { id: '1'.repeat(64), kind: 17, content: '+' };
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
