import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { POST_DATA } from '../post-data.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrPost/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const DynamicInputChanges: Story = {
  name: 'Dynamic Input Changes',
  tags: ['test', 'dynamic', 'inputs'],
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-post');
    if (!component) return;

    const testInputs = [
      { type: 'noteid', value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
      { type: 'noteid', value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
      { type: 'noteid', value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
      { type: 'hex', value: POST_DATA.nvk_future_here.hex, name: 'NVK Future' },
    ];

    let currentIndex = 0;
    
    const updateInput = () => {
      currentIndex = (currentIndex + 1) % testInputs.length;
      const input = testInputs[currentIndex];
      
      // Clear all inputs first
      component.removeAttribute('noteid');
      component.removeAttribute('hex');
      
      // Set the new input
      if (input.type === 'noteid') {
        component.setAttribute('noteid', input.value);
      } else if (input.type === 'hex') {
        component.setAttribute('hex', input.value);
      }
      
      console.log(`Updated ${input.type} to: ${input.name}`);
    };

    setInterval(updateInput, 8000);
  },
};

export const DynamicAllChanges: Story = {
  name: 'Dynamic All Changes',
  tags: ['test', 'dynamic', 'comprehensive'],
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-post');
    if (!component) return;

    const inputs = [
      { type: 'noteid', value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
      { type: 'noteid', value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
      { type: 'noteid', value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
      { type: 'hex', value: POST_DATA.nvk_future_here.hex, name: 'NVK Future' },
    ];

    const themes = ['light', 'dark'];
    const widths = [600, 500, 400, 700];
    
    // Create input list display
    const createInputList = (inputs: Array<{type: string, value: string, name: string}>, currentIndex: number) => {
      return inputs.map((input, index) => {
        const isCurrent = index === currentIndex;
        const item = `${index + 1}. ${input.name} - ${input.type}`;
        return isCurrent ? `<strong>${item}</strong>` : item;
      }).join('<br>');
    };

    // Create status display container
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      margin-top: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    `;
    statusContainer.innerHTML = `
      <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px;">Current Configuration</h4>
      <div id="current-input" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-theme" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-width" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="change-log" style="font-size: 11px; color: #6c757d; height: 200px; max-height: 200px; overflow-y: auto;"></div>
    `;
    
    // Insert after the component
    component.parentNode?.insertBefore(statusContainer, component.nextSibling);
    
    let inputIndex = 0;
    let themeIndex = 0;
    let widthIndex = 0;
    let changeCount = 0;

    // Function to update status display
    const updateStatusDisplay = (currentInput: any, currentTheme: string, currentWidth: number) => {
      const inputElement = document.getElementById('current-input');
      const themeElement = document.getElementById('current-theme');
      const widthElement = document.getElementById('current-width');
      
      if (inputElement && currentInput != null) {
        inputElement.innerHTML = `<strong>Input:</strong> ${currentInput.name} (${currentInput.type})`;
      }
      
      if (themeElement && currentTheme != null) {
        themeElement.innerHTML = `<strong>Theme:</strong> ${currentTheme}`;
      }
      
      if (widthElement && currentWidth != null) {
        widthElement.innerHTML = `<strong>Width:</strong> ${currentWidth}px`;
      }
    };

    // Function to add log entry
    const addLogEntry = (message: string) => {
      const logElement = document.getElementById('change-log');
      if (logElement) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `${timestamp}: ${message}<br>`;
        logElement.innerHTML = logEntry + logElement.innerHTML;
        
        // Keep only last 10 entries
        const entries = logElement.innerHTML.split('<br>');
        if (entries.length > 20) {
          logElement.innerHTML = entries.slice(0, 20).join('<br>');
        }
      }
    };

    let isFastMode = true;
    let fastUpdateCount = 0;
    const maxFastUpdates = 11; // Number of fast updates before pause

    const updateAll = () => {
      // Update input
      const input = inputs[inputIndex];
      component.removeAttribute('noteid');
      component.removeAttribute('hex');
      
      if (input.type === 'noteid') {
        component.setAttribute('noteid', input.value);
      } else if (input.type === 'hex') {
        component.setAttribute('hex', input.value);
      }

      // Update theme
      const theme = themes[themeIndex];
      component.setAttribute('data-theme', theme);
      
      // Update width
      const width = widths[widthIndex];
      const container = component.parentElement;
      if (container) {
        container.style.width = `${width}px`;
      }

      // Log the change
      addLogEntry(`Updated: ${input.name} (${input.type}), ${theme} theme, ${width}px width`);
      console.log(`Update ${++changeCount}:`, {
        input: `${input.name} (${input.type})`,
        theme: theme,
        width: `${width}px`
      });

      // Update status display
      updateStatusDisplay(input, theme, width);

      // Cycle indices
      inputIndex = (inputIndex + 1) % inputs.length;
      themeIndex = (themeIndex + 1) % themes.length;
      widthIndex = (widthIndex + 1) % widths.length;
    };

    // Function to handle fast updates
    const performFastUpdate = () => {
      if (fastUpdateCount >= maxFastUpdates) {
        // Switch to pause mode
        isFastMode = false;
        fastUpdateCount = 0;
        addLogEntry(`Pausing for 10000ms...`);
        console.log('Switching to pause mode for 10000ms');
        
        // Schedule next fast cycle after pause
        setTimeout(() => {
          isFastMode = true;
          addLogEntry(`Resuming fast updates...`);
          console.log('Resuming fast updates');
          performFastUpdate();
        }, 10000);
        return;
      }

      updateAll();
      fastUpdateCount++;

      // Schedule next fast update with random delay between 100-200ms
      const nextDelay = 100 + Math.random() * 100;
      setTimeout(performFastUpdate, nextDelay);
    };

    // Initial status update
    updateStatusDisplay(inputs[inputIndex], themes[themeIndex], widths[widthIndex]);

    // Start the fast update cycle
    addLogEntry(`Starting fast update cycle...`);
    performFastUpdate();
  },
};