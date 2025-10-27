// SPDX-License-Identifier: MIT

/**
 * Nostr Like Button Theme Definitions
 * ===================================
 * 
 * This file contains theme mappings specific to the nostr-like component.
 * It maps common themes to like button specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create like button specific theme mappings
export const LIKE_BUTTON_THEMES = createComponentThemes('nostrc-like-btn');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = LIKE_BUTTON_THEMES;

