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
  totalZapAmount: number | null;
}

export function renderZapButton({
  isLoading,
  isError,
  isSuccess,
  errorMessage,
  buttonText,
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
    : getLightningIcon();
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
  return renderErrorContainer(
    '<div class="error-icon">&#9888;</div>',
    escapeHtml(errorMessage)
  );
}

function renderErrorContainer(leftContent: string, rightContent: string): string {
  return `
    <div class="nostr-zap-button-container">
      <div class="nostr-zap-button-left-container">
        ${leftContent}
      </div>
      <div class="nostr-zap-button-right-container">
        ${rightContent}
      </div>
    </div>
  `;
}

function renderContainer(iconContent: string, textContent: string, totalZapAmount: number | null, isAmountLoading: boolean): string {
  return `
    <div class="nostr-zap-button-container">
      <button class="nostr-zap-button">
        ${iconContent}
        ${textContent}
      </button>
      ${isAmountLoading ? `<span class="total-zap-amount">${getLoadingNostrich()}</span>` : (totalZapAmount !== null ? `<span class="total-zap-amount">${totalZapAmount.toLocaleString()} ⚡</span>` : '')}
    </div>
  `;
}

function getLightningIcon(): string {
  // Yellow lightning regardless of text color
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z" fill="#FFC800"/></svg>`;
}
