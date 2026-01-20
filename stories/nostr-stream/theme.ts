// SPDX-License-Identifier: MIT

/**
 * Nostr Stream Theme Definitions
 * ==============================
 * 
 * This file contains theme mappings specific to the nostr-stream component.
 * It maps common themes to stream specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create stream specific theme mappings
export const STREAM_THEMES = createComponentThemes('nostrc-stream');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = STREAM_THEMES;
