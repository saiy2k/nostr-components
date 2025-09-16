// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";
import { getComponentStyles } from "../common/base-styles";

export function getFollowButtonStyles(theme: Theme): string {
  const customStyles = `
    /* === FOLLOW BUTTON CONTAINER PATTERN === */
    :host {
      --nostrc-icon-height: 25px;
      --nostrc-icon-width: 25px;
    }
    
    .nostr-follow-button-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      width: fit-content;
    }
    
    .nostr-follow-button-right-container {
      margin: auto;
    }
    
    /* SVG Icon Styles */
    .nostr-follow-button-left-container svg {
      fill: currentColor;
      display: inline-block;
      vertical-align: middle;
      width: var(--nostrc-icon-width);
      height: var(--nostrc-icon-height);
    }
  `;
  
  // Use simple component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(theme, customStyles);
}
