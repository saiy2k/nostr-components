import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes } from './testing-utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';

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
  args: TEST_CASES.darkTheme.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.darkTheme.description,
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