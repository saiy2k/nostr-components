// SPDX-License-Identifier: MIT

/**
 * Like Button Test Cases
 * =====================
 * 
 * This file contains test cases for the nostr-like component.
 * These test cases cover various scenarios and configurations.
 */

export const TEST_CASES = {
  default: {
    name: 'Default',
    args: {
      text: 'Like',
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      text: 'Like',
      'data-theme': 'dark',
    },
  },
  customText: {
    name: 'Custom Text',
    args: {
      text: 'Love it!',
    },
  },
  customUrl: {
    name: 'Custom URL',
    args: {
      text: 'Like',
      url: 'https://saiy2k.in/2025/02/17/nostr-components/',
    },
  },
  customRelays: {
    name: 'Custom Relays',
    args: {
      text: 'Like',
      relays: 'wss://relay.damus.io,wss://nostr.wine',
    },
  },
  noUrl: {
    name: 'No URL (Current Page)',
    args: {
      text: 'Like',
    },
  },

  // Theme Variations
  oceanGlass: {
    name: 'Ocean Glass Theme',
    args: {
      text: 'Like',
    },
    wrapperDataTheme: 'ocean-glass',
  },
  holographic: {
    name: 'Holographic Theme',
    args: {
      text: 'Like',
    },
    wrapperDataTheme: 'holographic',
  },
  neoMatrix: {
    name: 'Neo Matrix Theme',
    args: {
      text: 'Like',
    },
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrange: {
    name: 'Bitcoin Orange Theme',
    args: {
      text: 'Like',
    },
    wrapperDataTheme: 'bitcoin-orange',
  },
};
