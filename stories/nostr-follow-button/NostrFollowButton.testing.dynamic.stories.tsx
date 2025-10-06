import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";



import { PROFILE_DATA } from '../profile-data.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrFollowButton/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-follow-button',
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
    npub: PROFILE_DATA.jack.npub,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-follow-button');
    if (!component) return;

    const testInputs = [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'nip05', value: PROFILE_DATA.fiatjaf.nip05, name: 'Fiatjaf' },
      { type: 'pubkey', value: PROFILE_DATA.jb55.pubkey, name: 'jb55' },
      { type: 'npub', value: PROFILE_DATA.odell.npub, name: 'Odell' },
    ];

    let currentIndex = 0;
    
    const updateInput = () => {
      currentIndex = (currentIndex + 1) % testInputs.length;
      const input = testInputs[currentIndex];
      
      // Clear all inputs first
      component.removeAttribute('npub');
      component.removeAttribute('nip05');
      component.removeAttribute('pubkey');
      
      // Set the new input
      if (input.type === 'npub') {
        component.setAttribute('npub', input.value);
      } else if (input.type === 'nip05') {
        component.setAttribute('nip05', input.value);
      } else if (input.type === 'pubkey') {
        component.setAttribute('pubkey', input.value);
      }
      
      console.log(`Updated ${input.type} to: ${input.name}`);
    };

    setInterval(updateInput, 8000);
  },
};

export const DynamicThemeChanges: Story = {
  name: 'Dynamic Theme Changes',
  tags: ['test', 'dynamic', 'themes'],
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-follow-button');
    if (!component) return;

    const themes = ['light', 'dark'];
    let themeIndex = 0;
    
    const updateTheme = () => {
      themeIndex = (themeIndex + 1) % themes.length;
      component.setAttribute('theme', themes[themeIndex]);
      console.log(`Updated theme to: ${themes[themeIndex]}`);
    };

    setInterval(updateTheme, 5000);
  },
};

export const DynamicAllChanges: Story = {
  name: 'Dynamic All Changes',
  tags: ['test', 'dynamic', 'comprehensive'],
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector('nostr-follow-button');
    if (!component) return;

    const inputs = [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'nip05', value: PROFILE_DATA.fiatjaf.nip05, name: 'Fiatjaf' },
      { type: 'pubkey', value: PROFILE_DATA.jb55.pubkey, name: 'jb55' },
      { type: 'npub', value: PROFILE_DATA.odell.npub, name: 'Odell' },
    ];

    const themes = ['light', 'dark'];
    const widths = [300, 250, 200, 400];
    
    let inputIndex = 0;
    let themeIndex = 0;
    let widthIndex = 0;

    const updateAll = () => {
      // Update input
      const input = inputs[inputIndex];
      component.removeAttribute('npub');
      component.removeAttribute('nip05');
      component.removeAttribute('pubkey');
      
      if (input.type === 'npub') {
        component.setAttribute('npub', input.value);
      } else if (input.type === 'nip05') {
        component.setAttribute('nip05', input.value);
      } else if (input.type === 'pubkey') {
        component.setAttribute('pubkey', input.value);
      }

      // Update theme
      component.setAttribute('theme', themes[themeIndex]);
      
      // Update width
      const container = component.parentElement;
      if (container) {
        container.style.width = `${widths[widthIndex]}px`;
      }

      // Cycle indices
      inputIndex = (inputIndex + 1) % inputs.length;
      themeIndex = (themeIndex + 1) % themes.length;
      widthIndex = (widthIndex + 1) % widths.length;

      console.log(`Updated: ${input.name} (${input.type}), ${themes[themeIndex]} theme, ${widths[widthIndex]}px width`);
    };

    setInterval(updateAll, 6000);
  },
};
