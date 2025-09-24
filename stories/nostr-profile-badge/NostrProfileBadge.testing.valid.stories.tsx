import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Valid',
  tags: ['test', 'valid'],
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
// VALID CASES - Individual Stories
// ====================================

export const ShowNPub: Story = {
  name: 'Show NPub Feature',
  tags: ['test', 'features', 'valid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests the show-npub feature display and copy functionality.',
      },
    },
  },
};

export const ShowFollow: Story = {
  name: 'Show Follow Button',
  tags: ['test', 'features', 'valid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
    'show-follow': true,
    theme: 'dark',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests the follow button integration and functionality.',
      },
    },
  },
};

export const PubkeyInput: Story = {
  name: 'Raw Pubkey Input',
  tags: ['test', 'input-types', 'valid'],
  args: {
    width: DEFAULT_WIDTH,
    pubkey: '1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component with raw hex pubkey instead of npub.',
      },
    },
  },
};

export const NarrowWidth: Story = {
  name: 'Narrow Width',
  tags: ['test', 'responsive', 'valid'],
  args: {
    width: 200,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component responsiveness at narrow widths.',
      },
    },
  },
};

export const ExtremelyWideWidth: Story = {
  name: 'Extremely Wide Width',
  tags: ['test', 'responsive', 'valid'],
  args: {
    width: 1200,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component behavior at very wide widths.',
      },
    },
  },
};

export const HighContrastTest: Story = {
  name: 'High Contrast Test',
  tags: ['test', 'a11y', 'valid'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'dark',
    '--nstrc-profile-badge-background-dark': '#000000',
    '--nstrc-profile-badge-name-color-dark': '#FFFFFF',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests high contrast mode for visually impaired users.',
      },
    },
  },
};
