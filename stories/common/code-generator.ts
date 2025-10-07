// SPDX-License-Identifier: MIT

/**
 * Shared Code Generator Utilities
 * ===============================
 *
 * This file contains shared utilities for generating HTML code and dashboard HTML
 * across all component stories. It eliminates code duplication while allowing
 * component-specific customization.
 *
 * Features:
 * - Unified code generation with component-specific customization
 * - Consistent dashboard HTML generation
 * - Shared constants and utilities
 * - Type-safe configuration
 */

import { ParameterDefinition } from './parameters';
import { escapeHtml } from '../../src/common/utils';

export interface CodeGeneratorConfig {
  componentName: string;
  defaultWidth: number;
  eventHandlers: string[];
  gridColumns: string;
}

export interface GenerateCodeOptions {
  args: any;
  config: CodeGeneratorConfig;
  cssVariables: ParameterDefinition[];
  forCodeGen?: boolean;
}

export interface GenerateDashboardOptions {
  testCases: any[];
  title: string;
  color: string;
  config: CodeGeneratorConfig;
}

// Shared constants
export const BUNDLE_SCRIPT = '<script type="module" src="/nostr-components.es.js"></script>';

/**
 * Generates HTML code for a component with CSS variables and attributes
 */
export function generateCode(options: GenerateCodeOptions): string {
  const { args, config, cssVariables, forCodeGen = false } = options;
  const { componentName, defaultWidth, eventHandlers } = config;
  
  // Extract event handlers and other args
  const { width = defaultWidth, wrapperDataTheme, ...otherArgs } = args;
  
  // Generate CSS variables string
  const cssVars = cssVariables.map(cssVar => {
    const value = args[cssVar.variable];
    return value ? `${cssVar.variable}: ${value};` : '';
  }).filter(Boolean);

  const cssVarsString = cssVars.length > 0 ? `\n  ${cssVars.join('\n  ')}` : '';

  // Generate attributes string
  const attributes = Object.entries(otherArgs)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return value ? key : '';
      }
      return `${key}="${escapeHtml(String(value))}"`;
    })
    .filter(Boolean)
    .join('\n  ');

  // Handle data-theme attribute on component itself
  let componentAttributes = attributes;
  if (wrapperDataTheme) {
    componentAttributes = `${attributes ? `${attributes}\n    ` : ''}data-theme="${wrapperDataTheme}"`;
  }

  // Generate the HTML
  return `<${componentName} style="width: ${width}px;${cssVarsString}"${componentAttributes ? `\n  ${componentAttributes}` : ''}>
  </${componentName}>`.trim();
}

/**
 * Generates HTML code with bundle script included
 */
export function generateCodeWithScript(options: GenerateCodeOptions): string {
  const cleanCode = generateCode(options);
  return `${BUNDLE_SCRIPT}\n\n${cleanCode}`;
}

/**
 * Generates dashboard HTML from test cases
 */
export function generateDashboardHTML(options: GenerateDashboardOptions): string {
  const { testCases, title, color, config } = options;
  const { componentName, gridColumns } = config;
  
  const testCaseHTML = testCases.map(testCase => {
    const attributes = Object.entries(testCase.args)
      .filter(([key, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return value ? key : '';
        }
        return `${key}="${escapeHtml(String(value))}"`;
      })
      .filter(Boolean)
      .join(' ');

    return `
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${color};">
          <h4 style="margin: 0 0 10px 0; color: ${color};">${testCase.name}</h4>
          <${componentName} ${attributes}></${componentName}>
        </div>`;
  }).join('');

  return `
    <div style="padding: 20px; background: #f5f5f5;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: ${color};">${title}</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Test cases showing component behavior</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, ${gridColumns}); gap: 20px;">
        ${testCaseHTML}
      </div>
    </div>`;
}
