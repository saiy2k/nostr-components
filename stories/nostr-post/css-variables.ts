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
    description: 'Post border style',
    defaultValue: 'var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
  {
    variable: '--nostrc-post-font-family',
    description: 'Font family for the post component text',
    defaultValue: 'ui-sans-serif, system-ui, sans-serif',
    control: 'text',
  },
  {
    variable: '--nostrc-post-hover-bg',
    description: 'Post background color on hover',
    defaultValue: 'var(--nostrc-theme-hover-bg, var(--nostrc-color-hover-background))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-hover-color',
    description: 'Post text color on hover',
    defaultValue: 'var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-hover-border',
    description: 'Post border on hover',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
];
