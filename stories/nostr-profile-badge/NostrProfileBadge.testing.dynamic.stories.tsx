import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { PROFILE_DATA, getAllInputTypes } from '../profile-data.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
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

// ====================================
// DYNAMIC ATTRIBUTE CHANGES
// ====================================

export const DynamicNPubChanges: Story = {
  name: 'Dynamic NPub Changes',
  tags: ['test', 'dynamic', 'attributes'],
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
    theme: 'light',
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
    
    // Function to update npub
    const updateNPub = () => {
      currentIndex = (currentIndex + 1) % npubs.length;
      component.setAttribute('npub', npubs[currentIndex]);
      
      // Log the change for debugging
      console.log(`Updated npub to: ${npubs[currentIndex]}`);
    };

    setInterval(updateNPub, 5000);
    
  },
};

export const DynamicAllAttributes: Story = {
  name: 'Dynamic All Attributes',
  tags: ['test', 'dynamic', 'comprehensive'],
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
    theme: 'light',
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-profile-badge');
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
    const showFollowOptions = [true, false];
    const showNpubOptions = [true, false];
    
    let inputIndex = 0;
    let themeIndex = 0;
    let showFollowIndex = 0;
    let showNpubIndex = 0;

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
      component.removeAttribute('npub');
      component.removeAttribute('nip05');
      component.removeAttribute('pubkey');
      
      // Set the new input
      component.setAttribute(input.type, input.value);
      
      // Update theme
      themeIndex = (themeIndex + 1) % themes.length;
      component.setAttribute('theme', themes[themeIndex]);
      
      // Update show-follow
      showFollowIndex = (showFollowIndex + 1) % showFollowOptions.length;
      component.setAttribute('show-follow', showFollowOptions[showFollowIndex].toString());
      
      // Update show-npub
      showNpubIndex = (showNpubIndex + 1) % showNpubOptions.length;
      component.setAttribute('show-npub', showNpubOptions[showNpubIndex].toString());
      
      // Update input list display
      const inputListElement = document.getElementById('input-list');
      if (inputListElement) {
        inputListElement.innerHTML = createInputList(inputs, inputIndex);
      }
      
      // Log the changes for debugging
      console.log(`Updated all attributes:`, {
        input: `${input.type}: ${input.value} (${input.name})`,
        theme: themes[themeIndex],
        showFollow: showFollowOptions[showFollowIndex],
        showNpub: showNpubOptions[showNpubIndex]
      });
      
      inputIndex = (inputIndex + 1) % inputs.length;
    };

    setInterval(updateAllAttributes, 5000);
    
  },
};

