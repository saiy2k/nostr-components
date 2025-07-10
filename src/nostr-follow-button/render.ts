import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';
import { getFollowButtonStyles } from './style';

export interface RenderFollowButtonOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  isFollowed: boolean;
  errorMessage: string;
  iconWidth: number;
  iconHeight: number;
}

export function renderFollowButton({
  theme,
  isLoading,
  isError,
  isFollowed,
  errorMessage,
  iconWidth,
  iconHeight,
}: RenderFollowButtonOptions): string {
  const buttonText = isFollowed ? 'Followed' : 'Follow';

  return `
    ${getFollowButtonStyles(theme, isLoading)}
    <style>
      .nostr-follow-button svg {
        fill: currentColor;
        width: ${iconWidth}px;
        height: ${iconHeight}px;
        display: inline-block;
        vertical-align: middle;
      }
    </style>
    <div class="nostr-follow-button-container ${isError ? 'nostr-follow-button-error' : ''}">
      <div class="nostr-follow-button-wrapper">
        <button class="nostr-follow-button">
          ${
            isLoading
              ? `${getLoadingNostrich(theme, iconWidth, iconHeight)} <span>Following...</span>`
              : isFollowed
                ? `${getSuccessAnimation(theme, iconWidth, iconHeight)} ${buttonText}`
                : `${getNostrLogo(iconWidth, iconHeight)} <span>Follow me on Nostr</span>`
          }
        </button>
      </div>
      ${isError ? `<small>${errorMessage}</small>` : ''}
    </div>
  `;
}
