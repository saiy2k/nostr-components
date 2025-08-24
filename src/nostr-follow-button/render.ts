import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';
import { escapeHtml } from '../common/utils';

export interface RenderFollowButtonOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  isFollowed: boolean;
  isFollowing: boolean;
  errorMessage: string;
  iconWidth: number;
  iconHeight: number;
}

export function renderFollowButton({
  theme,
  isLoading,
  isError,
  isFollowed,
  isFollowing,
  errorMessage,
  iconWidth,
  iconHeight,
}: RenderFollowButtonOptions): string {

  if (isLoading) {
    return renderLoading(theme, iconWidth, iconHeight);
  }

  if (isFollowing) {
    return renderFollowing(theme, iconWidth, iconHeight);
  }

  if (isError) {
    return renderError(errorMessage);
  }

  const buttonText = isFollowed ? 'Followed' : 'Follow';

  return `
    <style>
      .nostr-follow-button svg {
        fill: currentColor;
        width: ${iconWidth}px;
        height: ${iconHeight}px;
        display: inline-block;
        vertical-align: middle;
      }
    </style>
    <div class="nostr-follow-button-container is-clickable">
        <div class='nostr-follow-button-left-container'>
          ${isFollowed
            ? getSuccessAnimation(theme, iconWidth, iconHeight)
            : getNostrLogo(theme, iconWidth, iconHeight)
          }
        </div>
        <div class='nostr-follow-button-right-container'>
          ${isFollowed
            ? buttonText
            : `<span>Follow me on Nostr</span>`
          }
        </div>
    </div>
  `;
}

function renderLoading(theme: Theme, iconWidth: number, iconHeight: number): string {
  return `
      <button class='nostr-follow-button-container is-disabled'>
        <div class='nostr-follow-button-left-container'>
          ${getLoadingNostrich(theme, iconWidth, iconHeight)}
        </div>
        <div class='nostr-follow-button-right-container'>
          <span>Loading...</span>
        </div>
      </button>
    `;
}

function renderFollowing(theme: Theme, iconWidth: number, iconHeight: number): string {
  return `
      <div class='nostr-follow-button-container is-disabled'>
        <div class='nostr-follow-button-left-container'>
          ${getLoadingNostrich(theme, iconWidth, iconHeight)}
        </div>
        <div class='nostr-follow-button-right-container'>
          <span>Following...</span>
        </div>
      </div>
    `;
}

function renderError(errorMessage: string): string {
  return `
      <div class='nostr-follow-button-container is-error'>
        <div class='nostr-follow-button-left-container'>
          <div class="error-icon">&#9888;</div>
        </div>
        <div class='nostr-follow-button-right-container'>
          ${escapeHtml(errorMessage)}
        </div>
      </div>
    `;
}