// SPDX-License-Identifier: MIT

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

const mockQuerySync = vi.fn();
const mockClose = vi.fn();

vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual<typeof import('nostr-tools')>('nostr-tools');
  class MockSimplePool {
    querySync = mockQuerySync;
    close = mockClose;
  }

  return {
    ...actual,
    SimplePool: MockSimplePool,
  };
});

import {
  fetchFundraiserProgress,
  mergeRelayLists,
  parseFundraiserEvent,
} from '../fundraiser-utils';

const originalDocument = globalThis.document;

function createMockEvent(tags: string[][], content = 'Fund the thing', kind = 9041): NDKEvent {
  return {
    id: 'fundraiser-event-id',
    pubkey: 'f'.repeat(64),
    created_at: 1712102400,
    kind,
    tags,
    content,
    sig: 'a'.repeat(128),
  } as unknown as NDKEvent;
}

function createZapReceiptEvent({
  id,
  createdAt,
  amountMsats,
  pubkey,
  content = '',
}: {
  id: string;
  createdAt: number;
  amountMsats: number;
  pubkey: string;
  content?: string;
}) {
  return {
    id,
    created_at: createdAt,
    tags: [[
      'description',
      JSON.stringify({
        pubkey,
        content,
        tags: [['amount', String(amountMsats)]],
      }),
    ]],
  };
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        let text = '';

        return {
          set textContent(value: string) {
            text = String(value ?? '');
          },
          get innerHTML() {
            return text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
          },
        };
      },
    },
  });
});

afterAll(() => {
  if (typeof originalDocument === 'undefined') {
    delete (globalThis as { document?: Document }).document;
    return;
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  });
});

beforeEach(() => {
  mockQuerySync.mockReset();
  mockClose.mockReset();
});

describe('parseFundraiserEvent', () => {

  it('parses required and optional NIP-75 tags', () => {
    const event = createMockEvent([
      ['amount', '210000'],
      ['relays', 'wss://relay.one', 'wss://relay.two'],
      ['title', 'Open Source Sprint'],
      ['summary', 'Support a focused build week'],
      ['image', 'https://example.com/banner.png'],
      ['closed_at', '1712707200'],
      ['r', 'https://example.com/roadmap'],
      ['a', '30023:abcdef:roadmap'],
      ['zap', '1'.repeat(64), 'wss://relay.one', '2'],
      ['zap', '2'.repeat(64), 'wss://relay.two', '1'],
    ], 'We are raising sats to fund the next development sprint.');

    const parsed = parseFundraiserEvent(event);

    expect(parsed.title).toBe('Open Source Sprint');
    expect(parsed.description).toBe('We are raising sats to fund the next development sprint.');
    expect(parsed.summary).toBe('Support a focused build week');
    expect(parsed.image).toBe('https://example.com/banner.png');
    expect(parsed.targetAmountMsats).toBe(210000);
    expect(parsed.targetAmountSats).toBe(210);
    expect(parsed.relays).toEqual(['wss://relay.one', 'wss://relay.two']);
    expect(parsed.closedAt).toBe(1712707200);
    expect(parsed.resourceUrl).toBe('https://example.com/roadmap');
    expect(parsed.resourceEventAddress).toBe('30023:abcdef:roadmap');
    expect(parsed.beneficiaryZapTags).toHaveLength(2);
  });

  it('uses summary as title and content as description when no explicit title tag exists', () => {
    const event = createMockEvent([
      ['amount', '42000'],
      ['relays', 'wss://relay.one'],
      ['summary', 'Fund conference travel'],
    ], 'Flights, accommodation, and event ticket.');

    const parsed = parseFundraiserEvent(event);

    expect(parsed.title).toBe('Fund conference travel');
    expect(parsed.description).toBe('Flights, accommodation, and event ticket.');
  });

  it('falls back to content as title when summary and title are absent', () => {
    const event = createMockEvent([
      ['amount', '99000'],
      ['relays', 'wss://relay.one'],
    ], 'Ship the next release');

    const parsed = parseFundraiserEvent(event);

    expect(parsed.title).toBe('Ship the next release');
    expect(parsed.description).toBeUndefined();
  });

  it('throws when kind is not 9041', () => {
    const event = createMockEvent([
      ['amount', '99000'],
      ['relays', 'wss://relay.one'],
    ], 'Not a fundraiser', 1);

    expect(() => parseFundraiserEvent(event)).toThrow('Expected kind 9041 fundraiser event');
  });

  it('throws when required amount tag is missing', () => {
    const event = createMockEvent([
      ['relays', 'wss://relay.one'],
    ]);

    expect(() => parseFundraiserEvent(event)).toThrow("Missing required 'amount' tag in fundraiser event");
  });

  it('throws when required amount tag is zero or negative', () => {
    const zeroAmountEvent = createMockEvent([
      ['amount', '0'],
      ['relays', 'wss://relay.one'],
    ]);
    const negativeAmountEvent = createMockEvent([
      ['amount', '-10'],
      ['relays', 'wss://relay.one'],
    ]);

    expect(() => parseFundraiserEvent(zeroAmountEvent)).toThrow("Missing required 'amount' tag in fundraiser event");
    expect(() => parseFundraiserEvent(negativeAmountEvent)).toThrow("Missing required 'amount' tag in fundraiser event");
  });

  it('throws when required relays tag is missing', () => {
    const event = createMockEvent([
      ['amount', '1000'],
    ]);

    expect(() => parseFundraiserEvent(event)).toThrow("Missing required 'relays' tag in fundraiser event");
  });
});

