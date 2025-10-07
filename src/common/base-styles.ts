// SPDX-License-Identifier: MIT

import { styleUtils } from './design-tokens';

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
 * Uses generic CSS variables that can be overridden by data-theme
 */
export function getBaseStyles(): string {
  return `
      :host {
        /* === GENERIC DESIGN TOKENS === */
        --nostrc-color-background: #ffffff;
        --nostrc-color-hover-background: rgba(0, 0, 0, 0.05);
        --nostrc-color-text-primary: #333333;
        --nostrc-color-text-secondary: #666666;
        --nostrc-color-text-muted: #808080;
        --nostrc-color-border: #e0e0e0;
        --nostrc-color-error-background: #ffebee;
        --nostrc-color-error-text: #d32f2f;
        --nostrc-color-error-icon: #d32f2f;
        --nostrc-color-accent: #ca077c;
        
        /* === TYPOGRAPHY === */
        --nostrc-font-family-primary: Inter, sans-serif;
        --nostrc-font-family-mono: monospace;
        --nostrc-font-size-base: 1em;
        --nostrc-font-size-small: 0.8em;
        --nostrc-font-size-large: 1.2em;
        --nostrc-font-weight-normal: 400;
        --nostrc-font-weight-medium: 500;
        --nostrc-font-weight-bold: 700;
        
        /* === SPACING === */
        --nostrc-spacing-xs: 4px;
        --nostrc-spacing-sm: 8px;
        --nostrc-spacing-md: 12px;
        --nostrc-spacing-lg: 16px;
        --nostrc-spacing-xl: 20px;
        
        /* === BORDERS === */
        --nostrc-border-radius-sm: 4px;
        --nostrc-border-radius-md: 8px;
        --nostrc-border-radius-lg: 12px;
        --nostrc-border-radius-full: 50%;
        --nostrc-border-width: 1px;
        
        /* === SKELETON === */
        --nostrc-skeleton-color-min: #f0f0f0;
        --nostrc-skeleton-color-max: #e0e0e0;
        --nostrc-skeleton-duration: 1.5s;
        --nostrc-skeleton-timing-function: linear;
        --nostrc-skeleton-iteration-count: infinite;
        
        /* === TRANSITIONS === */
        --nostrc-transition-duration: 0.2s;
        --nostrc-transition-timing: ease;
      }
      
      /* === GENERIC CONTAINER STYLES === */
      :host(.is-clickable) .nostrc-container {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      :host(.is-clickable) .nostrc-container:hover {
        background-color: var(--nostrc-theme-hover-bg, var(--nostrc-color-hover-background));
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
  `;
}

/**
 * Generates component-specific styles by combining base styles with custom styles
 * Uses CSS theme variables instead of theme prop
 */
export function getComponentStyles(customStyles: string): string {
  return `
    <style>
      ${getBaseStyles()}
      /* === COMPONENT-SPECIFIC STYLES === */
      ${customStyles}
    </style>
  `;
}