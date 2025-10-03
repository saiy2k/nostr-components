import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrFollowButton/Testing/Invalid',
  tags: ['test', 'invalid'],
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

export const InvalidNPub: Story = {
  name: INVALID_TEST_CASES.invalidNpub.name,
  tags: ['test', 'error-handling', 'invalid'],
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
  name: INVALID_TEST_CASES.invalidNip05.name,
  tags: ['test', 'error-handling', 'invalid'],
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
  name: INVALID_TEST_CASES.invalidPubkey.name,
  tags: ['test', 'error-handling', 'invalid'],
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
  name: INVALID_TEST_CASES.emptyInputs.name,
  tags: ['test', 'edge-cases', 'invalid'],
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
  name: INVALID_TEST_CASES.invalidTheme.name,
  tags: ['test', 'error-handling', 'invalid'],
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
  name: INVALID_TEST_CASES.networkFailure.name,
  tags: ['test', 'network', 'invalid'],
  args: INVALID_TEST_CASES.networkFailure.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.networkFailure.description,
      },
    },
  },
};
