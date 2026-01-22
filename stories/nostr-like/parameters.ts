// SPDX-License-Identifier: MIT

/**
 * Like Button Parameters
 * =====================
 * 
 * This file contains parameter definitions specific to the nostr-like component.
 * These parameters define like button-specific attributes like url, text, and theme options.
 */

import { ParameterDefinition, COMMON_PARAMETERS } from '../common/parameters';

/**
 * Like button parameters used by nostr-like component
 */
export const LIKE_BUTTON_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'url',
    description: 'URL to like (default: current page URL)',
    defaultValue: 'https://example.com/article',
    control: 'text',
  },
  {
    variable: 'text',
    description: 'Custom text to display on the like button',
    defaultValue: 'Like',
    control: 'text',
  },
  ...COMMON_PARAMETERS,
];
