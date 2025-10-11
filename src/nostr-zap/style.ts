// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getZapButtonStyles(): string {
  const customStyles = `
    /* === ZAP BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable) */
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

      /* Make the host the visual button surface */
      display: inline-flex;
      align-items: center;
      justify-content: var(--nostrc-zap-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-md);
      background: var(--nostrc-zap-btn-bg);
      color: var(--nostrc-zap-btn-color);
      border: var(--nostrc-zap-btn-border);
      border-radius: var(--nostrc-zap-btn-border-radius);
      font-family: var(--nostrc-zap-btn-font-family);
      font-size: var(--nostrc-zap-btn-font-size);
      min-height: var(--nostrc-zap-btn-min-height);
      width: var(--nostrc-zap-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-zap-btn-hover-bg);
      color: var(--nostrc-zap-btn-hover-color);
      border: var(--nostrc-zap-btn-hover-border);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-zap-button-container {
      color: var(--nostrc-color-error-text);
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }

    .nostr-zap-button-container {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
      width: fit-content;
    }

    .nostr-zap-button-wrapper {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-zap-btn-padding);
    }

    .nostr-zap-button {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      color: inherit;
    }

    .nostr-zap-button:disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.6;
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

    /* Error message styling */
    .nostr-zap-button-error small {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-sm);
      line-height: 1em;
      max-width: 250px;
      white-space: pre-line;
    }
  `;
  
  // Use component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(customStyles);
}

