// SPDX-License-Identifier: MIT

import { registerStoryCleanup } from './play-cleanup';

/**
 * Comprehensive Dynamic Stories Utility
 * ====================================
 * 
 * This file contains a shared utility for creating comprehensive dynamic stories
 * that cycle through multiple attributes (inputs, themes, widths, boolean attributes)
 * with status display and change logging.
 * 
 * Features:
 * - Status display with current configuration
 * - Change log with timestamps
 * - Multiple attribute cycling (inputs, data-theme, widths, boolean attributes)
 * - Cleanup on abort or re-run to prevent timer leaks
 * - Configurable update intervals
 * - Mode-aware boolean attribute toggling (presence / explicit-false)
 * - Streamlined, easy-to-read implementation
 */

import { BooleanAttributeMode } from './parameters';

export interface ComprehensiveDynamicConfig {
  componentName: string;
  inputAttributes: string[];
  testInputs: Array<{ type: string; value: string; name: string }>;
  widths?: number[];
  booleanAttributes?: string[];
  booleanAttributeModes?: Record<string, BooleanAttributeMode>;
  updateInterval?: number;
}

/**
 * Creates a comprehensive dynamic story play function
 * 
 * @param config - Configuration object for the dynamic story
 * @returns A play function that can be used in Storybook stories
 */
export function createComprehensiveDynamicPlay(config: ComprehensiveDynamicConfig) {
  const {
    componentName,
    inputAttributes,
    testInputs,
    widths = [600, 500, 400, 700],
    booleanAttributes = [],
    booleanAttributeModes = {},
    updateInterval = 5000
  } = config;

  return async ({ canvasElement, abortSignal }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector<HTMLElement>(componentName);
    if (!component) return;

    // Create status display container
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      margin-top: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    `;
    
    const statusHTML = `
      <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px;">Current Configuration</h4>
      <div id="current-input" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-theme" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      ${widths.length > 0 ? '<div id="current-width" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>' : ''}
      ${booleanAttributes.map(attr => `<div id="current-${attr}" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>`).join('')}
      <div id="change-log" style="font-size: 11px; color: #6c757d; height: 200px; max-height: 200px; overflow-y: auto;"></div>
    `;

    statusContainer.innerHTML = statusHTML;
    component.parentNode?.insertBefore(statusContainer, component.nextSibling);
    
    // Initialize state
    let inputIndex = 0;
    let themeIndex = 0;
    let widthIndex = 0;
    const booleanStates = booleanAttributes.map(() => false);
    let changeCount = 0;
    const themes = ['light', 'dark'];

    // Helper functions
    const updateStatus = (
      input: { type: string; value: string; name: string },
      theme: string,
      width?: number
    ) => {
      const inputEl = statusContainer.querySelector<HTMLElement>('#current-input');
      const themeEl = statusContainer.querySelector<HTMLElement>('#current-theme');
      const widthEl = statusContainer.querySelector<HTMLElement>('#current-width');
      
      if (inputEl) inputEl.textContent = `Input: ${input.name} (${input.type})`;
      if (themeEl) themeEl.textContent = `Theme: ${theme}`;
      if (widthEl && width !== undefined) widthEl.textContent = `Width: ${width}px`;

      booleanAttributes.forEach((attr, index) => {
        const el = statusContainer.querySelector<HTMLElement>(`#current-${attr}`);
        if (el) el.textContent = `${attr}: ${booleanStates[index]}`;
      });
    };

    const addLog = (message: string) => {
      const logEl = statusContainer.querySelector<HTMLElement>('#change-log');
      if (logEl) {
        const timestamp = new Date().toLocaleTimeString();
        logEl.innerHTML = `${timestamp}: ${message}<br>` + logEl.innerHTML;
        const entries = logEl.innerHTML.split('<br>');
        if (entries.length > 20) {
          logEl.innerHTML = entries.slice(0, 20).join('<br>');
        }
      }
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cleanup = () => {};

    const updateAll = () => {
      if (!component.isConnected) {
        cleanup();
        return;
      }

      // Update input
      const input = testInputs[inputIndex];
      inputAttributes.forEach(attr => component.removeAttribute(attr));
      component.setAttribute(input.type, input.value);

      // Update theme
      const theme = themes[themeIndex];
      component.setAttribute('data-theme', theme);
      
      // Update width
      let currentWidth: number | undefined;
      if (widths.length > 0) {
        currentWidth = widths[widthIndex];
        // Set width on the component itself
        component.style.width = `${currentWidth}px`;
        // Optionally also set container width to preserve wrapper sizing
        const container = component.parentElement;
        if (container) container.style.width = `${currentWidth}px`;
      }

      // Update boolean attributes
      booleanAttributes.forEach((attr, index) => {
        booleanStates[index] = !booleanStates[index];
        const mode = booleanAttributeModes[attr] ?? 'presence';

        if (mode === 'explicit-false') {
          component.setAttribute(attr, booleanStates[index] ? 'true' : 'false');
          return;
        }

        if (booleanStates[index]) {
          component.setAttribute(attr, 'true');
        } else {
          component.removeAttribute(attr);
        }
      });

      // Log and update display
      const logParts = [
        `${input.name} (${input.type})`,
        `${theme} theme`,
        ...(currentWidth ? [`${currentWidth}px width`] : []),
        ...booleanAttributes.map((attr, index) => `${attr}: ${booleanStates[index]}`)
      ];

      addLog(`Updated: ${logParts.join(', ')}`);
      console.log(`Update ${++changeCount}:`, { input: `${input.name} (${input.type})`, theme, ...(currentWidth && { width: `${currentWidth}px` }), ...Object.fromEntries(booleanAttributes.map((attr, index) => [attr, booleanStates[index]])) });
      updateStatus(input, theme, currentWidth);

      // Cycle indices
      inputIndex = (inputIndex + 1) % testInputs.length;
      themeIndex = (themeIndex + 1) % themes.length;
      if (widths.length > 0) widthIndex = (widthIndex + 1) % widths.length;
    };

    // Initial update
    updateStatus(testInputs[inputIndex], themes[themeIndex], widths[0]);

    // Start interval
    intervalId = setInterval(updateAll, updateInterval);

    cleanup = registerStoryCleanup(component, abortSignal, () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
        console.log(`${componentName}: Interval cleared`);
      }
      statusContainer.remove();
    });
  };
}
