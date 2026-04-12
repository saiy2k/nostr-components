// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  applyOptimisticLike,
  applyOptimisticUnlike,
  clampLikeCount,
  rollbackOptimisticLikeState,
} from '../optimistic-state';

describe('optimistic-state', () => {
  it('clamps negative counts to zero', () => {
    expect(clampLikeCount(-2)).toBe(0);
  });

  it('applies optimistic like', () => {
    const next = applyOptimisticLike({ isLiked: false, likeCount: 7 });
    expect(next).toEqual({ isLiked: true, likeCount: 8 });
  });

  it('applies optimistic unlike without going negative', () => {
    const next = applyOptimisticUnlike({ isLiked: true, likeCount: 0 });
    expect(next).toEqual({ isLiked: false, likeCount: 0 });
  });

  it('failure-before-optimistic keeps current state unchanged', () => {
    const result = rollbackOptimisticLikeState({
      current: { isLiked: false, likeCount: 5 },
      snapshot: { isLiked: false, likeCount: 6 },
      didApplyOptimisticUpdate: false,
    });

    expect(result).toEqual({ isLiked: false, likeCount: 5 });
  });

  it('failure-before-optimistic still clamps invalid current counts', () => {
    const result = rollbackOptimisticLikeState({
      current: { isLiked: false, likeCount: -9 },
      snapshot: { isLiked: false, likeCount: 6 },
      didApplyOptimisticUpdate: false,
    });

    expect(result).toEqual({ isLiked: false, likeCount: 0 });
  });

  it('failure-after-optimistic restores pre-mutation snapshot', () => {
    const result = rollbackOptimisticLikeState({
      current: { isLiked: true, likeCount: 6 },
      snapshot: { isLiked: false, likeCount: 5 },
      didApplyOptimisticUpdate: true,
    });

    expect(result).toEqual({ isLiked: false, likeCount: 5 });
  });
});
