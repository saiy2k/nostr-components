// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getProfileBadgeStyles(): string {
  const customStyles = `
    /* === PROFILE BADGE SPECIFIC CSS VARIABLES === */
    :host {
      --nostrc-profile-badge-bg: var(--nostrc-theme-bg, var(--nostrc-color-background));
      --nostrc-profile-badge-text-primary: var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary));
      --nostrc-profile-badge-text-secondary: var(--nostrc-theme-text-secondary, var(--nostrc-color-text-secondary));
      --nostrc-profile-badge-border: var(--nostrc-theme-border, var(--nostrc-color-border));
      --nostrc-profile-badge-border-width: var(--nostrc-theme-border-width, var(--nostrc-border-width));
      --nostrc-profile-badge-font-family: var(--nostrc-font-family-primary);
      --nostrc-profile-badge-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-profile-badge-hover-bg: var(--nostrc-theme-hover-bg, var(--nostrc-color-hover-background));
      --nostrc-profile-badge-hover-color: var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary));
      --nostrc-profile-badge-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual profile badge surface */
      display: block;
      background: var(--nostrc-profile-badge-bg);
      border: var(--nostrc-profile-badge-border-width) solid var(--nostrc-profile-badge-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-profile-badge-font-family);
      font-size: var(--nostrc-profile-badge-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }
    
    /* === PROFILE BADGE CONTAINER PATTERN === */
    .nostr-profile-badge-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-spacing-md);
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-profile-badge-hover-bg);
      color: var(--nostrc-profile-badge-hover-color);
      border: var(--nostrc-profile-badge-hover-border);
    }
    
    .nostr-profile-badge-left-container {
      width: 48px;
      height: 48px;
    }
    
    .nostr-profile-badge-left-container img {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }
    
    .nostr-profile-badge-right-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-grow: 1;
      min-width: 0;
    }
    
    /* Profile badge specific styling using component variables */
    .nostr-profile-badge-container .nostr-profile-name {
      color: var(--nostrc-profile-badge-text-primary);
    }
    
    .nostr-profile-badge-container .text-row {
      color: var(--nostrc-profile-badge-text-secondary);
    }
    
    /* Skeleton specific styles */
    .img-skeleton {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
    }
    
  `;
  
  return getComponentStyles(customStyles);
}
