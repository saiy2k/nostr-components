import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';
import { PROFILE_DATA } from '../profile-data.ts';

const meta = {
  title: 'NostrFollowButton/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
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

export const NPubInput: Story = {
  name: TEST_CASES.npub.name,
  tags: ['test', 'input-types', 'valid'],
  args: TEST_CASES.npub.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.npub.description,
      },
    },
  },
};

export const Nip05Input: Story = {
  name: TEST_CASES.nip05.name,
  tags: ['test', 'input-types', 'valid'],
  args: TEST_CASES.nip05.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.nip05.description,
      },
    },
  },
};

export const RawPubkeyInput: Story = {
  name: TEST_CASES.pubkey.name,
  tags: ['test', 'input-types', 'valid'],
  args: TEST_CASES.pubkey.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.pubkey.description,
      },
    },
  },
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  tags: ['test', 'themes', 'valid'],
  args: TEST_CASES.darkTheme.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.darkTheme.description,
      },
    },
  },
};

export const NarrowWidth: Story = {
  name: TEST_CASES.narrowWidth.name,
  tags: ['test', 'responsive', 'valid'],
  args: TEST_CASES.narrowWidth.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.narrowWidth.description,
      },
    },
  },
};


