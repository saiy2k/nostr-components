// SPDX-License-Identifier: MIT

/**
 * Nostr Livestream Theme Definitions
 * ==================================
 * 
 * This file contains theme mappings specific to the nostr-livestream component.
 * It maps common themes to livestream specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create livestream specific theme mappings
export const LIVESTREAM_THEMES = createComponentThemes('nostrc-livestream');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = LIVESTREAM_THEMES;
