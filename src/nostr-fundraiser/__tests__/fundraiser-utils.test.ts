// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { mergeRelayLists, parseFundraiserEvent } from '../fundraiser-utils';

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

  it('throws when required relays tag is missing', () => {
    const event = createMockEvent([
      ['amount', '1000'],
    ]);

    expect(() => parseFundraiserEvent(event)).toThrow("Missing required 'relays' tag in fundraiser event");
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
