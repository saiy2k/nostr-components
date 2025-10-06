import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { PROFILE_DATA, getAllInputTypes } from '../profile-data.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Dynamic',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
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

export const DynamicNPubChanges: Story = {
  name: 'Dynamic Npub Changes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-profile-badge');
    if (!component) return;

    // Array of different npubs from profile data
    const npubs = [
      PROFILE_DATA.jack.npub,
      PROFILE_DATA.derGigi.npub,
      PROFILE_DATA.fiatjaf.npub,
      PROFILE_DATA.jb55.npub,
      PROFILE_DATA.odell.npub,
    ];

    let currentIndex = 0;
    let intervalId: NodeJS.Timeout;
    
    // Function to update npub
    const updateNPub = () => {
      currentIndex = (currentIndex + 1) % npubs.length;
      component.setAttribute('npub', npubs[currentIndex]);
      
      // Log the change for debugging
      console.log(`Updated npub to: ${npubs[currentIndex]}`);
    };

    // Start the interval
    intervalId = setInterval(updateNPub, 5000);
    
    // Store cleanup function on the component for potential cleanup
    (component as any).__cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('DynamicNPubChanges: Interval cleared');
      }
    };
  },
};

export const DynamicAllAttributes: Story = {
  name: 'Dynamic All Attributes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-profile-badge');
    if (!component) return;

    // Create static input list display
    const createStaticInputList = (inputs: Array<{type: string, value: string, name: string}>) => {
      return inputs.map((input, index) => {
        const isValid = !input.name.includes('Invalid') && !input.name.includes('Empty');
        const displayName = isValid ? input.name : input.value;
        const displayCase = isValid ? input.type : input.name;
        return `<div id="input-item-${index}" style="margin: 2px 0;">${index + 1}. ${displayName} - ${displayCase}</div>`;
      }).join('');
    };

    // Test data - 5 valid cases and 5 invalid cases
    const validInputs = [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'nip05', value: PROFILE_DATA.derGigi.nip05, name: 'DerGigi' },
      { type: 'pubkey', value: PROFILE_DATA.fiatjaf.pubkey, name: 'Fiatjaf' },
      { type: 'npub', value: PROFILE_DATA.jb55.npub, name: 'jb55' },
      { type: 'nip05', value: PROFILE_DATA.lyn.nip05, name: 'Lyn' },
    ];
    
    const invalidInputs = [
      { type: 'npub', value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
      { type: 'nip05', value: INVALID_TEST_CASES.invalidNip05.args.nip05, name: 'Invalid NIP-05' },
      { type: 'pubkey', value: INVALID_TEST_CASES.invalidPubkey.args.pubkey, name: 'Invalid Pubkey' },
      { type: 'npub', value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
      { type: 'nip05', value: INVALID_TEST_CASES.emptyInputs.args.nip05, name: 'Empty NIP-05' },
    ];
    
    // Mix valid and invalid inputs randomly
    const allInputs = [...validInputs, ...invalidInputs];
    const inputs = allInputs.sort(() => Math.random() - 0.5);
    
    const themes = ['light', 'dark'];
    let showFollow = true;
    let showNpub = false;
    
    let inputIndex = 0;
    let themeIndex = 0;

    // Create input list container with static list
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
      <div id="input-list">${createStaticInputList(inputs)}</div>
    `;
    
    // Insert after the component
    component.parentNode?.insertBefore(inputListContainer, component.nextSibling);
    
    // Highlight the first item initially
    const firstItemElement = document.getElementById(`input-item-${inputIndex}`);
    if (firstItemElement) {
      firstItemElement.style.fontWeight = 'bold';
      firstItemElement.style.backgroundColor = '#e3f2fd';
      firstItemElement.style.padding = '4px 8px';
      firstItemElement.style.borderRadius = '4px';
    }
    
    // Function to update all attributes and input types
    const updateAllAttributes = () => {
      const input = inputs[inputIndex];
      
      // Clear all input attributes
      component.removeAttribute('npub');
      component.removeAttribute('nip05');
      component.removeAttribute('pubkey');
      
      // Set the new input
      component.setAttribute(input.type, input.value);
      
      // Update theme
      themeIndex = (themeIndex + 1) % themes.length;
      component.setAttribute('data-theme', themes[themeIndex]);
      
      // Update show-follow
      showFollow = !showFollow;
      component.setAttribute('show-follow', showFollow.toString());
      
      // Update show-npub
      showNpub = !showNpub;
      component.setAttribute('show-npub', showNpub.toString());
      
      // Update input list display - highlight current item only
      // Clear previous highlights
      inputs.forEach((_, index) => {
        const itemElement = document.getElementById(`input-item-${index}`);
        if (itemElement) {
          itemElement.style.fontWeight = 'normal';
          itemElement.style.backgroundColor = 'transparent';
          itemElement.style.padding = '0';
          itemElement.style.borderRadius = '0';
        }
      });
      
      // Highlight current item
      const currentItemElement = document.getElementById(`input-item-${inputIndex}`);
      if (currentItemElement) {
        currentItemElement.style.fontWeight = 'bold';
        currentItemElement.style.backgroundColor = '#e3f2fd';
        currentItemElement.style.padding = '4px 8px';
        currentItemElement.style.borderRadius = '4px';
      }
      
      // Log the changes for debugging
      console.log(`Updated all attributes:`, {
        input: `${input.type}: ${input.value} (${input.name})`,
        theme: themes[themeIndex],
        showFollow: showFollow,
        showNpub: showNpub
      });
      
      inputIndex = (inputIndex + 1) % inputs.length;
    };

    // Start the interval
    const intervalId = setInterval(updateAllAttributes, 5000);
    
    // Store cleanup function on the component for potential cleanup
    (component as any).__cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('DynamicAllAttributes: Interval cleared');
      }
    };
  },
};

export const DynamicNPubAndRelays: Story = {
  name: 'Dynamic NPub and Relays',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
    relays: 'wss://relay.damus.io',
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-profile-badge');
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
      <div id="current-npub" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-relays" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="change-log" style="font-size: 11px; color: #6c757d; height: 500px; max-height: 500px; overflow-y: auto;"></div>
    `;
    
    // Insert after the component
    component.parentNode?.insertBefore(statusContainer, component.nextSibling);

    // Different npubs to cycle through
    const npubs = [
      { npub: PROFILE_DATA.jack.npub, name: 'Jack' },
      { npub: PROFILE_DATA.derGigi.npub, name: 'DerGigi' },
      { npub: PROFILE_DATA.fiatjaf.npub, name: 'Fiatjaf' },
      { npub: PROFILE_DATA.jb55.npub, name: 'jb55' },
      { npub: PROFILE_DATA.odell.npub, name: 'Odell' },
      { npub: PROFILE_DATA.lyn.npub, name: 'Lyn' },
      { npub: PROFILE_DATA.utxo.npub, name: 'Utxo' },
      { npub: PROFILE_DATA.saiy2k.npub, name: 'Sai' },
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

    let npubIndex = 0;
    let relayIndex = 0;
    let changeCount = 0;

    // Function to update status display
    const updateStatusDisplay = (currentNpub: any, currentRelays: any) => {
      const npubElement = document.getElementById('current-npub');
      const relaysElement = document.getElementById('current-relays');
      
      if (npubElement && currentNpub != null) {
        npubElement.innerHTML = `<strong>NPub:</strong> ${currentNpub.name} (${currentNpub.npub.substring(0, 20)}...)`;
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
    
    // Store timeout IDs for cleanup
    let timeoutId: NodeJS.Timeout | null = null;

    // Function to update npub only
    const updateNPub = () => {
      const currentNpub = npubs[npubIndex];
      
      // Update npub
      component.setAttribute('npub', currentNpub.npub);
      
      // Log the change
      addLogEntry(`NPub changed to ${currentNpub.name}`);
      console.log(`NPub change ${++changeCount}:`, {
        npub: `${currentNpub.name} (${currentNpub.npub})`
      });
      
      // Update status display immediately after change
      updateStatusDisplay(currentNpub, null);
      
      // Move to next npub
      npubIndex = (npubIndex + 1) % npubs.length;
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
        timeoutId = setTimeout(() => {
          isFastMode = true;
          addLogEntry(`Resuming fast updates...`);
          console.log('Resuming fast updates');
          performFastUpdate();
        }, 15000);
        return;
      }

      // Alternate between npub and relay updates
      if (fastUpdateCount % 2 === 0) {
        updateNPub();
      } else {
        updateRelays();
      }

      fastUpdateCount++;

      // Schedule next fast update with random delay between 50-100ms
      const nextDelay = 100 + Math.random() * 100; // 100-200ms
      timeoutId = setTimeout(performFastUpdate, nextDelay);
    };

    // Initial status update
    updateStatusDisplay(npubs[npubIndex], relayConfigs[relayIndex]);

    // Start the fast update cycle
    addLogEntry(`Starting fast update cycle...`);
    performFastUpdate();
    
    // Store cleanup function on the component for potential cleanup
    (component as any).__cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        console.log('DynamicNPubAndRelays: Timeout cleared');
      }
    };
  },
};

