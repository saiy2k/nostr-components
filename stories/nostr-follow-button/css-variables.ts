// SPDX-License-Identifier: MIT

/**
 * Follow Button CSS Variables
 * ===========================
 * 
 * This file contains CSS variable definitions specific to the nostr-follow-button component.
 * These variables define styling options for the follow button component.
 */

import { ParameterDefinition } from '../common/parameters';
/**
 * CSS variables for nostr-follow-button component
 */
export const FOLLOW_BUTTON_CSS_VARIABLES: ParameterDefinition[] = [
  {
    variable: '--nostrc-icon-width',
    description: 'Width of the icon in the follow button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-icon-height',
    description: 'Height of the icon in the follow button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-padding',
    description: `Horizontal and vertical padding of the button`,
    defaultValue: '8px 12px',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-font-size',
    description: 'Size of the font inside the button',
    defaultValue: '1em',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-border-radius',
    description: 'Border radius of the button',
    defaultValue: '8px',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-border',
    description: 'Border style of the button',
    defaultValue: '1px solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-bg',
    description: 'Background color of the button',
    defaultValue: 'var(--nostrc-color-background)',
    control: 'color',
  },
  {
    variable: '--nostrc-follow-btn-color',
    description: 'Text color of the button',
    defaultValue: 'var(--nostrc-color-text-primary)',
    control: 'color',
  },
  {
    variable: '--nostrc-follow-btn-hover-bg',
    description: 'Background color of the button on hover',
    defaultValue: 'var(--nostrc-color-hover)',
    control: 'color',
  },
];
