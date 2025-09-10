// SPDX-License-Identifier: MIT

import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';
import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export interface RenderFollowButtonOptions extends IRenderOptions {
  isFollowed: boolean;
  isFollowing: boolean;
}

export function renderFollowButton({
  theme,
  isLoading,
  isError,
  errorMessage,
  isFollowed,
  isFollowing,
}: RenderFollowButtonOptions): string {

  if (isFollowing) {
    return renderFollowing(theme);
  }

  if (isLoading) {
    return renderLoading(theme);
  }

  if (isError) {
    return renderError(errorMessage || '');
  }

  const buttonText = isFollowed ? 'Followed' : 'Follow';
  const iconContent = isFollowed
    ? getSuccessAnimation(theme) // Use default values
    : getNostrLogo(theme); // Use default values
  const textContent = isFollowed
    ? buttonText
    : `<span>Follow me on Nostr</span>`;

  return renderContainer(iconContent, textContent);
}

function renderLoading(theme: Theme): string {
  return renderContainer(
    getLoadingNostrich(theme), // Use default values
    '<span>Loading...</span>'
  );
}

function renderFollowing(theme: Theme): string {
  return renderContainer(
    getLoadingNostrich(theme), // Use default values
    '<span>Following...</span>'
  );
}

function renderError(errorMessage: string): string {
  return renderContainer(
    '<div class="error-icon">&#9888;</div>',
    escapeHtml(errorMessage)
  );
}

function renderContainer(leftContent: string, rightContent: string): string {
  return `
    <div class='nostrc-container nostr-follow-button-container'>
      <div class='nostr-follow-button-left-container'>
        ${leftContent}
      </div>
      <div class='nostr-follow-button-right-container'>
        ${rightContent}
      </div>
    </div>
  `;
}