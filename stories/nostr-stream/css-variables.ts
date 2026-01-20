// SPDX-License-Identifier: MIT

/**
 * Stream CSS Variables
 * ===================
 * 
 * This file contains CSS variable definitions specific to the nostr-stream component.
 * These variables define styling options for the stream component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-stream component
 */
export const STREAM_CSS_VARIABLES: ParameterDefinition[] = [
  // Stream-specific variables
  {
    variable: '--nostrc-stream-bg',
    description: 'Stream background color',
    defaultValue: 'var(--nostrc-theme-bg, #ffffff)',
    control: 'color',
  },
  {
    variable: '--nostrc-stream-text-primary',
    description: 'Stream primary text color',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-stream-text-secondary',
    description: 'Stream secondary text color',
    defaultValue: 'var(--nostrc-theme-text-secondary, #666666)',
    control: 'color',
  },
  {
    variable: '--nostrc-stream-border',
    description: 'Stream border style',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-stream-font-family',
    description: 'Font family for the stream component text',
    defaultValue: 'var(--nostrc-font-family-primary)',
    control: 'text',
  },
  {
    variable: '--nostrc-stream-hover-bg',
    description: 'Stream background color on hover',
    defaultValue: 'var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05))',
    control: 'color',
  },
  {
    variable: '--nostrc-stream-hover-color',
    description: 'Stream text color on hover',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-stream-hover-border',
    description: 'Stream border on hover',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
];
