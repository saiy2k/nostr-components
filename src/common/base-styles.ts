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
        /* === DESIGN TOKENS === */
        ${generateDesignTokenCSS(theme, defaultDesignTokens)}
        
        /* === BASE COMPONENT STYLES === */
        display: block;
        contain: content;
        box-sizing: border-box;
        font-family: var(--nostrc-font-family-primary);
        font-size: var(--nostrc-font-size-base);
      }
      
      /* === ESSENTIAL UTILITY STYLES === */
      ${styleUtils.skeleton()}
      ${styleUtils.copyButton()}
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

/**
 * Generates optimized component styles with custom patterns
 * Use this for components that need specific patterns without bloat
 */
export function getOptimizedComponentStyles(theme: Theme, patterns: string[], customStyles: string): string {
  const selectedPatterns = patterns.join('\n');
  
  return `
    <style>
      :host {
        /* === DESIGN TOKENS === */
        ${generateDesignTokenCSS(theme, defaultDesignTokens)}
        
        /* === BASE COMPONENT STYLES === */
        display: block;
        contain: content;
        box-sizing: border-box;
        font-family: var(--nostrc-font-family-primary);
        font-size: var(--nostrc-font-size-base);
      }
      
      /* === ESSENTIAL UTILITIES === */
      ${styleUtils.skeleton()}
      ${styleUtils.copyButton()}
      ${styleUtils.errorIcon()}
      
      /* === SELECTED PATTERNS === */
      ${selectedPatterns}
      
      /* === COMPONENT-SPECIFIC STYLES === */
      ${customStyles}
    </style>
  `;
}

