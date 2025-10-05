import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { POST_DATA, getAllInputTypes } from '../post-data.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrPost/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
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

// ====================================
// DYNAMIC ATTRIBUTE CHANGES
// ====================================

export const DynamicNoteIdChanges: Story = {
  name: 'Dynamic Note ID Changes',
  tags: ['test', 'dynamic', 'attributes'],
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-post');
    if (!component) return;

    // Array of different note IDs and hex values from post data
    const noteIds = [
      POST_DATA.gigi_free_web.noteid,
      POST_DATA.utxo_us_dollar_backing.noteid,
      POST_DATA.jack_video_programming_you.noteid,
      POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      POST_DATA.nvk_future_here.hex,
      POST_DATA.ben_expensive_government.hex,
    ];

    let currentIndex = 0;
    
    // Function to update note ID or hex
    const updateNoteId = () => {
      currentIndex = (currentIndex + 1) % noteIds.length;
      const currentId = noteIds[currentIndex];
      
      // Clear previous attributes
      component.removeAttribute('noteid');
      component.removeAttribute('hex');
      
      // Determine if it's a noteid or hex based on format
      if (currentId.startsWith('note1')) {
        component.setAttribute('noteid', currentId);
      } else {
        component.setAttribute('hex', currentId);
      }
      
      // Log the change for debugging
      console.log(`Updated to: ${currentId}`);
    };

    setInterval(updateNoteId, 10000);
    
  },
};

