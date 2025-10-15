// SPDX-License-Identifier: MIT

/**
 * Nostr Zap Button Theme Definitions
 * ==================================
 * 
 * This file contains theme mappings specific to the nostr-zap component.
 * It maps common themes to zap button specific CSS variables.
 */

import { createComponentThemes } from '../common/themes';

// Create zap button specific theme mappings
export const ZAP_BUTTON_THEMES = createComponentThemes('nostrc-zap-btn');

// Export individual themes for convenience
export const {
  'ocean-glass': OCEAN_GLASS_THEME,
  'holographic': HOLOGRAPHIC_THEME,
  'neo-matrix': NEO_MATRIX_THEME,
  'bitcoin-orange': BITCOIN_ORANGE_THEME,
} = ZAP_BUTTON_THEMES;
