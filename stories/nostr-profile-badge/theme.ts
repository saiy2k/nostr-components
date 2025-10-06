// SPDX-License-Identifier: MIT

/**
 * Nostr Profile Badge Theme Definitions
 * =====================================
 * 
 * This file contains theme mappings specific to the nostr-profile-badge component.
 * It maps common themes to profile badge specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create profile badge specific theme mappings
export const PROFILE_BADGE_THEMES = createComponentThemes('nostrc-profile-badge');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = PROFILE_BADGE_THEMES;
