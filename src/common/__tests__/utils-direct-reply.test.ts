// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import {
  filterDirectReplies,
  getDirectReplyParentId,
  isDirectReplyToEvent,
} from '../utils';

const ROOT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PARENT = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const MENTION = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const OTHER = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

function createMockReply(tags: string[][]): NDKEvent {
  return {
    tags,
    id: 'reply-event-id',
    kind: 1,
    pubkey: 'reply-author',
    created_at: 1,
    content: 'reply',
    sig: '',
  } as unknown as NDKEvent;
}

describe('getDirectReplyParentId', () => {
  it('returns null when there are no e tags', () => {
    const reply = createMockReply([]);

    expect(getDirectReplyParentId(reply)).toBeNull();
  });

  it('uses a single positional e tag as the parent', () => {
    const reply = createMockReply([['e', PARENT, '']]);

    expect(getDirectReplyParentId(reply)).toBe(PARENT);
  });

  it('uses a marked reply tag as the parent', () => {
    const reply = createMockReply([
      ['e', ROOT, '', 'root'],
      ['e', PARENT, '', 'reply'],
    ]);

    expect(getDirectReplyParentId(reply)).toBe(PARENT);
  });

  it('uses a marked root tag for top-level replies', () => {
    const reply = createMockReply([['e', ROOT, '', 'root']]);

    expect(getDirectReplyParentId(reply)).toBe(ROOT);
  });

  it('uses the last positional e tag for legacy multi-e replies', () => {
    const reply = createMockReply([
      ['e', ROOT, ''],
      ['e', MENTION, ''],
      ['e', PARENT, ''],
    ]);

    expect(getDirectReplyParentId(reply)).toBe(PARENT);
  });

  it('uses the last positional e tag when the parent is only cited as a mention', () => {
    const reply = createMockReply([
      ['e', ROOT, ''],
      ['e', MENTION, ''],
      ['e', OTHER, ''],
    ]);

    expect(getDirectReplyParentId(reply)).toBe(OTHER);
  });
});

describe('isDirectReplyToEvent', () => {
  it('returns true for a single direct positional reply', () => {
    const reply = createMockReply([['e', PARENT, '']]);

    expect(isDirectReplyToEvent(reply, PARENT)).toBe(true);
  });

  it('returns true for a marked nested reply', () => {
    const reply = createMockReply([
      ['e', ROOT, '', 'root'],
      ['e', PARENT, '', 'reply'],
    ]);

    expect(isDirectReplyToEvent(reply, PARENT)).toBe(true);
  });

  it('returns true for a top-level reply marked with root only', () => {
    const reply = createMockReply([['e', ROOT, '', 'root']]);

    expect(isDirectReplyToEvent(reply, ROOT)).toBe(true);
  });

  it('returns true for a legacy multi-e reply when the parent is last', () => {
    const reply = createMockReply([
      ['e', ROOT, ''],
      ['e', MENTION, ''],
      ['e', PARENT, ''],
    ]);

    expect(isDirectReplyToEvent(reply, PARENT)).toBe(true);
  });

  it('returns false when the parent is only a cited mention', () => {
    const reply = createMockReply([
      ['e', ROOT, ''],
      ['e', PARENT, ''],
      ['e', OTHER, ''],
    ]);

    expect(isDirectReplyToEvent(reply, PARENT)).toBe(false);
  });

  it('returns false for a different parent', () => {
    const reply = createMockReply([['e', PARENT, '']]);

    expect(isDirectReplyToEvent(reply, OTHER)).toBe(false);
  });

  it('returns false for an empty parent id', () => {
    const reply = createMockReply([['e', PARENT, '']]);

    expect(isDirectReplyToEvent(reply, '')).toBe(false);
  });
});

describe('filterDirectReplies', () => {
  it('keeps only direct replies for the parent event', () => {
    const direct = createMockReply([['e', PARENT, '']]);
    const nested = createMockReply([
      ['e', ROOT, '', 'root'],
      ['e', OTHER, '', 'reply'],
    ]);
    const mentionOnly = createMockReply([
      ['e', ROOT, ''],
      ['e', PARENT, ''],
      ['e', OTHER, ''],
    ]);

    const result = filterDirectReplies([direct, nested, mentionOnly], PARENT);

    expect(result).toEqual([direct]);
  });
});
