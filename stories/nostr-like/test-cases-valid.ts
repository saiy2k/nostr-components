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
      url: 'https://example.com/article',
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      text: 'Like',
      url: 'https://example.com/article',
      'data-theme': 'dark',
    },
  },
  customText: {
    name: 'Custom Text',
    args: {
      text: 'Love it!',
      url: 'https://example.com/article',
    },
  },
  customUrl: {
    name: 'Custom URL',
    args: {
      text: 'Like',
      url: 'https://github.com/nostr-protocol/nips',
    },
  },
  customRelays: {
    name: 'Custom Relays',
    args: {
      text: 'Like',
      url: 'https://example.com/article',
      relays: 'wss://relay.damus.io,wss://nostr.wine',
    },
  },
  noUrl: {
    name: 'No URL (Current Page)',
    args: {
      text: 'Like',
    },
  },
};
