import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getSuccessAnimation,
} from '../common/theme';

export interface RenderZapButtonOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  errorMessage: string;
  buttonText: string;
  buttonColor?: string | null;
  iconWidth: number;
  iconHeight: number;
}

export function renderZapButton({
  theme,
  isLoading,
  isError,
  isSuccess,
  errorMessage,
  buttonText,
  buttonColor,
  iconWidth,
  iconHeight,
}: RenderZapButtonOptions): string {
  const backgroundColorStyle = buttonColor ? `background-color: ${buttonColor}; color: ${getTextColor(buttonColor)};` : '';

  return `
    ${getZapButtonStyles(theme, isLoading)}
    <style>
      .nostr-zap-button svg {
        fill: currentColor;
        width: ${iconWidth}px;
        height: ${iconHeight}px;
        display: inline-block;
        vertical-align: middle;
      }
    </style>
    <div class="nostr-zap-button-container ${isError ? 'nostr-zap-button-error' : ''}">
      <div class="nostr-zap-button-wrapper">
        <button class="nostr-zap-button" style="${backgroundColorStyle}">
          ${
            isLoading
              ? `${getLoadingNostrich(theme, iconWidth, iconHeight)} <span>Zapping...</span>`
              : isSuccess
                ? `${getSuccessAnimation(theme, iconWidth, iconHeight)} ${buttonText}`
                : `${getLightningIcon(iconWidth, iconHeight)} <span>${buttonText}</span>`
          }
        </button>
      </div>
      ${isError ? `<small>${errorMessage}</small>` : ''}
    </div>
  `;
}

function getLightningIcon(w: number, h: number): string {
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z"/></svg>`;
}

export function getZapButtonStyles(theme: Theme, isLoading: boolean): string {
  return `
    <style>
      :host {
        --nstrc-zap-btn-padding: 10px 16px;
        --nstrc-zap-btn-font-size: 16px;
        --nstrc-zap-btn-background-dark: #000000;
        --nstrc-zap-btn-background-light: #ffffff;
        --nstrc-zap-btn-hover-background-dark: #222222;
        --nstrc-zap-btn-hover-background-light: #f9f9f9;
        --nstrc-zap-btn-text-color-dark: #ffffff;
        --nstrc-zap-btn-text-color-light: #000000;
        --nstrc-zap-btn-border-dark: none;
        --nstrc-zap-btn-border-light: 1px solid #dddddd;
        --nstrc-zap-btn-border-radius: 8px;
        --nstrc-zap-btn-error-font-size: 12px;
        --nstrc-zap-btn-error-line-height: 1em;
        --nstrc-zap-btn-error-max-width: 250px;
        --nstrc-zap-btn-min-height: 47px;
      }
      .nostr-zap-button-container {
        display: flex;
        flex-direction: column;
        font-family: Inter, sans-serif;
        gap: 8px;
        width: fit-content;
      }
      .nostr-zap-button-wrapper {
        display: flex;
        justify-content: start;
      }
      .nostr-zap-button {
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: var(--nstrc-zap-btn-border-radius);
        background-color: var(--nstrc-zap-btn-background-${theme});
        cursor: pointer;
        min-height: var(--nstrc-zap-btn-min-height);
        border: var(--nstrc-zap-btn-border-${theme});
        padding: var(--nstrc-zap-btn-padding);
        font-size: var(--nstrc-zap-btn-font-size);
        color: var(--nstrc-zap-btn-text-color-${theme});
        ${isLoading ? 'pointer-events: none; user-select: none; background-color: var(--nstrc-zap-btn-hover-background-${theme});' : ''}
      }
      .nostr-zap-button:hover {
        background-color: var(--nstrc-zap-btn-hover-background-${theme});
      }
      .nostr-zap-button-error small {
        color: red;
        font-size: var(--nstrc-zap-btn-error-font-size);
        line-height: var(--nstrc-zap-btn-error-line-height);
        max-width: var(--nstrc-zap-btn-error-max-width);
        white-space: pre-line;
      }
    </style>
  `;
}

function getTextColor(background: string) {
  const hex = background.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128 ? '#fff' : '#000';
}
