// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import vectors from '../../../backend/nostr-pulse/reaction-vectors.json';
import { netLikesByPubkey, viewerIsLiked } from '../like-netting';

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

  it('uses the shared newest-reaction and content-bucket vectors', () => {
    for (const row of vectors.buckets) {
      const result = netLikesByPubkey([reaction('aaa', row.content, 1, 'bucket')]);
      if (row.bucket === 'like') expect(result.likedCount).toBe(1);
      if (row.bucket === 'dislike') expect(result.dislikedCount).toBe(1);
      if (row.bucket === 'cleared') {
        expect(result.likedCount).toBe(0);
        expect(result.totalCount).toBe(0);
      }
      if (row.bucket === 'emoji') {
        expect(result.likedCount).toBe(0);
        expect(result.dislikedCount).toBe(0);
        expect(result.likeDetails[0]?.content).toBe(row.content);
      }
    }

    for (const row of vectors.newest) {
      const result = netLikesByPubkey(
        row.events.map((event) =>
          reaction('aaa', event.content, event.created_at, event.id),
        ),
      );
      const winner = row.events.find((event) => event.id === row.winnerId);
      expect(result.likeDetails.map((detail) => detail.content)).toEqual([
        winner?.content,
      ]);
    }
  });

  it('reports the viewer as liked when their newest reaction is a like', () => {
    const pubkey = 'AbC'.padEnd(64, 'd');
    const result = netLikesByPubkey([
      reaction(pubkey, '+', 10),
      reaction(pubkey, '-', 20),
      reaction(pubkey, '+', 30),
      reaction('eee', '-', 40),
    ]);

    expect(viewerIsLiked(result.likeDetails, pubkey.toLowerCase())).toBe(true);
    expect(viewerIsLiked(result.likeDetails, 'eee')).toBe(false);
    expect(viewerIsLiked(result.likeDetails, 'f'.repeat(64))).toBe(false);
  });
});
