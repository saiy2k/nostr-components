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
 * Generates base styles for any Nostr component
 * Includes design tokens and common utility styles
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
      
      /* === COMMON UTILITY STYLES === */
      ${styleUtils.skeleton()}
      ${styleUtils.copyButton()}
      ${styleUtils.errorIcon()}
      
      /* === COMMON COMPONENT PATTERNS === */
      
      /* Container with background and border */
      .nostr-container {
        background-color: var(--nostrc-color-background);
        border: var(--nostrc-border-width) solid var(--nostrc-color-border);
        border-radius: var(--nostrc-border-radius-md);
        padding: var(--nostrc-spacing-lg);
        transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      }
      
      .nostr-container.is-clickable:hover {
        cursor: pointer;
        background-color: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      }
      
      .nostr-container.is-error {
        color: var(--nostrc-color-error-text);
      }
      
      /* Avatar/Image styles */
      .nostr-avatar {
        border-radius: var(--nostrc-border-radius-full);
        object-fit: cover;
      }
      
      /* Text styles */
      .nostr-text-primary {
        color: var(--nostrc-color-text-primary);
        font-weight: var(--nostrc-font-weight-bold);
      }
      
      .nostr-text-secondary {
        color: var(--nostrc-color-text-secondary);
        font-weight: var(--nostrc-font-weight-medium);
      }
      
      .nostr-text-muted {
        color: var(--nostrc-color-text-muted);
        font-weight: var(--nostrc-font-weight-normal);
      }
      
      .nostr-text-mono {
        font-family: var(--nostrc-font-family-mono);
        font-size: var(--nostrc-font-size-small);
      }
      
      /* Flex layouts */
      .nostr-flex-row {
        display: flex;
        align-items: center;
        gap: var(--nostrc-spacing-md);
      }
      
      .nostr-flex-column {
        display: flex;
        flex-direction: column;
        gap: var(--nostrc-spacing-sm);
      }
      
      .nostr-flex-grow {
        flex-grow: 1;
        min-width: 0;
      }
      
      .nostr-flex-shrink {
        flex-shrink: 0;
      }
      
      /* Copy row pattern */
      .nostr-copy-row {
        display: flex;
        align-items: center;
        gap: var(--nostrc-spacing-xs);
        font-family: var(--nostrc-font-family-mono);
        font-size: var(--nostrc-font-size-small);
        color: var(--nostrc-color-text-muted);
      }
      
      /* Badge row pattern */
      .nostr-badge-row {
        display: flex;
        align-items: center;
        gap: var(--nostrc-spacing-xs);
        font-family: var(--nostrc-font-family-mono);
        font-size: var(--nostrc-font-size-small);
        color: var(--nostrc-color-text-muted);
      }
      
      /* Loading states */
      .nostr-loading {
        opacity: 0.6;
        pointer-events: none;
      }
      
      /* Error states */
      .nostr-error {
        color: var(--nostrc-color-error-text);
        display: flex;
        align-items: center;
        gap: var(--nostrc-spacing-sm);
      }
      
      /* Responsive text overflow */
      .nostr-text-ellipsis {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Clickable elements */
      .nostr-clickable {
        cursor: pointer;
        transition: opacity var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      }
      
      .nostr-clickable:hover {
        opacity: 0.8;
      }
      
      /* Focus styles for accessibility */
      .nostr-focusable:focus {
        outline: 2px solid var(--nostrc-color-accent);
        outline-offset: 2px;
      }
      
      /* Common spacing utilities */
      .nostr-p-xs { padding: var(--nostrc-spacing-xs); }
      .nostr-p-sm { padding: var(--nostrc-spacing-sm); }
      .nostr-p-md { padding: var(--nostrc-spacing-md); }
      .nostr-p-lg { padding: var(--nostrc-spacing-lg); }
      .nostr-p-xl { padding: var(--nostrc-spacing-xl); }
      
      .nostr-m-xs { margin: var(--nostrc-spacing-xs); }
      .nostr-m-sm { margin: var(--nostrc-spacing-sm); }
      .nostr-m-md { margin: var(--nostrc-spacing-md); }
      .nostr-m-lg { margin: var(--nostrc-spacing-lg); }
      .nostr-m-xl { margin: var(--nostrc-spacing-xl); }
      
      .nostr-gap-xs { gap: var(--nostrc-spacing-xs); }
      .nostr-gap-sm { gap: var(--nostrc-spacing-sm); }
      .nostr-gap-md { gap: var(--nostrc-spacing-md); }
      .nostr-gap-lg { gap: var(--nostrc-spacing-lg); }
      .nostr-gap-xl { gap: var(--nostrc-spacing-xl); }
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
 * Common style patterns that can be reused across components
 */
export const commonPatterns = {
  /**
   * Profile badge container pattern
   */
  profileBadge: () => `
    .nostr-profile-badge-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      border-radius: var(--nostrc-border-radius-md);
      background-color: var(--nostrc-color-background);
      border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      padding: var(--nostrc-spacing-lg);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }
    
    .nostr-profile-badge-container.is-clickable:hover {
      cursor: pointer;
      background-color: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
    }
    
    .nostr-profile-badge-left-container {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }
    
    .nostr-profile-badge-right-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-grow: 1;
      min-width: 0;
    }
  `,
  
  /**
   * Follow button container pattern
   */
  followButton: () => `
    .nostr-follow-button-container {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      width: 100%;
      padding: var(--nostrc-spacing-lg);
      border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      border-radius: var(--nostrc-border-radius-md);
      box-sizing: border-box;
      overflow: hidden;
      background-color: var(--nostrc-color-background);
      font-family: var(--nostrc-font-family-primary);
      font-size: var(--nostrc-font-size-base);
      color: var(--nostrc-color-text-primary);
    }
    
    .nostr-follow-button-container.is-clickable:hover {
      background-color: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      cursor: pointer;
    }
  `,
  
  /**
   * Profile container pattern
   */
  profile: () => `
    .nostr-profile-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--nostrc-spacing-md);
      width: 100%;
      min-height: 500px;
      box-sizing: border-box;
      border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      border-radius: var(--nostrc-border-radius-sm);
      background-repeat: no-repeat;
      background-color: var(--nostrc-color-background);
      font-family: var(--nostrc-font-family-primary);
      font-size: var(--nostrc-font-size-base);
      overflow-wrap: break-word;
    }
    
    .nostr-profile-container.is-clickable:hover {
      cursor: pointer;
      background-color: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
    }
  `,
};
