// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { parseLivestreamEvent, findHostParticipant, getUniqueParticipantPubkeys, getVideoErrorMessage, shouldVideoBeLoading, validateStatus } from '../livestream-utils';

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

describe('validateStatus', () => {
  it('should return valid status for "planned"', () => {
    expect(validateStatus('planned')).toBe('planned');
  });

  it('should return valid status for "live"', () => {
    expect(validateStatus('live')).toBe('live');
  });

  it('should return valid status for "ended"', () => {
    expect(validateStatus('ended')).toBe('ended');
  });

  it('should default to "planned" for undefined', () => {
    expect(validateStatus(undefined)).toBe('planned');
  });

  it('should default to "planned" for empty string', () => {
    expect(validateStatus('')).toBe('planned');
  });

  it('should default to "planned" for invalid status values', () => {
    expect(validateStatus('invalid-status')).toBe('planned');
    expect(validateStatus('LIVE')).toBe('planned'); // Case sensitive
    expect(validateStatus('Planned')).toBe('planned'); // Case sensitive
    expect(validateStatus('123')).toBe('planned');
    expect(validateStatus('null')).toBe('planned');
  });
});

describe('parseLivestreamEvent', () => {
  it('should parse event with all tags present', () => {
    const tags: string[][] = [
      ['d', 'demo-livestream-123'],
      ['title', 'Test Livestream'],
      ['summary', 'This is a test livestream'],
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
    const result = parseLivestreamEvent(event);

    expect(result.dTag).toBe('demo-livestream-123');
    expect(result.title).toBe('Test Livestream');
    expect(result.summary).toBe('This is a test livestream');
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
    const tags: string[][] = [['d', 'minimal-livestream']];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

    expect(result.dTag).toBe('minimal-livestream');
    expect(result.title).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.status).toBe('planned'); // Default status
    expect(result.participants).toEqual([]);
    expect(result.hashtags).toEqual([]);
  });

  it('should throw error if d tag is missing', () => {
    const tags: string[][] = [['title', 'Livestream without d tag']];
    const event = createMockEvent(tags);

    expect(() => parseLivestreamEvent(event)).toThrow("Missing required 'd' tag in livestream event");
  });

  it('should handle missing optional tags gracefully', () => {
    const tags: string[][] = [
      ['d', 'test-livestream'],
      ['title', 'Only Title'],
    ];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

    expect(result.dTag).toBe('test-livestream');
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
      const result = parseLivestreamEvent(event);
      expect(result.status).toBe(status);
    }
  });

  it('should default to planned for invalid status values', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'invalid-status'],
    ];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);
    
    expect(result.status).toBe('planned');
  });

  it('should parse participant tags with all fields', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey123', 'wss://relay.com', 'Host', 'proof-signature'],
    ];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

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
    const result = parseLivestreamEvent(event);

    expect(result.hashtags).toEqual(['nostr', 'streaming', 'live']);
  });

  it('should return empty array for hashtags when none present', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

    expect(result.hashtags).toEqual([]);
  });

  it('should return undefined for relays when none present', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

    expect(result.relays).toBeUndefined();
  });

  it('should handle participant with empty relay string (treated as missing)', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey1', '', 'Participant'], // Empty relay string
    ];
    const event = createMockEvent(tags);
    const result = parseLivestreamEvent(event);

    // Empty string is falsy, so it's treated as missing (undefined)
    expect(result.participants[0].relay).toBeUndefined();
    expect(result.participants[0].role).toBe('Participant');
  });
});

describe('findHostParticipant', () => {
  it('should find host participant with capitalized role', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'host-pubkey', '', 'Host'],
      ['p', 'speaker-pubkey', '', 'Speaker'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const host = findHostParticipant(parsed);

    expect(host).toBeDefined();
    expect(host?.pubkey).toBe('host-pubkey');
    expect(host?.role).toBe('Host');
  });

  it('should find host participant with lowercase role (case-insensitive)', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'host-pubkey', '', 'host'],
      ['p', 'speaker-pubkey', '', 'Speaker'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const host = findHostParticipant(parsed);

    expect(host).toBeDefined();
    expect(host?.pubkey).toBe('host-pubkey');
    expect(host?.role).toBe('host');
  });

  it('should return undefined when no host participant exists', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'speaker-pubkey', '', 'Speaker'],
      ['p', 'participant-pubkey', '', 'Participant'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const host = findHostParticipant(parsed);

    expect(host).toBeUndefined();
  });

  it('should return undefined when no participants exist', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const host = findHostParticipant(parsed);

    expect(host).toBeUndefined();
  });
});

