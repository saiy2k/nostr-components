// SPDX-License-Identifier: MIT

/**
 * Nostr Follow Button Theme Definitions
 * ====================================
 * 
 * This file contains theme mappings specific to the nostr-follow-button component.
 * It maps common themes to follow button specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create follow button specific theme mappings
export const FOLLOW_BUTTON_THEMES = createComponentThemes('nostrc-follow-btn');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = FOLLOW_BUTTON_THEMES;
