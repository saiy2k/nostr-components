// SPDX-License-Identifier: MIT

import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';
import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';
import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';

export interface RenderFollowButtonOptions extends IRenderOptions {
  isFollowed: boolean;
  isFollowing: boolean;
  showAvatar?: boolean;
  user?: NDKUser | null;
  profile?: NDKUserProfile | null;
  customText?: string;
}

export function renderFollowButton({
  isLoading,
  isError,
  errorMessage,
  isFollowed,
  isFollowing,
  showAvatar = false,
  user,
  profile,
  customText = 'Follow me on nostr',
}: RenderFollowButtonOptions): string {

  if (isFollowing) {
    return renderFollowing();
  }

  if (isLoading) {
    return renderLoading();
  }

  if (isError) {
    return renderError(errorMessage || '');
  }

  const iconContent = isFollowed
    ? getSuccessAnimation('light')
    : showAvatar && user && profile?.image
      ? `<img src="${escapeHtml(profile.image)}" alt="${escapeHtml(profile.name || user.npub)}" class="user-avatar" />`
      : getNostrLogo();
  const textContent = isFollowed
    ? 'Followed'
    : `<span>${escapeHtml(customText)}</span>`;

  return renderContainer(iconContent, textContent);
}

function renderLoading(): string {
  return renderContainer(
    getLoadingNostrich(), // Use default values
    '<span>Loading...</span>'
  );
}

function renderFollowing(): string {
  return renderContainer(
    getLoadingNostrich(), // Use default values
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