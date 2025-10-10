// SPDX-License-Identifier: MIT

/**
 * Profile Badge CSS Variables
 * ===========================
 * 
 * This file contains CSS variable definitions specific to the nostr-profile-badge component.
 * These variables define styling options for the profile badge component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-profile-badge component
 */
export const PROFILE_BADGE_CSS_VARIABLES: ParameterDefinition[] = [
  {
    variable: '--nostrc-profile-badge-bg',
    description: 'Background color of the profile badge',
    defaultValue: 'var(--nostrc-color-background)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-text-primary',
    description: 'Primary text color (name)',
    defaultValue: 'var(--nostrc-color-text-primary)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-text-secondary',
    description: 'Secondary text color (nip05, npub)',
    defaultValue: 'var(--nostrc-color-text-secondary)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-border',
    description: 'Border style of the profile badge',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-profile-badge-font-family',
    description: 'Font family for the profile badge text',
    defaultValue: 'ui-sans-serif, system-ui, sans-serif',
    control: 'text',
  },
  {
    variable: '--nostrc-profile-badge-hover-bg',
    description: 'Profile badge background color on hover',
    defaultValue: 'var(--nostrc-theme-hover-bg, var(--nostrc-color-hover-background))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-hover-color',
    description: 'Profile badge text color on hover',
    defaultValue: 'var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary))',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-hover-border',
    description: 'Profile badge border on hover',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
];
