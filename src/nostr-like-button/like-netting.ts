// SPDX-License-Identifier: MIT

import type { Event } from 'nostr-tools';

export interface LikeDetails {
  authorPubkey: string;
  date: Date;
  content: string;
}

export interface LikeCountResult {
  totalCount: number;
  likeDetails: LikeDetails[];
  likedCount: number;
  dislikedCount: number;
  /** Active user's current state when supplied by an extension host. */
  isLiked?: boolean;
}

function isLikeContent(content: string): boolean {
  return content === '+' || content === '';
}

function isUnlikeContent(content: string): boolean {
  return content === '-';
}

/**
 * Keep the newest reaction per pubkey, then count current likes/unlikes.
 * Prevents a single pubkey from inflating social proof with many kind-17 events.
 */
export function netLikesByPubkey(events: Iterable<Event>): LikeCountResult {
  const latestByPubkey = new Map<string, Event>();

  for (const event of events) {
    if (!event?.pubkey) continue;
    const existing = latestByPubkey.get(event.pubkey);
    if (
      !existing ||
      event.created_at > existing.created_at ||
      (event.created_at === existing.created_at && event.id > existing.id)
    ) {
      latestByPubkey.set(event.pubkey, event);
    }
  }

  const likeDetails: LikeDetails[] = [];
  let likedCount = 0;
  let dislikedCount = 0;

  for (const event of latestByPubkey.values()) {
    likeDetails.push({
      authorPubkey: event.pubkey,
      date: new Date(event.created_at * 1000),
      content: event.content,
    });

    if (isUnlikeContent(event.content)) {
      dislikedCount++;
    } else if (isLikeContent(event.content)) {
      likedCount++;
    }
  }

  likeDetails.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    // Social proof = number of distinct pubkeys whose latest reaction is a like
    totalCount: likedCount,
    likeDetails,
    likedCount,
    dislikedCount,
  };
}
