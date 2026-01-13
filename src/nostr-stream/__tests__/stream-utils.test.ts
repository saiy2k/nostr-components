// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { parseStreamEvent, ParsedStreamEvent } from '../stream-utils';

/**
 * Helper to create a mock NDKEvent with tags
 */
function createMockEvent(tags: string[][], kind: number = 30311): NDKEvent {
  const event = {
    tags,
    kind,
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    sig: '',
  } as unknown as NDKEvent;
  return event;
}

describe('parseStreamEvent', () => {
  it('should parse event with all tags present', () => {
    const tags: string[][] = [
      ['d', 'demo-stream-123'],
      ['title', 'Test Stream'],
      ['summary', 'This is a test stream'],
      ['image', 'https://example.com/image.png'],
      ['streaming', 'https://example.com/stream.m3u8'],
      ['recording', 'https://example.com/recording.mp4'],
      ['starts', '1699123456'],
      ['ends', '1699127056'],
      ['status', 'live'],
      ['current_participants', '42'],
      ['total_participants', '100'],
      ['p', 'pubkey1', 'wss://relay1.com', 'Host', 'proof1'],
      ['p', 'pubkey2', 'wss://relay2.com', 'Speaker'],
      ['p', 'pubkey3', '', 'Participant'],
      ['relays', 'wss://relay1.com', 'wss://relay2.com'],
      ['t', 'hashtag1'],
      ['t', 'hashtag2'],
    ];

    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.dTag).toBe('demo-stream-123');
    expect(result.title).toBe('Test Stream');
    expect(result.summary).toBe('This is a test stream');
    expect(result.image).toBe('https://example.com/image.png');
    expect(result.streamingUrl).toBe('https://example.com/stream.m3u8');
    expect(result.recordingUrl).toBe('https://example.com/recording.mp4');
    expect(result.starts).toBe(1699123456);
    expect(result.ends).toBe(1699127056);
    expect(result.status).toBe('live');
    expect(result.currentParticipants).toBe(42);
    expect(result.totalParticipants).toBe(100);
    expect(result.participants).toHaveLength(3);
    expect(result.participants[0]).toEqual({
      pubkey: 'pubkey1',
      relay: 'wss://relay1.com',
      role: 'Host',
      proof: 'proof1',
    });
    expect(result.participants[1]).toEqual({
      pubkey: 'pubkey2',
      relay: 'wss://relay2.com',
      role: 'Speaker',
    });
    expect(result.participants[2]).toEqual({
      pubkey: 'pubkey3',
      role: 'Participant',
    });
    expect(result.relays).toEqual(['wss://relay1.com', 'wss://relay2.com']);
    expect(result.hashtags).toEqual(['hashtag1', 'hashtag2']);
  });

  it('should parse event with only required d tag', () => {
    const tags: string[][] = [['d', 'minimal-stream']];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.dTag).toBe('minimal-stream');
    expect(result.title).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.status).toBe('planned'); // Default status
    expect(result.participants).toEqual([]);
    expect(result.hashtags).toEqual([]);
  });

  it('should throw error if d tag is missing', () => {
    const tags: string[][] = [['title', 'Stream without d tag']];
    const event = createMockEvent(tags);

    expect(() => parseStreamEvent(event)).toThrow("Missing required 'd' tag in stream event");
  });

  it('should handle missing optional tags gracefully', () => {
    const tags: string[][] = [
      ['d', 'test-stream'],
      ['title', 'Only Title'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.dTag).toBe('test-stream');
    expect(result.title).toBe('Only Title');
    expect(result.summary).toBeUndefined();
    expect(result.image).toBeUndefined();
    expect(result.streamingUrl).toBeUndefined();
    expect(result.starts).toBeUndefined();
    expect(result.ends).toBeUndefined();
    expect(result.currentParticipants).toBeUndefined();
    expect(result.totalParticipants).toBeUndefined();
  });

  it('should validate status values', () => {
    const statuses: Array<'planned' | 'live' | 'ended'> = ['planned', 'live', 'ended'];
    
    for (const status of statuses) {
      const tags: string[][] = [['d', 'test'], ['status', status]];
      const event = createMockEvent(tags);
      const result = parseStreamEvent(event);
      expect(result.status).toBe(status);
    }
  });

  it('should default to planned for invalid status values', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'invalid-status'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);
    
    expect(result.status).toBe('planned');
  });

  it('should parse participant tags with all fields', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey123', 'wss://relay.com', 'Host', 'proof-signature'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toEqual({
      pubkey: 'pubkey123',
      relay: 'wss://relay.com',
      role: 'Host',
      proof: 'proof-signature',
    });
  });

  it('should parse participant tags with minimal fields (pubkey only)', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey123'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toEqual({
      pubkey: 'pubkey123',
    });
  });

  it('should skip invalid participant tags (missing pubkey)', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p'], // Missing pubkey
      ['p', 'valid-pubkey'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].pubkey).toBe('valid-pubkey');
  });

  it('should parse timestamp tags correctly', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['starts', '1699123456'],
      ['ends', '1699127056'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.starts).toBe(1699123456);
    expect(result.ends).toBe(1699127056);
  });

  it('should handle invalid timestamp values', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['starts', 'invalid-number'],
      ['ends', ''],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.starts).toBeUndefined();
    expect(result.ends).toBeUndefined();
  });

  it('should parse number tags correctly', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['current_participants', '50'],
      ['total_participants', '200'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.currentParticipants).toBe(50);
    expect(result.totalParticipants).toBe(200);
  });

  it('should handle invalid number values', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['current_participants', 'not-a-number'],
      ['total_participants', ''],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.currentParticipants).toBeUndefined();
    expect(result.totalParticipants).toBeUndefined();
  });

  it('should extract all relay tags', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['relays', 'wss://relay1.com'],
      ['relays', 'wss://relay2.com'],
      ['relays', 'wss://relay3.com'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.relays).toEqual([
      'wss://relay1.com',
      'wss://relay2.com',
      'wss://relay3.com',
    ]);
  });

  it('should extract all hashtag tags', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['t', 'nostr'],
      ['t', 'streaming'],
      ['t', 'live'],
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.hashtags).toEqual(['nostr', 'streaming', 'live']);
  });

  it('should return empty array for hashtags when none present', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.hashtags).toEqual([]);
  });

  it('should return undefined for relays when none present', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    expect(result.relays).toBeUndefined();
  });

  it('should handle participant with empty relay string (treated as missing)', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey1', '', 'Participant'], // Empty relay string
    ];
    const event = createMockEvent(tags);
    const result = parseStreamEvent(event);

    // Empty string is falsy, so it's treated as missing (undefined)
    expect(result.participants[0].relay).toBeUndefined();
    expect(result.participants[0].role).toBe('Participant');
  });
});
