// SPDX-License-Identifier: MIT

/**
 * Livestream CSS Variables
 * ========================
 * 
 * This file contains CSS variable definitions specific to the nostr-livestream component.
 * These variables define styling options for the livestream component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-livestream component
 */
export const LIVESTREAM_CSS_VARIABLES: ParameterDefinition[] = [
  // Livestream-specific variables
  {
    variable: '--nostrc-livestream-bg',
    description: 'Livestream background color',
    defaultValue: 'var(--nostrc-theme-bg, #ffffff)',
    control: 'color',
  },
  {
    variable: '--nostrc-livestream-text-primary',
    description: 'Livestream primary text color',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-livestream-text-secondary',
    description: 'Livestream secondary text color',
    defaultValue: 'var(--nostrc-theme-text-secondary, #666666)',
    control: 'color',
  },
  {
    variable: '--nostrc-livestream-border',
    description: 'Livestream border style',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-livestream-font-family',
    description: 'Font family for the livestream component text',
    defaultValue: 'var(--nostrc-font-family-primary)',
    control: 'text',
  },
  {
    variable: '--nostrc-livestream-hover-bg',
    description: 'Livestream background color on hover',
    defaultValue: 'var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05))',
    control: 'color',
  },
  {
    variable: '--nostrc-livestream-hover-color',
    description: 'Livestream text color on hover',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-livestream-hover-border',
    description: 'Livestream border on hover',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
];
