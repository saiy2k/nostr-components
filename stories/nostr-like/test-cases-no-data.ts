// SPDX-License-Identifier: MIT

/**
 * Like Button Test Cases - No Data
 * ================================
 * 
 * This file contains test cases for the nostr-like component with no likes.
 * These test cases demonstrate the component behavior when there are no likes.
 */

export const TEST_CASES = {
  noLikes: {
    name: 'No Likes',
    args: {
      text: 'Like',
    },
  },
  noLikesDark: {
    name: 'No Likes (Dark)',
    args: {
      text: 'Like',
      'data-theme': 'dark',
    },
  },
};
