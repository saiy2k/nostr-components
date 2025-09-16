// SPDX-License-Identifier: MIT

import { Theme } from './types';
import { generateDesignTokenCSS, styleUtils, defaultDesignTokens } from './design-tokens';

/**
 * Base Styles Utility for Nostr Components
 * =========================================
 * 
 * This utility provides common base styles that can be shared across components.
 * It includes design tokens, common patterns, and utility functions.
 */

/**
 * Generates minimal base styles for any Nostr component
 * Includes only essential design tokens and base component styles
 */
export function getBaseStyles(theme: Theme): string {
  return `
    <style>
      :host {
        ${generateDesignTokenCSS(theme, defaultDesignTokens)}
      }
      
      /* === GENERIC CONTAINER STYLES === */
      .nostrc-container {
        display: block;
        font-family: var(--nostrc-font-family-primary);
        font-size: var(--nostrc-font-size-base);
        background-color: var(--nostrc-color-background);
        border-radius: var(--nostrc-border-radius-md);
        border: var(--nostrc-border-width) solid var(--nostrc-color-border);
        padding: var(--nostrc-spacing-md);
        transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      }
      
      :host(.is-clickable) .nostrc-container {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      :host(.is-clickable) .nostrc-container:hover {
        background-color: var(--nostrc-color-hover-background);
      }
      
      :host(.is-disabled) {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      :host(.is-error) .nostrc-container {
        color: var(--nostrc-color-error-text);
        border-color: var(--nostrc-color-error-text);
        cursor: not-allowed;
      }
      
      /* === ESSENTIAL UTILITY STYLES === */
      ${styleUtils.skeleton()}
      ${styleUtils.copyButton()}
      ${styleUtils.textRow()}
      ${styleUtils.profileName()}
      ${styleUtils.errorIcon()}
    </style>
  `;
}

/**
 * Generates component-specific styles by combining base styles with custom styles
 */
export function getComponentStyles(theme: Theme, customStyles: string): string {
  return `
    ${getBaseStyles(theme)}
    <style>
      /* === COMPONENT-SPECIFIC STYLES === */
      ${customStyles}
    </style>
  `;
}