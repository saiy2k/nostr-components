// SPDX-License-Identifier: MIT

/**
 * Post CSS Variables
 * ==================
 * 
 * This file contains CSS variable definitions specific to the nostr-post component.
 * These variables define styling options for the post component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-post component
 */
export const POST_CSS_VARIABLES: ParameterDefinition[] = [
  // Post-specific variables
  {
    variable: '--nostrc-post-bg',
    description: 'Post background color',
    defaultValue: 'var(--nostrc-theme-bg, var(--nostrc-color-background))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-text-primary',
    description: 'Post primary text color',
    defaultValue: 'var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-text-secondary',
    description: 'Post secondary text color',
    defaultValue: 'var(--nostrc-theme-text-secondary, var(--nostrc-color-text-secondary))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-border',
    description: 'Post border color',
    defaultValue: 'var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-border-width',
    description: 'Post border width',
    defaultValue: 'var(--nostrc-theme-border-width, var(--nostrc-border-width))',
    control: 'text',
  },
  {
    variable: '--nostrc-post-accent',
    description: 'Post accent color (used for mentions, links, etc.)',
    defaultValue: 'var(--nostrc-color-accent)',
    control: 'color',
  },
];
