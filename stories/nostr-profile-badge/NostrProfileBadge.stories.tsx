import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes } from './testing-utils.ts';

const meta: Meta = {
  title: 'NostrProfileBadge',
  render: args => {
    const html = generateCode(args);
    // Create a template element to avoid HTML encoding
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true);
  },
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: {
      description: {
        component: 'A web component for displaying Nostr profile information in a compact badge format. Supports npub, nip05, and raw pubkey inputs with light/dark theme support and optional features like npub display and follow button integration.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ====================================
// PUBLIC DEMO STORIES
// ====================================

export const Default: Story = {
  name: 'Fiatjaf - Default',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Default profile badge with npub input.',
      },
    },
  },
};

export const Odell: Story = {
  name: 'Odell - Dark Theme',
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
    theme: 'dark',
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile badge with dark theme.',
      },
    },
  },
};

export const Lyn: Story = {
  name: 'Lyn - Nip05',
  args: {
    width: DEFAULT_WIDTH,
    nip05: 'lyn@primal.net',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Profile badge with nip05',
      },
    },
  },
};