describe('getUniqueParticipantPubkeys', () => {
  it('should return unique pubkeys from participants', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey1', '', 'Host'],
      ['p', 'pubkey2', '', 'Speaker'],
      ['p', 'pubkey1', '', 'Participant'], // Duplicate
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const uniquePubkeys = getUniqueParticipantPubkeys(parsed);

    expect(uniquePubkeys).toHaveLength(2);
    expect(uniquePubkeys).toContain('pubkey1');
    expect(uniquePubkeys).toContain('pubkey2');
  });

  it('should return empty array when no participants exist', () => {
    const tags: string[][] = [['d', 'test']];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const uniquePubkeys = getUniqueParticipantPubkeys(parsed);

    expect(uniquePubkeys).toEqual([]);
  });

  it('should return single pubkey when all participants have same pubkey', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['p', 'pubkey1', '', 'Host'],
      ['p', 'pubkey1', '', 'Speaker'],
      ['p', 'pubkey1', '', 'Participant'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    const uniquePubkeys = getUniqueParticipantPubkeys(parsed);

    expect(uniquePubkeys).toEqual(['pubkey1']);
  });
});

describe('shouldVideoBeLoading', () => {
  it('should return true for live status with streaming URL', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'live'],
      ['streaming', 'https://example.com/stream.m3u8'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    
    expect(shouldVideoBeLoading(parsed)).toBe(true);
  });

  it('should return false for live status without streaming URL', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'live'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    
    expect(shouldVideoBeLoading(parsed)).toBe(false);
  });

  it('should return false for planned status even with streaming URL', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'planned'],
      ['streaming', 'https://example.com/stream.m3u8'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    
    expect(shouldVideoBeLoading(parsed)).toBe(false);
  });

  it('should return false for ended status even with streaming URL', () => {
    const tags: string[][] = [
      ['d', 'test'],
      ['status', 'ended'],
      ['streaming', 'https://example.com/stream.m3u8'],
    ];
    const event = createMockEvent(tags);
    const parsed = parseLivestreamEvent(event);
    
    expect(shouldVideoBeLoading(parsed)).toBe(false);
  });

  it('should return false for null parsed livestream', () => {
    expect(shouldVideoBeLoading(null)).toBe(false);
  });
});

describe('getVideoErrorMessage', () => {
  // MediaError constants (from MDN)
  const MEDIA_ERR_ABORTED = 1;
  const MEDIA_ERR_NETWORK = 2;
  const MEDIA_ERR_DECODE = 3;
  const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

  it('should return default message for null/undefined error', () => {
    expect(getVideoErrorMessage(null)).toBe('Video failed to load');
    expect(getVideoErrorMessage(undefined)).toBe('Video failed to load');
  });

  it('should return appropriate message for MEDIA_ERR_ABORTED', () => {
    const error = { code: MEDIA_ERR_ABORTED } as MediaError;
    expect(getVideoErrorMessage(error)).toBe('Video loading aborted');
  });

  it('should return appropriate message for MEDIA_ERR_NETWORK', () => {
    const error = { code: MEDIA_ERR_NETWORK } as MediaError;
    expect(getVideoErrorMessage(error)).toBe('Network error while loading video');
  });

  it('should return appropriate message for MEDIA_ERR_DECODE', () => {
    const error = { code: MEDIA_ERR_DECODE } as MediaError;
    expect(getVideoErrorMessage(error)).toBe('Video decode error');
  });

  it('should return appropriate message for MEDIA_ERR_SRC_NOT_SUPPORTED', () => {
    const error = { code: MEDIA_ERR_SRC_NOT_SUPPORTED } as MediaError;
    expect(getVideoErrorMessage(error)).toBe('Video format not supported');
  });

  it('should return default message for unknown error codes', () => {
    const error = { code: 999 } as MediaError;
    expect(getVideoErrorMessage(error)).toBe('Video failed to load');
  });
});
