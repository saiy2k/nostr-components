// SPDX-License-Identifier: MIT

/**
 * Like Button Parameters
 * =====================
 * 
 * This file contains parameter definitions specific to the nostr-like component.
 * These parameters define like button-specific attributes like url, text, and theme options.
 */

import { ParameterDefinition } from '../common/parameters';

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
  {
    variable: 'relays',
    description: 'Comma-separated relay URLs',
    defaultValue: 'wss://relay.nostr.band,wss://purplepag.es',
    control: 'text',
  },
  {
    variable: 'data-theme',
    description: 'Theme for the like button',
    defaultValue: 'light',
    control: 'select',
    options: ['light', 'dark'],
  },
];
