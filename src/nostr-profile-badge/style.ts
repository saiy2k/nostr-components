// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";
import { getComponentStyles, commonPatterns } from "../common/base-styles";

/**
 * Nostr Profile Badge Styles
 * ==========================
 * 
 * Uses centralized design tokens and base styles for consistency.
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
    /* === PROFILE BADGE SPECIFIC STYLES === */
    
    /* Use common profile badge pattern */
    ${commonPatterns.profileBadge()}
    
    /* Profile badge specific overrides */
    .nostr-profile-badge-container {
      /* Override padding for profile badge */
      padding: var(--nostrc-spacing-lg);
    }
    
    .nostr-profile-badge-name {
      font-weight: var(--nostrc-font-weight-bold);
      color: var(--nostrc-color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-bottom: var(--nostrc-spacing-xs);
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
  
  return getComponentStyles(theme, customStyles);
}
