// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { netLikesByPubkey } from '../like-netting';

function reaction(
  pubkey: string,
  content: string,
  created_at: number,
  id = `${pubkey}-${created_at}-${content}`,
): Event {
  return {
    id,
    pubkey,
    created_at,
    kind: 17,
    tags: [
      ['k', 'web'],
      ['i', 'https://example.com'],
    ],
    content,
    sig: '0'.repeat(128),
  };
}

describe('netLikesByPubkey', () => {
  it('counts only the latest reaction per pubkey', () => {
    const result = netLikesByPubkey([
      reaction('aaa', '+', 100),
      reaction('aaa', '+', 101),
      reaction('aaa', '+', 102),
      reaction('bbb', '+', 100),
    ]);

    expect(result.likedCount).toBe(2);
    expect(result.dislikedCount).toBe(0);
    expect(result.totalCount).toBe(2);
    expect(result.likeDetails).toHaveLength(2);
  });

  it('lets a later unlike replace an earlier like for the same pubkey', () => {
    const result = netLikesByPubkey([
      reaction('aaa', '+', 100),
      reaction('aaa', '-', 200),
      reaction('bbb', '+', 150),
    ]);

    expect(result.likedCount).toBe(1);
    expect(result.dislikedCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('treats empty content as a like', () => {
    const result = netLikesByPubkey([reaction('aaa', '', 100)]);
    expect(result.totalCount).toBe(1);
    expect(result.likedCount).toBe(1);
  });
});
