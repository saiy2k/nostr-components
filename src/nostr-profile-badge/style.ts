// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";
import { getComponentStyles } from "../common/base-styles";

/**
 * Nostr Profile Badge Styles
 * ==========================
 * 
 * Uses optimized component styles with only necessary patterns.
 * 
 * Customization:
 * You can override design tokens globally or on this component:
 * 
 * Global override:
 * :root {
 *   --nostrc-color-background-light: #f8f9fa;
 *   --nostrc-color-text-primary-light: #212529;
 * }
 * 
 * Component-specific override:
 * nostr-profile-badge {
 *   --nostrc-color-background-light: #ffffff;
 *   --nostrc-spacing-lg: 20px;
 * }
 */
export function getProfileBadgeStyles(theme: Theme): string {
  const customStyles = `
    /* === PROFILE BADGE CONTAINER PATTERN === */
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
    
    /* NIP-05 styling - make it grayish */
    .nostr-profile-badge-container .badge-row {
      color: var(--nostrc-color-text-primary);
    }
    
    .nostr-profile-badge-container .badge-row .nc-copy-text {
      color: var(--nostrc-color-text-muted);
    }
    
    /* Skeleton specific styles */
    .img-skeleton {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full) !important;
    }
    
    .text-skeleton-name {
      width: 120px;
      height: 16px;
      margin-bottom: var(--nostrc-spacing-xs);
    }
    
    .text-skeleton-nip05 {
      width: 160px;
      height: 14px;
    }
  `;
  
  // Use simple component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(theme, customStyles);
}
