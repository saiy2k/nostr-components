import { Theme } from '../common/types';
import {
  getLoadingNostrich,
  getSuccessAnimation,
} from '../common/theme';

export interface RenderZapButtonOptions {
  /** Shows loader next to zap count while fetching */
  isAmountLoading: boolean;
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  errorMessage: string;
  buttonText: string;

  iconWidth: number;
  iconHeight: number;
  totalZapAmount: number | null;
}

export function renderZapButton({
  theme,
  isLoading,
  isError,
  isSuccess,
  errorMessage,
  buttonText,
  iconWidth,
  iconHeight,
  totalZapAmount,
  isAmountLoading,
}: RenderZapButtonOptions): string {


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
        <button class="nostr-zap-button" ${isLoading || isError ? 'disabled' : ''}>
          ${
            isError
              ? `<span>ERROR</span>`
              : isLoading
                ? `${getLoadingNostrich(theme, iconWidth, iconHeight)} <span>Zapping...</span>`
                : isSuccess
                  ? `${getSuccessAnimation(theme, iconWidth, iconHeight)} ${buttonText}`
                  : `${getLightningIcon(iconWidth, iconHeight)} <span>${buttonText}</span>`
          }
        </button>
        ${isAmountLoading ? `${getLoadingNostrich(theme, 18, 18)}` : (totalZapAmount !== null ? `<span class="total-zap-amount">${totalZapAmount.toLocaleString()} ⚡</span>` : '')}
      </div>
      ${isError ? `<small>${errorMessage}</small>` : ''}
    </div>
  `;
}

function getLightningIcon(w: number, h: number): string {
  // Yellow lightning regardless of text color
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z" fill="#FFC800"/></svg>`;
}

export function getZapButtonStyles(theme: Theme, isLoading: boolean): string {
  const safeTheme = theme === 'dark' ? 'dark' : 'light';

  return `
    <style>
      :host {
        --nstrc-zap-btn-padding: 10px 16px;
        --nstrc-zap-btn-font-size: 16px;
        --nstrc-zap-btn-bg: var(--nstrc-zap-btn-background-${safeTheme});
        --nstrc-zap-btn-color: var(--nstrc-zap-btn-text-color-${safeTheme});
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
        align-items: center;
        gap: 8px;
      }
      .nostr-zap-button {
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: var(--nstrc-zap-btn-border-radius);
        background-color: var(--nstrc-zap-btn-bg);
        cursor: pointer;
        min-height: var(--nstrc-zap-btn-min-height);
        border: var(--nstrc-zap-btn-border-${safeTheme});
        padding: var(--nstrc-zap-btn-padding);
        font-size: var(--nstrc-zap-btn-font-size);
        color: var(--nstrc-zap-btn-color);
        ${isLoading ? `pointer-events: none; user-select: none; background-color: var(--nstrc-zap-btn-hover-background-${safeTheme});` : ''}
      }
      .nostr-zap-button:hover {
        background-color: var(--nstrc-zap-btn-hover-background-${safeTheme});
      }
      .nostr-zap-button:disabled {
        pointer-events: none;
        user-select: none;
        opacity: 0.6;
      }
        background-color: var(--nstrc-zap-btn-hover-background-${safeTheme});
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
