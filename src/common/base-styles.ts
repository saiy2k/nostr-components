// SPDX-License-Identifier: MIT

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
        --nostrc-font-family-primary: ui-sans-serif, system-ui, sans-serif;
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

export const styleUtils = {
  /**
   * Generates error state styles
   */
  error: () => `
    :host(.is-error) {
      color: var(--nostrc-color-error-text);
    }
  `,
  
  /**
   * Generates skeleton loading styles
   */
  skeleton: () => `
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--nostrc-skeleton-color-min) 0%,
        var(--nostrc-skeleton-color-max) 50%,
        var(--nostrc-skeleton-color-min) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
      border-radius: var(--nostrc-border-radius-sm);
      height: 16px;
      margin-bottom: var(--nostrc-spacing-xs);
    }
    
    .skeleton:last-child {
      margin-bottom: 0;
    }
    
    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton { animation: none; }
    }
  `,
  
  /**
   * Generates copy button styles
   */
  copyButton: () => `
    .nc-copy-btn {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      font-size: 1.5em;
      border: none;
      background: transparent;
      color: var(--nostrc-color-text-muted);
    }
    
    .nc-copy-btn:hover {
      opacity: 1;
    }
    
    .nc-copy-btn.copied {
      color: var(--nostrc-color-accent);
    }
  `,
  
  /**
   * Generates profile name styles
   */
  profileName: () => `
    .nostr-profile-name {
      color: var(--nostrc-color-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      padding-bottom: var(--nostrc-spacing-xs);
    }
  `,
  
  /**
   * Generates text row styles
   */
  textRow: () => `
    .text-row {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      font-size: var(--nostrc-font-size-base);
    }
    
    .text-row.mono {
      font-family: var(--nostrc-font-family-mono);
      font-size: var(--nostrc-font-size-small);
    }
  `,
  
  /**
   * Generates error icon styles
   */
  errorIcon: () => `
    .error-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-background);
      color: var(--nostrc-color-error-icon);
      font-size: 2em;
    }
  `,
  
};
