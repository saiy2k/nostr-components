import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes } from './testing-utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';
import { PROFILE_DATA } from '../profile-data.ts';

// Theme presets for CSS variable-based theming
const THEME_PRESETS = {
  'Ocean Glass': {
    '--nostrc-profile-bg': 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(135deg, #0b486b, #f56217)',
    '--nostrc-profile-text-primary': '#e8fbff',
    '--nostrc-profile-text-secondary': '#c8e6f0',
    '--nostrc-profile-border': '1px solid rgba(232,251,255,0.35)',
    '--nostrc-profile-accent': '#e8fbff',
  },
  'Holographic': {
    '--nostrc-profile-bg': 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 30%, #84fab0 60%, #8fd3f4 100%)',
    '--nostrc-profile-text-primary': '#1b2a2f',
    '--nostrc-profile-text-secondary': '#2a3a3f',
    '--nostrc-profile-border': '1px solid rgba(27,42,47,0.25)',
    '--nostrc-profile-accent': '#1b2a2f',
  },
  'Neo Matrix': {
    '--nostrc-profile-bg': '#061a12',
    '--nostrc-profile-text-primary': '#00ff88',
    '--nostrc-profile-text-secondary': '#00cc66',
    '--nostrc-profile-border': '2px solid #00ff66',
    '--nostrc-profile-accent': '#00ff88',
  },
  'Bitcoin Orange': {
    '--nostrc-profile-bg': '#F7931A',
    '--nostrc-profile-text-primary': '#1a1a1a',
    '--nostrc-profile-text-secondary': '#333333',
    '--nostrc-profile-border': '1px solid #cc6f00',
    '--nostrc-profile-accent': '#1a1a1a',
  },
};

const meta: Meta = {
  title: 'NostrProfile',
  tags: ['autodocs'],
  render: args => {
    const html = generateCode(args);
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true);
  },
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: {
      description: {
        component: 'A web component for displaying comprehensive Nostr profile information including user stats, banner, avatar, bio, and optional features like npub display and follow button integration.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ====================================
// PUBLIC DEMO STORIES
// ====================================

export const Jb55: Story = {
  name: 'jb55 - Default',
  args: TEST_CASES.jb55.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.jb55.description,
      },
    },
  },
};

export const JackDorsey: Story = {
  name: 'Jack Dorsey - Dark theme',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  parameters: {
    docs: {
      description: {
        story: 'Jack Dorsey profile with dark theme styling.',
      },
    },
  },
};

export const DerGigi: Story = {
  name: 'Dergigi - nip05, follow button',
  args: TEST_CASES.derGigi.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.derGigi.description,
      },
    },
  },
};

// ====================================
// CSS VARIABLE THEME STORIES
// ====================================

export const OceanGlass: Story = {
  name: 'Ocean Glass',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    'show-follow': true,
    ...THEME_PRESETS['Ocean Glass'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile with Ocean Glass theme applied via CSS variables. This demonstrates the new theme architecture using CSS custom properties.',
      },
    },
  },
};

export const Holographic: Story = {
  name: 'Holographic',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    'show-follow': true,
    ...THEME_PRESETS['Holographic'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile with Holographic theme applied via CSS variables. This demonstrates the new theme architecture using CSS custom properties.',
      },
    },
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    'show-follow': true,
    ...THEME_PRESETS['Neo Matrix'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile with Neo Matrix theme applied via CSS variables. This demonstrates the new theme architecture using CSS custom properties.',
      },
    },
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    'show-follow': true,
    ...THEME_PRESETS['Bitcoin Orange'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile with Bitcoin Orange theme applied via CSS variables. This demonstrates the new theme architecture using CSS custom properties.',
      },
    },
  },
};