export const DynamicAllAttributes: Story = {
  name: 'Dynamic All Attributes',
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

    // Create input list display
    const createInputList = (inputs: Array<{type: string, value: string, name: string}>, currentIndex: number) => {
      return inputs.map((input, index) => {
        const isCurrent = index === currentIndex;
        const isValid = !input.name.includes('Invalid') && !input.name.includes('Empty');
        const displayName = isValid ? input.name : input.value;
        const displayCase = isValid ? input.type : input.name;
        const item = `${index + 1}. ${displayName} - ${displayCase}`;
        return isCurrent ? `<strong>${item}</strong>` : item;
      }).join('<br>');
    };

    // Test data - 5 valid cases and 5 invalid cases
    const validInputs = [
      { type: 'noteid', value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
      { type: 'noteid', value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
      { type: 'noteid', value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
      { type: 'noteid', value: POST_DATA.toxic_bitcoiner_image_state_exists.noteid, name: 'Toxic Image' },
      { type: 'hex', value: POST_DATA.nvk_future_here.hex, name: 'NVK Future' },
      { type: 'hex', value: POST_DATA.ben_expensive_government.hex, name: 'Ben Government' },
    ];
    
    const invalidInputs = [
      { type: 'noteid', value: INVALID_TEST_CASES.invalidNoteId.args.noteid, name: 'Invalid Note ID' },
      { type: 'noteid', value: INVALID_TEST_CASES.malformedNoteId.args.noteid, name: 'Malformed Note ID' },
      { type: 'noteid', value: INVALID_TEST_CASES.emptyNoteId.args.noteid, name: 'Empty Note ID' },
      { type: 'noteid', value: INVALID_TEST_CASES.nullNoteId.args.noteid, name: 'Null Note ID' },
      { type: 'noteid', value: INVALID_TEST_CASES.tooLongNoteId.args.noteid, name: 'Too Long Note ID' },
    ];
    
    // Mix valid and invalid inputs randomly, filtering out null values
    const allInputs = [...validInputs, ...invalidInputs].filter(input => input.value !== null);
    const inputs = allInputs.sort(() => Math.random() - 0.5);
    
    let showStats = true;
    
    let inputIndex = 0;

    // Create input list container
    const inputListContainer = document.createElement('div');
    inputListContainer.style.cssText = `
      margin-top: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    `;
    inputListContainer.innerHTML = `
      <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px;">Input Sequence (Name, type)</h4>
      <div id="input-list"></div>
    `;
    
    // Insert after the component
    component.parentNode?.insertBefore(inputListContainer, component.nextSibling);
    
    // Function to update all attributes and input types
    const updateAllAttributes = () => {
      const input = inputs[inputIndex];
      
      // Clear all input attributes
      component.removeAttribute('noteid');
      component.removeAttribute('hex');
      
      // Set the new input
      component.setAttribute(input.type, input.value || '');
      
      // Update show-stats
      showStats = !showStats;
      component.setAttribute('show-stats', showStats.toString());
      
      // Update input list container
      const inputListElement = document.getElementById('input-list');
      if (inputListElement) {
        inputListElement.innerHTML = createInputList(inputs, inputIndex);
      }
      
      // Log the changes for debugging
      console.log(`Updated all attributes:`, {
        input: `${input.type}: ${input.value} (${input.name})`,
        showStats: showStats
      });
      
      inputIndex = (inputIndex + 1) % inputs.length;
    };

    setInterval(updateAllAttributes, 10000);
    
  },
};

export const DynamicNoteIdAndRelays: Story = {
  name: 'Dynamic Note ID and Relays',
  tags: ['test', 'dynamic', 'noteid', 'relays'],
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
    relays: 'wss://relay.damus.io',
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-post');
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
    statusContainer.innerHTML = `
      <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px;">Current Configuration</h4>
      <div id="current-noteid" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-relays" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="change-log" style="font-size: 11px; color: #6c757d; height: 500px; max-height: 500px; overflow-y: auto;"></div>
    `;
    
    // Insert after the component
    component.parentNode?.insertBefore(statusContainer, component.nextSibling);

    // Different note IDs and hex values to cycle through
    const noteIds = [
      { id: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web', type: 'noteid' },
      { id: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar', type: 'noteid' },
      { id: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video', type: 'noteid' },
      { id: POST_DATA.toxic_bitcoiner_image_state_exists.noteid, name: 'Toxic Image', type: 'noteid' },
      { id: POST_DATA.nvk_future_here.hex, name: 'NVK Future', type: 'hex' },
      { id: POST_DATA.ben_expensive_government.hex, name: 'Ben Government', type: 'hex' },
    ];

    // Different relay configurations
    const relayConfigs = [
      { relays: 'wss://relay.damus.io', name: 'Damus Relay' },
      { relays: 'wss://relay.snort.social', name: 'Snort Social' },
      { relays: 'wss://nos.lol', name: 'Nos.lol' },
      { relays: 'wss://relay.nostr.band', name: 'Nostr Band' },
      { relays: 'wss://relay.damus.io,wss://relay.snort.social', name: 'Multiple Relays' },
      { relays: 'wss://no.netsec.vip/', name: 'New Relay' },
      { relays: 'wss://invalid-relay.nonexistent', name: 'Invalid Relay' },
      { relays: '', name: 'No Relays' },
    ];

    let noteIdIndex = 0;
    let relayIndex = 0;
    let changeCount = 0;

    // Function to update status display
    const updateStatusDisplay = (currentNoteId: any, currentRelays: any) => {
      const noteIdElement = document.getElementById('current-noteid');
      const relaysElement = document.getElementById('current-relays');
      
      if (noteIdElement && currentNoteId != null) {
        noteIdElement.innerHTML = `<strong>Note ID:</strong> ${currentNoteId.name} (${currentNoteId.id.substring(0, 20)}...)`;
      }
      
      if (relaysElement && currentRelays != null) {
        relaysElement.innerHTML = `<strong>Relays:</strong> ${currentRelays.name} (${currentRelays.relays || 'none'})`;
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
        if (entries.length > 40) {
          logElement.innerHTML = entries.slice(0, 40).join('<br>');
        }
      }
    };

    let isFastMode = true;
    let fastUpdateCount = 0;
    const maxFastUpdates = 10; // Number of fast updates before pause

    // Function to update note ID or hex only
    const updateNoteId = () => {
      const currentNoteId = noteIds[noteIdIndex];
      
      // Clear previous attributes
      component.removeAttribute('noteid');
      component.removeAttribute('hex');
      
      // Update with correct attribute type
      component.setAttribute(currentNoteId.type, currentNoteId.id);
      
      // Log the change
      addLogEntry(`${currentNoteId.type.toUpperCase()} changed to ${currentNoteId.name}`);
      console.log(`${currentNoteId.type.toUpperCase()} change ${++changeCount}:`, {
        [currentNoteId.type]: `${currentNoteId.name} (${currentNoteId.id})`
      });
      
      // Update status display immediately after change
      updateStatusDisplay(currentNoteId, null);
      
      // Move to next note ID
      noteIdIndex = (noteIdIndex + 1) % noteIds.length;
    };

    // Function to update relays only
    const updateRelays = () => {
      const currentRelays = relayConfigs[relayIndex];
      
      // Update relays
      if (currentRelays.relays) {
        component.setAttribute('relays', currentRelays.relays);
      } else {
        component.removeAttribute('relays');
      }
      
      // Log the change
      addLogEntry(`Relays changed to ${currentRelays.name}`);
      console.log(`Relay change ${++changeCount}:`, {
        relays: `${currentRelays.name} (${currentRelays.relays || 'none'})`
      });
      
      // Update status display immediately after change
      updateStatusDisplay(null, currentRelays);
      
      // Move to next relay configuration
      relayIndex = (relayIndex + 1) % relayConfigs.length;
    };

    // Function to handle fast updates
    const performFastUpdate = () => {
      if (fastUpdateCount >= maxFastUpdates) {
        // Switch to pause mode
        isFastMode = false;
        fastUpdateCount = 0;
        addLogEntry(`Pausing for 15000ms...`);
        console.log('Switching to pause mode for 15000ms');
        
        // Schedule next fast cycle after pause
        setTimeout(() => {
          isFastMode = true;
          addLogEntry(`Resuming fast updates...`);
          console.log('Resuming fast updates');
          performFastUpdate();
        }, 15000);
        return;
      }

      // Alternate between note ID and relay updates
      if (fastUpdateCount % 2 === 0) {
        updateNoteId();
      } else {
        updateRelays();
      }

      fastUpdateCount++;

      // Schedule next fast update with random delay between 50-100ms
      const nextDelay = 100 + Math.random() * 100; // 100-200ms
      setTimeout(performFastUpdate, nextDelay);
    };

    // Initial status update
    updateStatusDisplay(noteIds[noteIdIndex], relayConfigs[relayIndex]);

    // Start the fast update cycle
    addLogEntry(`Starting fast update cycle...`);
    performFastUpdate();
    
  },
};
