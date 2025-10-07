// SPDX-License-Identifier: MIT

/**
 * Nostr Profile Theme Definitions
 * ===============================
 * 
 * This file contains theme mappings specific to the nostr-profile component.
 * It maps common themes to profile specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create profile specific theme mappings
export const PROFILE_THEMES = createComponentThemes('nostrc-profile');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = PROFILE_THEMES;
