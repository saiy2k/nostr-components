// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getLikeButtonStyles(): string {
  const customStyles = `
    /* === LIKE BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable via CSS variables) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Like button CSS variables (overridable by parent components) */
      --nostrc-like-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-like-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-like-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-like-btn-min-height: 47px;
      --nostrc-like-btn-width: auto;
      --nostrc-like-btn-horizontal-alignment: left;
      --nostrc-like-btn-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-like-btn-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-like-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-like-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-like-btn-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-like-btn-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-like-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Liked state variables */
      --nostrc-like-btn-liked-bg: #e7f3ff;
      --nostrc-like-btn-liked-color: #1877f2;
      --nostrc-like-btn-liked-border: #1877f2;
      --nostrc-like-btn-liked-hover-bg: #d1e7ff;

      /* Make the host a flex container for button + count */
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      font-family: var(--nostrc-like-btn-font-family);
      font-size: var(--nostrc-like-btn-font-size);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    :host(.is-error) .nostr-like-button-container {
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
      border-radius: var(--nostrc-border-radius-md);
      padding: var(--nostrc-spacing-sm);
      color: var(--nostrc-color-error-text);
    }

    .nostr-like-button-container {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }

    .nostr-like-button-left-container {
      display: flex;
      align-items: center;
    }

    .nostr-like-button-right-container {
      display: flex;
      align-items: center;
    }

    .nostr-like-button {
      display: flex;
      align-items: center;
      justify-content: var(--nostrc-like-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-sm);
      background: var(--nostrc-like-btn-bg);
      color: var(--nostrc-like-btn-color);
      border: var(--nostrc-like-btn-border);
      border-radius: var(--nostrc-like-btn-border-radius);
      padding: var(--nostrc-like-btn-padding);
      min-height: var(--nostrc-like-btn-min-height);
      width: var(--nostrc-like-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      font-family: inherit;
      font-size: inherit;
    }

    /* Hover state on the button */
    .nostr-like-button:hover {
      background: var(--nostrc-like-btn-hover-bg);
      color: var(--nostrc-like-btn-hover-color);
      border: var(--nostrc-like-btn-hover-border);
    }

    /* Liked state */
    .nostr-like-button.liked {
      background: var(--nostrc-like-btn-liked-bg);
      color: var(--nostrc-like-btn-liked-color);
      border: var(--nostrc-border-width) solid var(--nostrc-like-btn-liked-border);
    }

    .nostr-like-button.liked:hover {
      background: var(--nostrc-like-btn-liked-hover-bg);
    }

    .nostr-like-button:disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.6;
    }

    :host:not([status="ready"]) .nostr-like-button {
      cursor: not-allowed;
    }

    /* SVG Icon Styles */
    .nostr-like-button svg {
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }

    /* Like count display */
    .like-count {
      font-size: var(--nostrc-font-size-sm);
      color: var(--nostrc-theme-text-secondary, #666666);
      white-space: nowrap;
      text-decoration: underline;
      text-decoration-color: transparent;
      transition: text-decoration-color 0.2s ease, color 0.2s ease;
    }

    /* Clickable like count */
    .like-count.clickable {
      cursor: pointer;
      text-decoration-color: currentColor;
    }

    .like-count.clickable:hover {
      color: var(--nostrc-color-primary, #7f00ff);
      text-decoration-color: var(--nostrc-color-primary, #7f00ff);
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

    /* Skeleton loader for like count */
    .like-count.skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-skeleton-color-min) 25%, 
        var(--nostrc-skeleton-color-max) 50%, 
        var(--nostrc-skeleton-color-min) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
      border-radius: var(--nostrc-border-radius-sm);
      width: 80px;
      height: 1.2em;
      display: inline-block;
    }

    /* Skeleton loader for button text */
    .button-text-skeleton {
      background: linear-gradient(90deg, 
        var(--nostrc-skeleton-color-min) 25%, 
        var(--nostrc-skeleton-color-max) 50%, 
        var(--nostrc-skeleton-color-min) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing-function) var(--nostrc-skeleton-iteration-count);
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
    .nostr-like-button-error small {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-sm);
      line-height: 1em;
      max-width: 250px;
      white-space: pre-line;
    }
  `;
  
  return getComponentStyles(customStyles);
}
