// SPDX-License-Identifier: MIT

import { getSuccessAnimation } from '../common/theme';
import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export interface RenderZapButtonOptions extends IRenderOptions {
  isAmountLoading: boolean;
  isSuccess: boolean;
  buttonText: string;
  totalZapAmount: number | null;
  hasZaps?: boolean;
  compact?: boolean;
}

export function renderZapButton({
  isLoading,
  isError,
  isSuccess,
  errorMessage,
  buttonText,
  totalZapAmount,
  isAmountLoading,
  hasZaps = false,
  compact = false,
}: RenderZapButtonOptions): string {

  if (isError) {
    if (compact) {
      return renderContainer(
        getLightningIcon(),
        '',
        null,
        false,
        false,
        true,
        true,
        errorMessage || 'Zap unavailable'
      );
    }
    return renderError(errorMessage || '');
  }

  if (isLoading) {
    return renderLoading(isAmountLoading, compact);
  }

  const iconContent = isSuccess
    ? getSuccessAnimation('light')
    : getLightningIcon();
  const textContent = compact
    ? ''
    : isSuccess
    ? `<span>Zapped</span>`
    : `<span>${escapeHtml(buttonText)}</span>`;

  return renderContainer(
    iconContent,
    textContent,
    totalZapAmount,
    isAmountLoading,
    hasZaps,
    false,
    compact,
    buttonText
  );
}

function renderLoading(isAmountLoading: boolean, compact: boolean): string {
  return renderContainer(
    getLightningIcon(),
    compact ? '' : '<span class="button-text-skeleton"></span>',
    null,
    isAmountLoading,
    false,
    true,
    compact,
    'Loading zap'
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

function renderContainer(
  iconContent: string,
  textContent: string,
  totalZapAmount: number | null,
  isAmountLoading: boolean,
  hasZaps: boolean = false,
  isButtonLoading: boolean = false,
  compact: boolean = false,
  buttonLabel: string = 'Zap'
): string {
  const zapAmountHtml = isAmountLoading 
    ? (compact ? '' : `<span class="total-zap-amount skeleton"></span>`)
    : (totalZapAmount !== null ? `<span class="total-zap-amount${compact ? ' compact-zap-count' : ''}${hasZaps ? ' clickable' : ''}"${hasZaps ? ' role="button" tabindex="0" aria-label="View zappers"' : ''}>${totalZapAmount.toLocaleString()}${compact ? '' : ' ⚡ sats received'}</span>` : '');
  
  const disabledAttrs = isButtonLoading ? ' disabled aria-busy="true"' : '';
  const accessibleAttrs = compact
    ? ` aria-label="${escapeHtml(buttonLabel)}" title="${escapeHtml(buttonLabel)}"`
    : '';
  const helpIconHtml = compact ? '' : `<button type="button" class="help-icon" aria-label="What is a zap?" title="What is a zap?">?</button>`;
  
  return `
    <div class="nostr-zap-button-container${compact ? ' compact' : ''}">
      <button type="button" class="nostr-zap-button"${accessibleAttrs}${disabledAttrs}>
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
