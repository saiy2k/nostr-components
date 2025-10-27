// SPDX-License-Identifier: MIT

import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export interface RenderLikeButtonOptions extends IRenderOptions {
  buttonText: string;
  isLiked: boolean;
  likeCount: number;
  hasLikes?: boolean;
}

export function renderLikeButton({
  isLoading,
  isError,
  errorMessage,
  buttonText,
  isLiked,
  likeCount,
  hasLikes = false,
}: RenderLikeButtonOptions): string {

  if (isError) {
    return renderError(errorMessage || '');
  }

  if (isLoading) {
    return renderLoading();
  }

  const iconContent = getThumbsUpIcon(isLiked);
  const textContent = isLiked 
    ? `<span>Liked</span>`
    : `<span>${escapeHtml(buttonText)}</span>`;

  return renderContainer(iconContent, textContent, likeCount, hasLikes);
}

function renderLoading(): string {
  return renderContainer(
    getThumbsUpIcon(false),
    '<span class="button-text-skeleton"></span>',
    0,
    false
  );
}

function renderError(errorMessage: string): string {
  return renderErrorContainer(
    '<div class="error-icon">&#9888;</div>',
    escapeHtml(errorMessage)
  );
}

function renderErrorContainer(leftContent: string, rightContent: string): string {
  return `
    <div class="nostr-like-button-container">
      <div class="nostr-like-button-left-container">
        ${leftContent}
      </div>
      <div class="nostr-like-button-right-container">
        ${rightContent}
      </div>
    </div>
  `;
}

function renderContainer(
  iconContent: string, 
  textContent: string, 
  likeCount: number, 
  hasLikes: boolean = false
): string {
  const countHtml = likeCount > 0 
    ? `<span class="like-count${hasLikes ? ' clickable' : ''}">${likeCount} ${likeCount === 1 ? 'like' : 'likes'}</span>` 
    : '';
  
  return `
    <div class="nostr-like-button-container">
      <button class="nostr-like-button">
        ${iconContent}
        ${textContent}
      </button>
      ${countHtml}
    </div>
  `;
}

function getThumbsUpIcon(isLiked: boolean): string {
  if (isLiked) {
    // Filled thumbs up (blue)
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 9V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11l-4-4-4 4z" 
            fill="#1877f2" stroke="#1877f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  } else {
    // Outline thumbs up (gray)
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 9V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11l-4-4-4 4z" 
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
}
