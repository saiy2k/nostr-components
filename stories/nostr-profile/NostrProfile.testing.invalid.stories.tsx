import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta = {
  title: 'NostrProfile/Testing/Invalid',
  tags: ['test', 'invalid'],
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

// Stories from InvalidCasesDashboard
export const InvalidNpub: Story = {
  name: 'Invalid NPub Format',
  args: INVALID_TEST_CASES.invalidNpub.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidNpub.description,
      },
    },
  },
};

export const InvalidNip05: Story = {
  name: 'Invalid NIP-05 Format',
  args: INVALID_TEST_CASES.invalidNip05.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidNip05.description,
      },
    },
  },
};

export const InvalidPubkey: Story = {
  name: 'Invalid Pubkey Format',
  args: INVALID_TEST_CASES.invalidPubkey.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidPubkey.description,
      },
    },
  },
};

export const EmptyInputs: Story = {
  name: 'Empty/Null Inputs',
  args: INVALID_TEST_CASES.emptyInputs.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.emptyInputs.description,
      },
    },
  },
};

export const InvalidTheme: Story = {
  name: 'Invalid Theme Value',
  args: INVALID_TEST_CASES.invalidTheme.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidTheme.description,
      },
    },
  },
};

export const NetworkFailure: Story = {
  name: 'Network/Relay Failure',
  args: INVALID_TEST_CASES.networkFailure.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.networkFailure.description,
      },
    },
  },
};