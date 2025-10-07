// SPDX-License-Identifier: MIT

/**
 * Profile CSS Variables
 * =====================
 * 
 * This file contains CSS variable definitions specific to the nostr-profile component.
 * These variables define styling options for the profile component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-profile component
 */
export const PROFILE_CSS_VARIABLES: ParameterDefinition[] = [
  // Profile-specific variables
  {
    variable: '--nostrc-profile-bg',
    description: 'Profile background color',
    defaultValue: 'var(--nostrc-theme-bg, var(--nostrc-color-background))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-text-primary',
    description: 'Profile primary text color',
    defaultValue: 'var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-text-secondary',
    description: 'Profile secondary text color',
    defaultValue: 'var(--nostrc-theme-text-secondary, var(--nostrc-color-text-secondary))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-border',
    description: 'Profile border color',
    defaultValue: 'var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-border-width',
    description: 'Profile border width',
    defaultValue: 'var(--nostrc-theme-border-width, var(--nostrc-border-width))',
    control: 'text',
  },
  {
    variable: '--nostrc-profile-banner-placeholder',
    description: 'Profile banner placeholder color',
    defaultValue: 'var(--nostrc-profile-border)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-accent',
    description: 'Profile accent color (used for links, etc.)',
    defaultValue: 'var(--nostrc-color-accent)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-font-family',
    description: 'Font family for the profile component text',
    defaultValue: 'ui-sans-serif, system-ui, sans-serif',
    control: 'text',
  },
];
