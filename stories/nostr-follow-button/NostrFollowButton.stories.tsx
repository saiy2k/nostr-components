import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';

const meta: Meta = {
  title: 'NostrFollowButton',
  tags: ['autodocs'],
  render: args => {
    const html = generateCode(args);
    // Create a template element to avoid HTML encoding
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true);
  },
  argTypes: getArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: {
      description: {
        component: 'A web component for displaying Nostr follow button functionality. Supports npub, nip05, and raw pubkey inputs with light/dark theme support and optional features like npub display.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: 'Default',
  args: TEST_CASES.default.args,
};

export const DarkTheme: Story = {
  name: 'Dark theme',
  args: {
    ...TEST_CASES.darkTheme.args,
  },
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.darkTheme.description,
      },
    },
  },
};

export const Nip05: Story = {
  name: 'Nip05',
  args: TEST_CASES.nip05.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.nip05.description,
      },
    },
  },
};

export const RawPubkey: Story = {
  name: 'Raw pubkey (hex)',
  args: TEST_CASES.rawPubkey.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.rawPubkey.description,
      },
    },
  },
};