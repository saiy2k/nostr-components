// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getZapButtonStyles(): string {
  const customStyles = `
    /* === ZAP BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable via CSS variables) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Zap button CSS variables (overridable by parent components) */
      --nostrc-zap-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-zap-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-zap-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-zap-btn-min-height: 47px;
      --nostrc-zap-btn-width: auto;
      --nostrc-zap-btn-horizontal-alignment: left;
      --nostrc-zap-btn-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-zap-btn-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-zap-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-zap-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-zap-btn-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-zap-btn-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-zap-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host a flex container for button + amount */
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      font-family: var(--nostrc-zap-btn-font-family);
      font-size: var(--nostrc-zap-btn-font-size);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-zap-button-container {
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
      border-radius: var(--nostrc-border-radius-md);
      padding: var(--nostrc-spacing-sm);
      color: var(--nostrc-color-error-text);
    }

    .nostr-zap-button-container {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }

    .nostr-zap-button-left-container {
      display: flex;
      align-items: center;
    }

    .nostr-zap-button-right-container {
      display: flex;
      align-items: center;
    }

    .nostr-zap-button {
      display: flex;
      align-items: center;
      justify-content: var(--nostrc-zap-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-sm);
      background: var(--nostrc-zap-btn-bg);
      color: var(--nostrc-zap-btn-color);
      border: var(--nostrc-zap-btn-border);
      border-radius: var(--nostrc-zap-btn-border-radius);
      padding: var(--nostrc-zap-btn-padding);
      min-height: var(--nostrc-zap-btn-min-height);
      width: var(--nostrc-zap-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      font-family: inherit;
      font-size: inherit;
    }

    /* Hover state on the button */
    .nostr-zap-button:hover {
      background: var(--nostrc-zap-btn-hover-bg);
      color: var(--nostrc-zap-btn-hover-color);
      border: var(--nostrc-zap-btn-hover-border);
    }

    .nostr-zap-button:disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.6;
    }

    :host:not([user-status="ready"]) .nostr-zap-button {
      cursor: not-allowed;
    }

    /* SVG Icon Styles */
    .nostr-zap-button svg {
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }

    /* Total zap amount display */
    .total-zap-amount {
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-theme-text-secondary, #666666);
      white-space: nowrap;
    }

    /* Clickable zap amount */
    .total-zap-amount.clickable {
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .total-zap-amount.clickable:hover {
      color: var(--nostrc-color-primary, #7f00ff);
    }

    /* Help icon */
    .help-icon {
      background: none;
      border: 1px solid var(--nostrc-color-border, #e0e0e0);
      border-radius: var(--nostrc-border-radius-full, 50%);
      width: var(--nostrc-help-icon-size, 16px);
      height: var(--nostrc-help-icon-size, 16px);
      font-size: calc(var(--nostrc-help-icon-size, 16px) * 0.7);
      font-weight: bold;
      color: var(--nostrc-theme-text-secondary, #666666);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: var(--nostrc-spacing-xs, 4px);
      transition: all 0.2s ease;
    }

    .help-icon:hover {
      background: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      border-color: var(--nostrc-color-primary, #7f00ff);
      color: var(--nostrc-color-primary, #7f00ff);
    }

    /* Skeleton loader for zap amount */
    .total-zap-amount.skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-color-skeleton, #f0f0f0) 25%, 
        var(--nostrc-color-skeleton-highlight, #e0e0e0) 50%, 
        var(--nostrc-color-skeleton, #f0f0f0) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: var(--nostrc-border-radius-sm);
      width: 80px;
      height: 1.2em;
      display: inline-block;
    }

    /* Skeleton loader for button text */
    .button-text-skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-color-skeleton, #f0f0f0) 25%, 
        var(--nostrc-color-skeleton-highlight, #e0e0e0) 50%, 
        var(--nostrc-color-skeleton, #f0f0f0) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: var(--nostrc-border-radius-sm);
      width: 60px;
      height: 1em;
      display: inline-block;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    /* Error message styling */
    .nostr-zap-button-error small {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-sm);
      line-height: 1em;
      max-width: 250px;
      white-space: pre-line;
    }
  `;
  
  return getComponentStyles(customStyles);
}

