import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getNostrLogo,
  getSuccessAnimation,
} from '../common/theme';

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

export function getFollowButtonStyles(
  theme: Theme,
  isLoading: boolean
): string {
  return `
    <style>
      :host {
        --nstrc-follow-btn-padding: 10px 16px;
        --nstrc-follow-btn-font-size: 16px;
        --nstrc-follow-btn-background-dark: #000000;
        --nstrc-follow-btn-background-light: #FFFFFF;
        --nstrc-follow-btn-hover-background-dark: #222222;
        --nstrc-follow-btn-hover-background-light: #F9F9F9;
        --nstrc-follow-btn-border-dark: none;
        --nstrc-follow-btn-border-light: 1px solid #DDDDDD;
        --nstrc-follow-btn-text-color-dark: #FFFFFF;
        --nstrc-follow-btn-text-color-light: #000000;
        --nstrc-follow-btn-border-radius: 8px;
        --nstrc-follow-btn-error-font-size: 12px;
        --nstrc-follow-btn-error-line-height: 1em;
        --nstrc-follow-btn-error-max-width: 250px;
        --nstrc-follow-btn-horizontal-alignment: start;
        --nstrc-follow-btn-min-height: 47px;
        --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-${theme});
        --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-${theme});
        --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-${theme});
        --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-${theme});
      }

      .nostr-follow-button-container {
        display: flex;
        flex-direction: column;
        font-family: Inter, sans-serif;
        gap: 8px;
        width: fit-content;
      }

      .nostr-follow-button-wrapper {
        display: flex;
        justify-content: var(--nstrc-follow-btn-horizontal-alignment);
      }
      
      .nostr-follow-button {
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: var(--nstrc-follow-btn-border-radius);
        background-color: var(--nstrc-follow-btn-background);
        cursor: pointer;
        min-height: var(--nstrc-follow-btn-min-height);
        border: var(--nstrc-follow-btn-border);
        padding: var(--nstrc-follow-btn-padding);
        font-size: var(--nstrc-follow-btn-font-size);
        color: var(--nstrc-follow-btn-text-color);
        ${isLoading ? 'pointer-events: none; user-select: none; background-color: var(--nstrc-follow-btn-hover-background);' : ''}
      }

      .nostr-follow-button:hover {
        background-color: var(--nstrc-follow-btn-hover-background);
      }

      .nostr-follow-button-error small {
        justify-content: flex-end;
        color: red;
        font-size: var(--nstrc-follow-btn-error-font-size);
        line-height: var(--nstrc-follow-btn-error-line-height);
        max-width: var(--nstrc-follow-btn-error-max-width);
        white-space: pre-line;
      }

      .nostr-follow-button-container a {
        color: #3b82f6;
        text-decoration: underline;
      }
    </style>
  `;
}
