// SPDX-License-Identifier: MIT

import {
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

  // Only show loading state when user/profile is loading, not when zap amount is loading
  if (isLoading) {
    return renderLoading(isAmountLoading); // Pass isAmountLoading to show skeleton
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

  // Always show the button when not in loading/error state, with skeleton for zap amount if needed
  return renderContainer(iconContent, textContent, totalZapAmount, isAmountLoading);
}

function renderLoading(isAmountLoading: boolean): string {
  return renderContainer(
    getLightningIcon(), // Use lightning icon instead of nostrich
    '<span class="button-text-skeleton"></span>', // Skeleton for button text
    null,
    isAmountLoading // Pass the isAmountLoading parameter
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
  const zapAmountHtml = isAmountLoading 
    ? `<span class="total-zap-amount skeleton"></span>` 
    : (totalZapAmount !== null ? `<span class="total-zap-amount">${totalZapAmount.toLocaleString()} ⚡ sats received</span>` : '');
  
  const helpIconHtml = `<button class="help-icon" title="What is a zap?">?</button>`;
  
  return `
    <div class="nostr-zap-button-container">
      <button class="nostr-zap-button">
        ${iconContent}
        ${textContent}
      </button>
      ${zapAmountHtml} ${helpIconHtml}
    </div>
  `;
}

function getLightningIcon(): string {
  // Yellow lightning regardless of text color
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h7v8l10-12h-7z" fill="#FFC800"/></svg>`;
}
