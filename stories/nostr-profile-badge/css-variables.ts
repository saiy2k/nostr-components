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
    description: 'Border color of the profile badge',
    defaultValue: 'var(--nostrc-color-border)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-border-width',
    description: 'Border width of the profile badge',
    defaultValue: 'var(--nostrc-border-width)',
    control: 'text',
  },
];
