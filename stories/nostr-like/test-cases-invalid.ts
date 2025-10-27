// SPDX-License-Identifier: MIT

/**
 * Like Button Test Cases - Invalid
 * ================================
 * 
 * This file contains invalid test cases for the nostr-like component.
 * These test cases demonstrate error handling and validation.
 */

export const TEST_CASES = {
  invalidUrl: {
    name: 'Invalid URL',
    args: {
      text: 'Like',
      url: 'not-a-valid-url',
    },
  },
  longText: {
    name: 'Text Too Long',
    args: {
      text: 'This is a very long text that exceeds the maximum length of 128 characters and should trigger validation error',
      url: 'https://example.com/article',
    },
  },
};
