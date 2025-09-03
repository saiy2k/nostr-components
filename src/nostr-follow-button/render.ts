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
  iconWidth: number;
  iconHeight: number;
}

export function renderFollowButton({
  theme,
  isLoading,
  isError,
  errorMessage,
  isFollowed,
  isFollowing,
  iconWidth,
  iconHeight,
}: RenderFollowButtonOptions): string {

  if (isFollowing) {
    return renderFollowing(theme, iconWidth, iconHeight);
  }

  if (isLoading) {
    return renderLoading(theme, iconWidth, iconHeight);
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
      <div class='nostr-follow-button-container is-disabled'>
        <div class='nostr-follow-button-left-container'>
          ${getLoadingNostrich(theme, iconWidth, iconHeight)}
        </div>
        <div class='nostr-follow-button-right-container'>
          <span>Loading...</span>
        </div>
      </div>
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