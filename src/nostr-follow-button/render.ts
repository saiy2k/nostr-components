// SPDX-License-Identifier: MIT

import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';
import { Theme } from '../common/types';
import { escapeHtml, sanitizeUrl } from '../common/utils';
import { IRenderOptions } from '../base/render-options';
import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';

export interface RenderFollowButtonOptions extends IRenderOptions {
  theme?: Theme;
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
  theme = 'light',
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

  const avatarUrl = sanitizeUrl(profile?.image || profile?.picture || '');
  const iconContent = isFollowed
    ? getSuccessAnimation(theme)
    : showAvatar && user && avatarUrl
      ? `<img src="${avatarUrl}" alt="${escapeHtml(profile?.displayName || profile?.name || user.npub)}" class="user-avatar" />`
      : getNostrLogo();
  const textContent = isFollowed
    ? 'Followed'
    : `<span>${escapeHtml(customText)}</span>`;

  return renderContainer(iconContent, textContent);
}

function renderLoading(): string {
  return renderContainer(
    getLoadingNostrich(), // Use default values
    '<span>Loading...</span>',
  );
}

function renderFollowing(): string {
  return renderContainer(
    getLoadingNostrich(), // Use default values
    '<span>Following...</span>',
  );
}

function renderError(errorMessage: string): string {
  return renderContainer(
    '<div class="error-icon">&#9888;</div>',
    escapeHtml(errorMessage),
  );
}

function renderContainer(leftContent: string, rightContent: string): string {
  return `
    <div class='nostr-follow-button-container'>
      <div class='nostr-follow-button-left-container'>
        ${leftContent}
      </div>
      <div class='nostr-follow-button-right-container'>
        ${rightContent}
      </div>
    </div>
  `;
}
