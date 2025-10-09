// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getFollowButtonStyles(): string {
  const customStyles = `
    /* === FOLLOW BUTTON CONTAINER PATTERN === */
    :host {
      /* Icon sizing (overridable) */
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;

      /* Follow button CSS variables (overridable by parent components) */
      --nostrc-follow-btn-padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-md);
      --nostrc-follow-btn-border-radius: var(--nostrc-border-radius-md);
      --nostrc-follow-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-follow-btn-min-height: auto;
      --nostrc-follow-btn-width: auto;
      --nostrc-follow-btn-horizontal-alignment: left;
      --nostrc-follow-btn-bg: var(--nostrc-theme-bg, var(--nostrc-color-background));
      --nostrc-follow-btn-color: var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary));
      --nostrc-follow-btn-font-family: var(--nostrc-font-family-primary);
      --nostrc-follow-btn-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-follow-btn-hover-bg: var(--nostrc-theme-hover-bg, var(--nostrc-color-hover-background));
      --nostrc-follow-btn-hover-color: var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary));
      --nostrc-follow-btn-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual button surface */
      display: inline-flex;
      align-items: center;
      justify-content: var(--nostrc-follow-btn-horizontal-alignment);
      gap: var(--nostrc-spacing-md);
      background: var(--nostrc-follow-btn-bg);
      color: var(--nostrc-follow-btn-color);
      border: var(--nostrc-follow-btn-border);
      border-radius: var(--nostrc-follow-btn-border-radius);
      font-family: var(--nostrc-follow-btn-font-family);
      font-size: var(--nostrc-follow-btn-font-size);
      min-height: var(--nostrc-follow-btn-min-height);
      width: var(--nostrc-follow-btn-width);
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-follow-btn-hover-bg);
      color: var(--nostrc-follow-btn-hover-color);
      border: var(--nostrc-follow-btn-hover-border);
    }

    /* Focus state for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--nostrc-color-primary, #007bff);
      outline-offset: 2px;
    }

    .nostr-follow-button-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
      padding: var(--nostrc-follow-btn-padding);
    }
    
    .nostr-follow-button-right-container {
      margin: auto;
    }
    
    /* SVG Icon Styles */
    .nostr-follow-button-left-container svg {
      fill: var(--nostrc-follow-btn-color);
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }
  `;
  
  // Use simple component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(customStyles);
}
