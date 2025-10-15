// SPDX-License-Identifier: MIT

/**
 * Zap Button CSS Variables
 * ========================
 * 
 * This file contains CSS variable definitions specific to the nostr-zap component.
 * These variables define styling options for the zap button component.
 */

import { ParameterDefinition } from '../common/parameters';

/**
 * CSS variables for nostr-zap component
 */
export const ZAP_BUTTON_CSS_VARIABLES: ParameterDefinition[] = [
  {
    variable: '--nostrc-icon-width',
    description: 'Width of the zap icon in the button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-icon-height',
    description: 'Height of the zap icon in the button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-padding',
    description: 'Horizontal and vertical padding of the zap button',
    defaultValue: 'var(--nostrc-spacing-sm) var(--nostrc-spacing-md)',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-border-radius',
    description: 'Border radius of the zap button',
    defaultValue: 'var(--nostrc-border-radius-md)',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-border',
    description: 'Border style of the zap button',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-min-height',
    description: 'Minimum height of the zap button',
    defaultValue: '47px',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-width',
    description: 'Width of the zap button',
    defaultValue: 'auto',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-horizontal-alignment',
    description: 'Horizontal alignment of content within the zap button',
    defaultValue: 'left',
    control: 'select',
  },
  {
    variable: '--nostrc-zap-btn-bg',
    description: 'Background color of the zap button',
    defaultValue: 'var(--nostrc-theme-bg, #ffffff)',
    control: 'color',
  },
  {
    variable: '--nostrc-zap-btn-color',
    description: 'Text color of the zap button',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-zap-btn-font-family',
    description: 'Font family for the zap button text',
    defaultValue: 'var(--nostrc-font-family-primary)',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-font-size',
    description: 'Font size of the zap button text',
    defaultValue: 'var(--nostrc-font-size-base)',
    control: 'text',
  },
  {
    variable: '--nostrc-zap-btn-hover-bg',
    description: 'Background color of the zap button on hover',
    defaultValue: 'var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05))',
    control: 'color',
  },
  {
    variable: '--nostrc-zap-btn-hover-color',
    description: 'Text color of the zap button on hover',
    defaultValue: 'var(--nostrc-theme-text-primary, #333333)',
    control: 'color',
  },
  {
    variable: '--nostrc-zap-btn-hover-border',
    description: 'Border style of the zap button on hover',
    defaultValue: 'var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'text',
  },
];
