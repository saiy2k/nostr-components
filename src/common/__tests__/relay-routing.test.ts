// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it } from 'vitest';
import vectors from '../../../backend/nostr-atlas/profile-routing-vectors.json';
import { RENDEZVOUS_RELAYS, DEFAULT_RELAYS } from '../constants';
import {
  FUTURE_SKEW_SECONDS,
  clearOutboxCache,
  countAnsweredRelays,
  fetchProfileOutbox,
  preferNewerReplaceable,
  relayListFromEvent,
  relaysForComponent,
  selectKind0Relays,
  zapRelaysFor,
  type RelayQuery,
  type ReplaceableEvent,
} from '../relay-routing';

afterEach(() => {
  clearOutboxCache();
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
});

describe('shared profile routing vectors', () => {
  it('keeps the same relay choice and newest-wins results as the profile store', () => {
    expect(FUTURE_SKEW_SECONDS).toBe(vectors.futureSkewSeconds);
    for (const row of vectors.replaceable) {
      const winner = preferNewerReplaceable(
        row.current,
        row.event,
        vectors.nowSec,
      );
      const expected =
        row.winner === 'event'
          ? row.event
          : row.winner === 'current'
            ? row.current
            : null;
      expect(winner, row.name).toEqual(expected);
    }

    const list = relayListFromEvent({ tags: vectors.relayList.tags });
    expect(list.readRelays).toEqual(vectors.relayList.readRelays);
    expect(list.writeRelays).toEqual(vectors.relayList.writeRelays);
    const health = new Map(
      vectors.kind0Selection.unhealthy.map((url) => [
        url,
        { consecutiveFailures: 3 },
      ]),
    );
    const selected = selectKind0Relays({
      ...list,
      hints: vectors.kind0Selection.hints,
      archives: vectors.kind0Selection.archives,
      health,
    });
    expect(selected.filter((url) => url.includes('write-'))).toEqual(
      vectors.kind0Selection.writeRelays,
    );
    for (const url of vectors.kind0Selection.includes) {
      expect(selected).toContain(url);
    }
    for (const url of vectors.kind0Selection.excludes) {
      expect(selected).not.toContain(url);
    }
    expect(
      selectKind0Relays({
        readRelays: vectors.readFallback.readRelays,
        writeRelays: [],
        archives: [],
        hints: [],
      }),
    ).toEqual(vectors.readFallback.expected);
  });
});

describe('relaysForComponent', () => {
  it('uses rendezvous relays when the page does not set relays', () => {
    expect(relaysForComponent(null)).toEqual([...RENDEZVOUS_RELAYS]);
    expect(relaysForComponent(null)).not.toEqual([...DEFAULT_RELAYS]);
  });

  it('keeps the previous relay list while a transport is installed', () => {
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: () => Promise.resolve([]),
        publish: () => Promise.resolve(),
      },
    });
    expect(relaysForComponent(null)).toEqual([...DEFAULT_RELAYS]);
  });

  it('uses an explicit relays attribute on either path', () => {
    expect(relaysForComponent('wss://one.example, wss://two.example')).toEqual([
      'wss://one.example',
      'wss://two.example',
    ]);
  });
});

describe('fetchProfileOutbox', () => {
  it('queries archives before the relay list returns, then the write relays', async () => {
    const pubkey = 'ab'.repeat(32);
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const list: ReplaceableEvent = {
      id: 'c'.repeat(64),
      pubkey,
      created_at: 100,
      kind: 10002,
      tags: [['r', 'wss://write.example', 'write']],
      content: '',
      sig: 'd'.repeat(128),
    };
    const query: RelayQuery = async (relays, filter) => {
      const kind = filter.kinds?.[0];
      if (kind === 10002) {
        order.push('list-start');
        await gate;
        order.push('list-done');
        return { events: [list], answered: relays.length };
      }
      order.push(`kind0:${relays.join('|')}`);
      return { events: [], answered: relays.length };
    };

    const pending = fetchProfileOutbox(pubkey, ['wss://hint.example'], query);
    await Promise.resolve();
    expect(order.some((entry) => entry.startsWith('kind0:'))).toBe(true);
    expect(order.some((entry) => entry.includes('write.example'))).toBe(false);
    release();
    await pending;
    expect(order.some((entry) => entry.includes('write.example'))).toBe(true);
    const writeQuery = order.find((entry) => entry.includes('write.example'));
    expect(order.indexOf('list-done')).toBeLessThan(order.indexOf(writeQuery!));
  });
});

describe('zapRelaysFor', () => {
  it('puts rendezvous relays first and caps the recipient read relays at three', async () => {
    const pubkey = 'cd'.repeat(32);
    const query: RelayQuery = async () => ({
      events: [
        {
          id: 'e'.repeat(64),
          pubkey,
          created_at: 50,
          kind: 10002,
          tags: [
            ['r', 'wss://read-1.example', 'read'],
            ['r', 'wss://read-2.example', 'read'],
            ['r', 'wss://read-3.example', 'read'],
            ['r', 'wss://read-4.example', 'read'],
          ],
          content: '',
          sig: 'f'.repeat(128),
        },
      ],
      answered: 1,
    });
    const relays = await zapRelaysFor(pubkey, [], query);
    expect(relays).toHaveLength(8);
    expect(relays.slice(0, 5)).toEqual(
      RENDEZVOUS_RELAYS.map((url) => (url.endsWith('/') ? url : `${url}/`)),
    );
    expect(relays.slice(5)).toEqual([
      'wss://read-1.example/',
      'wss://read-2.example/',
      'wss://read-3.example/',
    ]);
  });
});

describe('countAnsweredRelays', () => {
  it('counts relays that reached EOSE and ignores connection errors', () => {
    expect(
      countAnsweredRelays([
        'closed by caller',
        'failed to connect',
        'closed by caller',
      ]),
    ).toBe(2);
  });
});
