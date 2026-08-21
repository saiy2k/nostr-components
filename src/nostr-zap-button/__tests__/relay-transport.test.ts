// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBatchedProfileMetadata,
  getProfileMetadata,
  listenForZapReceipt,
} from '../zap-utils';

const RELAYS = ['wss://relay.damus.io'];

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
  vi.useRealTimers();
});

describe('Zap component relay transport', () => {
  it('routes profile lookup through the host transport', async () => {
    const pubkey = '6'.repeat(64);
    const profile = {
      id: '1'.repeat(64),
      pubkey,
      created_at: 10,
      kind: 0,
      content: JSON.stringify({ lud16: 'creator@example.com' }),
      tags: [],
      sig: '2'.repeat(128),
    };
    const query = vi.fn().mockResolvedValue([profile]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getProfileMetadata(pubkey, RELAYS)).resolves.toBe(profile);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      authors: [pubkey],
      kinds: [0],
      limit: 1,
    });
  });

  it('batches zapper profiles into one bounded host query', async () => {
    const pubkeys = ['7'.repeat(64), '8'.repeat(64)];
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getBatchedProfileMetadata(pubkeys, RELAYS)).resolves.toEqual([
      { id: pubkeys[0], profile: null },
      { id: pubkeys[1], profile: null },
    ]);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      authors: pubkeys,
      kinds: [0],
      limit: 2,
    });
  });

  it('polls for a zap receipt through the host transport and stops on cleanup', async () => {
    vi.useFakeTimers();
    const pubkey = 'a'.repeat(64);
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    const cleanup = listenForZapReceipt({
      relays: RELAYS,
      receiversPubKey: pubkey,
      invoice: 'lnbc-test',
      provider: {
        lnurl: 'https://example.com/.well-known/lnurlp/creator',
        callback: 'https://example.com/callback',
        nostrPubkey: 'b'.repeat(64),
      },
      onSuccess: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      kinds: [9735],
      '#p': [pubkey],
      since: expect.any(Number),
      limit: 100,
    });

    cleanup();
    await vi.advanceTimersByTimeAsync(6000);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('stops transport receipt polling after the payment-attempt deadline', async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    listenForZapReceipt({
      relays: RELAYS,
      receiversPubKey: 'c'.repeat(64),
      invoice: 'lnbc-expiring',
      provider: {
        lnurl: 'https://example.com/.well-known/lnurlp/creator',
        callback: 'https://example.com/callback',
        nostrPubkey: 'd'.repeat(64),
      },
      onSuccess: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 3000);
    const callsAtDeadline = query.mock.calls.length;
    expect(callsAtDeadline).toBeGreaterThan(1);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(query).toHaveBeenCalledTimes(callsAtDeadline);
  });
});
