// SPDX-License-Identifier: MIT

export interface LikeUiState {
  isLiked: boolean;
  likeCount: number;
}

interface RollbackOptimisticLikeStateParams {
  current: LikeUiState;
  snapshot: LikeUiState;
  didApplyOptimisticUpdate: boolean;
}

export function clampLikeCount(nextCount: number): number {
  return Math.max(0, nextCount);
}

export function applyOptimisticLike(state: LikeUiState): LikeUiState {
  return {
    isLiked: true,
    likeCount: clampLikeCount(state.likeCount + 1),
  };
}

export function applyOptimisticUnlike(state: LikeUiState): LikeUiState {
  return {
    isLiked: false,
    likeCount: clampLikeCount(state.likeCount - 1),
  };
}

export function rollbackOptimisticLikeState({
  current,
  snapshot,
  didApplyOptimisticUpdate,
}: RollbackOptimisticLikeStateParams): LikeUiState {
  if (!didApplyOptimisticUpdate) {
    return {
      isLiked: current.isLiked,
      likeCount: clampLikeCount(current.likeCount),
    };
  }

  return {
    isLiked: snapshot.isLiked,
    likeCount: clampLikeCount(snapshot.likeCount),
  };
}
