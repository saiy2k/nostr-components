// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";
import { getComponentStyles } from "../common/base-styles";

export function getProfileBadgeStyles(theme: Theme): string {
  const customStyles = `
    /* === PROFILE BADGE CONTAINER PATTERN === */
    .nostr-profile-badge-container {
      display: flex;
      gap: var(--nostrc-spacing-md);
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
    
    /* Skeleton specific styles */
    .img-skeleton {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
    }
    
  `;
  
  // Use simple component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(theme, customStyles);
}