describe('fetchFundraiserProgress', () => {
  beforeEach(() => {
    mockQuerySync.mockReset();
    mockClose.mockReset();
  });

  it('paginates through more than 1000 receipts and deduplicates receipt ids', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => createZapReceiptEvent({
      id: `receipt-${index}`,
      createdAt: 5000 - index,
      amountMsats: 1000,
      pubkey: index % 2 === 0 ? 'a'.repeat(64) : 'b'.repeat(64),
    }));
    const secondPage = [
      createZapReceiptEvent({
        id: 'receipt-999',
        createdAt: 3999,
        amountMsats: 1000,
        pubkey: 'a'.repeat(64),
      }),
      createZapReceiptEvent({
        id: 'receipt-extra',
        createdAt: 3998,
        amountMsats: 3000,
        pubkey: 'c'.repeat(64),
      }),
    ];

    mockQuerySync
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const result = await fetchFundraiserProgress({
      eventId: 'fundraiser-event-id',
      relays: ['wss://relay.one'],
      targetAmountMsats: 2_100_000,
    });

    expect(mockQuerySync).toHaveBeenCalledTimes(2);
    expect(result.totalRaised).toBe(1003);
    expect(result.donorCount).toBe(3);
    expect(result.zapDetails).toHaveLength(1001);
  });

  it('sanitizes zap comments and excludes invalid donor pubkeys from donor counts', async () => {
    mockQuerySync.mockResolvedValueOnce([
      createZapReceiptEvent({
        id: 'receipt-safe',
        createdAt: 5000,
        amountMsats: 2100,
        pubkey: 'd'.repeat(64),
        content: '<b>Thanks</b>\n',
      }),
      createZapReceiptEvent({
        id: 'receipt-invalid-pubkey',
        createdAt: 4999,
        amountMsats: 4200,
        pubkey: 'not-a-valid-pubkey',
        content: '<script>alert(1)</script>',
      }),
    ]);

    const result = await fetchFundraiserProgress({
      eventId: 'fundraiser-event-id',
      relays: ['wss://relay.one'],
      targetAmountMsats: 10_000,
    });

    expect(result.totalRaised).toBe(6.3);
    expect(result.donorCount).toBe(1);
    expect(result.zapDetails[0]?.comment).toBe('&lt;b&gt;Thanks&lt;/b&gt;');
    expect(result.zapDetails[1]?.authorPubkey).toBe('');
    expect(result.zapDetails[1]?.comment).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('mergeRelayLists', () => {
  it('deduplicates and trims relay URLs', () => {
    expect(
      mergeRelayLists(
        ['wss://relay.one', ' wss://relay.two '],
        ['wss://relay.two', 'wss://relay.three'],
        undefined
      )
    ).toEqual(['wss://relay.one', 'wss://relay.two', 'wss://relay.three']);
  });
});
