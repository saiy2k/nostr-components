import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils';
import { TEST_CASES } from './test-cases-valid';

const meta = {
  title: 'NostrProfile/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile',
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

// Stories from ValidCasesDashboard
export const DarkTheme: Story = {
  name: 'Dark Theme',
  args: TEST_CASES.darkTheme.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.darkTheme.description,
      },
    },
  },
};

export const Lyn: Story = {
  name: 'Lyn - NIP-05',
  args: TEST_CASES.lyn.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.lyn.description,
      },
    },
  },
};

export const ShowFollow: Story = {
  name: 'Show Follow Button',
  args: TEST_CASES.showFollow.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.showFollow.description,
      },
    },
  },
};

export const RawPubkey: Story = {
  name: 'Raw Pubkey Input',
  args: TEST_CASES.rawPubkey.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.rawPubkey.description,
      },
    },
  },
};

export const CustomRelays: Story = {
  name: 'Custom Relays',
  args: TEST_CASES.customRelays.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.customRelays.description,
      },
    },
  },
};
