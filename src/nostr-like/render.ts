// SPDX-License-Identifier: MIT

import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export interface RenderLikeButtonOptions extends IRenderOptions {
  buttonText: string;
  isLiked: boolean;
  likeCount: number;
  hasLikes?: boolean;
  isCountLoading?: boolean;
  theme?: 'light' | 'dark';
}

export function renderLikeButton({
  isLoading,
  isError,
  errorMessage,
  buttonText,
  isLiked,
  likeCount,
  hasLikes = false,
  isCountLoading = false,
  theme = 'light',
}: RenderLikeButtonOptions): string {

  if (isError) {
    return renderError(errorMessage || '');
  }

  if (isLoading) {
    return renderLoading(theme);
  }

  const iconContent = getThumbsUpIcon(isLiked, theme);
  const textContent = isLiked 
    ? `<span>Liked</span>`
    : `<span>${escapeHtml(buttonText)}</span>`;

  return renderContainer(iconContent, textContent, likeCount, hasLikes, isLiked, isCountLoading);
}

function renderLoading(theme: 'light' | 'dark' = 'light'): string {
  const helpIconHtml = `<button class="help-icon" title="What is a like?">?</button>`;
  // Separate skeletons for button and count
  return `
    <div class="nostr-like-button-container">
      <button class="nostr-like-button">
        ${getThumbsUpIcon(false, theme)}
        <span class="button-text-skeleton"></span>
      </button>
      <span class="like-count skeleton"></span>
      ${helpIconHtml}
    </div>
  `;
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
  hasLikes: boolean = false,
  isLiked: boolean = false,
  isCountLoading: boolean = false
): string {
  let countHtml = '';
  if (isCountLoading) {
    countHtml = '<span class="like-count skeleton"></span>';
  } else if (likeCount > 0) {
    const label = likeCount === 1 ? 'like' : 'likes';
    countHtml = `<span class="like-count${hasLikes ? ' clickable' : ''}">${likeCount} ${label}</span>`;
  }
  
  const buttonClass = isLiked ? 'nostr-like-button liked' : 'nostr-like-button';
  const helpIconHtml = `<button class="help-icon" title="What is a like?">?</button>`;
  
  return `
    <div class="nostr-like-button-container">
      <button class="${buttonClass}">
        ${iconContent}
        ${textContent}
      </button>
      ${countHtml} ${helpIconHtml}
    </div>
  `;
}

function getThumbsUpIcon(isLiked: boolean, theme: 'light' | 'dark' = 'light'): string {
  // Determine colors based on theme
  const likedColor = theme === 'dark' ? '#8ab4f8' : '#1877f2'; // Light blue for dark theme, blue for light theme
  const outlineColor = theme === 'dark' ? '#e0e7ff' : '#0d46a1'; // Light color for dark theme, dark blue for light theme

  if (isLiked) {
    // Filled thumbs up
    return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100" width="24" height="24">
      <path d="M93.6,53.1c2.6-1.5,4.2-4.4,3.8-7.6c-0.5-4-4.2-6.8-8.2-6.8l-25,0c0.2-0.5,0.5-1.2,0.7-1.8c1.5-3.8,4.3-10.8,4.3-18 c0-8.1-5.7-13-9.6-13.3C57.2,5.5,55.4,7,55,9.7c-0.7,5.1-4.1,12.6-5.5,15.5c-0.4,0.9-0.9,1.7-1.6,2.4c-2.3,2.6-8.1,9-13.6,12.8 c0,0.2,0.1,0.5,0.1,0.7v47.9c0,0.4-0.1,0.8-0.1,1.2c9.4,2.7,17.9,4,27.2,4l21.3,0c3.7,0,7.2-2.5,7.9-6.1c0.6-3-0.5-5.7-2.5-7.5 c3.4-0.8,6-3.9,6-7.5c0-2.3-1-4.4-2.7-5.8c3.4-0.8,6-3.9,6-7.5C97.5,57,96,54.5,93.6,53.1z" fill="${likedColor}"/>
      <path d="M23.4,36.9H6.7c-2.3,0-4.2,1.9-4.2,4.2v47.9c0,2.3,1.9,4.2,4.2,4.2h16.7c2.3,0,4.2-1.9,4.2-4.2V41.2 C27.6,38.8,25.8,36.9,23.4,36.9z M15.1,85.9c-2.4,0-4.4-2-4.4-4.4s2-4.4,4.4-4.4c2.4,0,4.4,2,4.4,4.4S17.5,85.9,15.1,85.9z" fill="${likedColor}"/>
    </svg>`;
  } else {
    // Outline thumbs up
    return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100" width="24" height="24">
      <path d="M93.6,53.1c2.6-1.5,4.2-4.4,3.8-7.6c-0.5-4-4.2-6.8-8.2-6.8l-25,0c0.2-0.5,0.5-1.2,0.7-1.8c1.5-3.8,4.3-10.8,4.3-18 c0-8.1-5.7-13-9.6-13.3C57.2,5.5,55.4,7,55,9.7c-0.7,5.1-4.1,12.6-5.5,15.5c-0.4,0.9-0.9,1.7-1.6,2.4c-2.3,2.6-8.1,9-13.6,12.8 c0,0.2,0.1,0.5,0.1,0.7v47.9c0,0.4-0.1,0.8-0.1,1.2c9.4,2.7,17.9,4,27.2,4l21.3,0c3.7,0,7.2-2.5,7.9-6.1c0.6-3-0.5-5.7-2.5-7.5 c3.4-0.8,6-3.9,6-7.5c0-2.3-1-4.4-2.7-5.8c3.4-0.8,6-3.9,6-7.5C97.5,57,96,54.5,93.6,53.1z" fill="none" stroke="${outlineColor}" stroke-width="2"/>
      <path d="M23.4,36.9H6.7c-2.3,0-4.2,1.9-4.2,4.2v47.9c0,2.3,1.9,4.2,4.2,4.2h16.7c2.3,0,4.2-1.9,4.2-4.2V41.2 C27.6,38.8,25.8,36.9,23.4,36.9z M15.1,85.9c-2.4,0-4.4-2-4.4-4.4s2-4.4,4.4-4.4c2.4,0,4.4,2,4.4,4.4S17.5,85.9,15.1,85.9z" fill="none" stroke="${outlineColor}" stroke-width="2"/>
    </svg>`;
  }
}
