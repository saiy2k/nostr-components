// SPDX-License-Identifier: MIT

/**
 * Nostr Post Theme Definitions
 * ===========================
 * 
 * This file contains theme mappings specific to the nostr-post component.
 * It maps common themes to post specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create post specific theme mappings
export const POST_THEMES = createComponentThemes('nostrc-post');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = POST_THEMES;
