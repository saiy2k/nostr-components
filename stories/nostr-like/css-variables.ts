// SPDX-License-Identifier: MIT

/**
 * Like Button CSS Variables
 * ========================
 * 
 * This file contains CSS variable definitions specific to the nostr-like component.
 * These variables allow customization of the like button's appearance.
 */

import { CSSVariableDefinition } from '../common/css-variables';

/**
 * CSS variables for the nostr-like component
 */
export const LIKE_BUTTON_CSS_VARIABLES: CSSVariableDefinition[] = [
  {
    variable: '--nostrc-icon-width',
    description: 'Width of the thumbs-up icon',
    defaultValue: '20px',
    control: 'text',
  },
  {
    variable: '--nostrc-icon-height',
    description: 'Height of the thumbs-up icon',
    defaultValue: '20px',
    control: 'text',
  },
  {
    variable: '--nostrc-like-btn-padding',
    description: 'Padding of the like button',
    defaultValue: '8px 16px',
    control: 'text',
  },
  {
    variable: '--nostrc-like-btn-border-radius',
    description: 'Border radius of the like button',
    defaultValue: '4px',
    control: 'text',
  },
  {
    variable: '--nostrc-like-btn-bg',
    description: 'Background color of the like button',
    defaultValue: '#f0f2f5',
    control: 'color',
  },
  {
    variable: '--nostrc-like-btn-color',
    description: 'Text color of the like button',
    defaultValue: '#65676b',
    control: 'color',
  },
  {
    variable: '--nostrc-like-btn-hover-bg',
    description: 'Background color of the like button on hover',
    defaultValue: '#e4e6eb',
    control: 'color',
  },
  {
    variable: '--nostrc-like-btn-liked-bg',
    description: 'Background color of the liked button',
    defaultValue: '#e7f3ff',
    control: 'color',
  },
  {
    variable: '--nostrc-like-btn-liked-color',
    description: 'Text color of the liked button',
    defaultValue: '#1877f2',
    control: 'color',
  },
  {
    variable: '--nostrc-like-count-color',
    description: 'Color of the like count text',
    defaultValue: '#65676b',
    control: 'color',
  },
];
