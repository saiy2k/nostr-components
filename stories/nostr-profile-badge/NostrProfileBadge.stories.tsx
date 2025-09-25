import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes } from './testing-utils.ts';
import { TEST_CASES } from './test-cases.ts';

const meta: Meta = {
  title: 'NostrProfileBadge',
  tags: ['autodocs'],
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
  name: TEST_CASES.fiatjaf.name,
  args: TEST_CASES.fiatjaf.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.fiatjaf.description,
      },
    },
  },
};

export const Odell: Story = {
  name: TEST_CASES.odell.name,
  args: TEST_CASES.odell.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.odell.description,
      },
    },
  },
};

export const Lyn: Story = {
  name: TEST_CASES.lyn.name,
  args: TEST_CASES.lyn.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.lyn.description,
      },
    },
  },
};