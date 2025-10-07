// SPDX-License-Identifier: MIT

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
 * - Automatic cleanup to prevent memory leaks
 * - Configurable update intervals
 * - Simple boolean attribute toggling (true/false)
 * - Streamlined, easy-to-read implementation
 */

export interface ComprehensiveDynamicConfig {
  componentName: string;
  inputAttributes: string[];
  testInputs: Array<{ type: string; value: string; name: string }>;
  widths?: number[];
  booleanAttributes?: string[];
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
    updateInterval = 5000
  } = config;

  return async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector(componentName);
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
    const updateStatus = (input: any, theme: string, width?: number) => {
      const inputEl = document.getElementById('current-input');
      const themeEl = document.getElementById('current-theme');
      const widthEl = document.getElementById('current-width');
      
      if (inputEl) inputEl.innerHTML = `<strong>Input:</strong> ${input.name} (${input.type})`;
      if (themeEl) themeEl.innerHTML = `<strong>Theme:</strong> ${theme}`;
      if (widthEl && width) widthEl.innerHTML = `<strong>Width:</strong> ${width}px`;
      
      booleanAttributes.forEach((attr, index) => {
        const el = document.getElementById(`current-${attr}`);
        if (el) el.innerHTML = `<strong>${attr}:</strong> ${booleanStates[index]}`;
      });
    };

    const addLog = (message: string) => {
      const logEl = document.getElementById('change-log');
      if (logEl) {
        const timestamp = new Date().toLocaleTimeString();
        logEl.innerHTML = `${timestamp}: ${message}<br>` + logEl.innerHTML;
        const entries = logEl.innerHTML.split('<br>');
        if (entries.length > 20) {
          logEl.innerHTML = entries.slice(0, 20).join('<br>');
        }
      }
    };

    const updateAll = () => {
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
        const container = component.parentElement;
        if (container) container.style.width = `${currentWidth}px`;
      }

      // Update boolean attributes
      booleanAttributes.forEach((attr, index) => {
        booleanStates[index] = !booleanStates[index];
        component.setAttribute(attr, booleanStates[index].toString());
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
    const intervalId = setInterval(updateAll, updateInterval);
    
    // Cleanup
    (component as any).__cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log(`${componentName}: Interval cleared`);
      }
    };
  };
}
