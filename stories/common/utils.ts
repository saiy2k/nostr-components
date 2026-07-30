// SPDX-License-Identifier: MIT

/**
 * Common Storybook Utilities
 * ==========================
 * 
 * This file contains shared utility functions used across all Nostr component stories.
 * These utilities help generate consistent Storybook configurations.
 */

import type { ArgTypes } from '@storybook/web-components-vite';
import { ParameterDefinition } from './parameters';

const getTypeName = (control: ParameterDefinition['control']) => {
  switch (control) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    default:
      return 'string';
  }
};

const getControlType = (control: ParameterDefinition['control']) => {
  return {
    type: control,
  };
};

/**
 * Generates Storybook argTypes from parameter and CSS variable definitions
 * 
 * @param parameters - Array of component parameters
 * @param cssVariables - Array of CSS variables
 * @returns Storybook argTypes configuration
 */
export const generateArgTypes = (
  parameters: ParameterDefinition[],
  cssVariables: ParameterDefinition[]
): Partial<ArgTypes> => {
  const argTypes: Partial<ArgTypes> = {};
  
  // Add component parameters
  parameters.forEach(parameter => {
    argTypes[parameter.variable] = {
      description: parameter.description,
      type: {
        name: getTypeName(parameter.control),
      },
      table: {
        defaultValue: {
          summary: parameter.defaultValue,
        },
      },
      control: getControlType(parameter.control),
    };
  });

  // Add CSS variables
  cssVariables.forEach(cssVariable => {
    argTypes[cssVariable.variable] = {
      description: cssVariable.description,
      type: 'string',
      table: {
        category: 'CSS Variables',
        defaultValue: {
          summary: cssVariable.defaultValue,
        },
      },
      control: getControlType(cssVariable.control),
    };
  });

  return argTypes;
};
