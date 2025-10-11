// SPDX-License-Identifier: MIT

import {
  getLoadingNostrich,
  getSuccessAnimation,
} from '../common/theme';
import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export interface RenderZapButtonOptions extends IRenderOptions {
  /** Shows loader next to zap count while fetching */
  isAmountLoading: boolean;
  isSuccess: boolean;
  buttonText: string;
  iconWidth: number;
  iconHeight: number;
  totalZapAmount: number | null;
}

export function renderZapButton({
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

  if (isLoading) {
    return renderLoading();
  }

  if (isError) {
    return renderError(errorMessage || '');
  }

  const iconContent = isSuccess
    ? getSuccessAnimation('light')
    : getLightningIcon(iconWidth, iconHeight);
  const textContent = isSuccess
    ? escapeHtml(buttonText)
    : `<span>${escapeHtml(buttonText)}</span>`;

  return renderContainer(iconContent, textContent, totalZapAmount, isAmountLoading);
}

function renderLoading(): string {
  return renderContainer(
    getLoadingNostrich(),
    '<span>Zapping...</span>',
    null,
    false
  );
}

function renderError(errorMessage: string): string {
  return `
    <div class="nostr-zap-button-container nostr-zap-button-error">
      <div class="nostr-zap-button-wrapper">
        <button class="nostr-zap-button" disabled>
          <span style="color: red">ERROR</span>
        </button>
      </div>
      <small style="color: red">${escapeHtml(errorMessage)}</small>
    </div>
  `;
}

function renderContainer(iconContent: string, textContent: string, totalZapAmount: number | null, isAmountLoading: boolean): string {
  return `
    <div class="nostr-zap-button-container">
      <div class="nostr-zap-button-wrapper">
        <button class="nostr-zap-button">
          ${iconContent}
          ${textContent}
        </button>
        ${isAmountLoading ? `${getLoadingNostrich()}` : (totalZapAmount !== null ? `<span class="total-zap-amount">${totalZapAmount.toLocaleString()} ⚡</span>` : '')}
      </div>
    </div>
  `;
}

function getLightningIcon(w: number, h: number): string {
  // Yellow lightning regardless of text color
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z" fill="#FFC800"/></svg>`;
}
