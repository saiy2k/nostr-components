import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: { disable: true },
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
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

// ====================================
// INVALID CASES - Individual Stories
// ====================================

export const InvalidNPub: Story = {
  name: 'Invalid NPub Format',
  tags: ['test', 'error-handling', 'invalid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'invalid-npub-format-xyz123',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests how the component handles malformed npub input.',
      },
    },
  },
};

export const InvalidNip05: Story = {
  name: 'Invalid NIP-05',
  tags: ['test', 'error-handling', 'invalid'],
  args: {
    width: DEFAULT_WIDTH,
    nip05: 'malformed@invalid@domain.com',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests how the component handles malformed NIP-05 format.',
      },
    },
  },
};

export const EmptyInputs: Story = {
  name: 'Empty/Null Inputs',
  tags: ['test', 'edge-cases', 'invalid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: '',
    nip05: '',
    pubkey: '',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component behavior with empty or null values.',
      },
    },
  },
};

export const NetworkFailure: Story = {
  name: 'Network/Relay Failure',
  tags: ['test', 'network', 'invalid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    relays: 'wss://invalid-relay.nonexistent',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component resilience with unreachable relays.',
      },
    },
  },
};
