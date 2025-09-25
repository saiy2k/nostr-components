import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { TEST_CASES } from './test-cases.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
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

export const ShowNPub: Story = {
  name: TEST_CASES.showNpub.name,
  tags: ['test', 'features', 'valid'],
  args: TEST_CASES.showNpub.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.showNpub.description,
      },
    },
  },
};

export const ShowFollow: Story = {
  name: TEST_CASES.showFollow.name,
  tags: ['test', 'features', 'valid'],
  args: TEST_CASES.showFollow.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.showFollow.description,
      },
    },
  },
};

export const RawPubkeyInput: Story = {
  name: TEST_CASES.rawPubkey.name,
  tags: ['test', 'input-types', 'valid'],
  args: TEST_CASES.rawPubkey.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.rawPubkey.description,
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

export const ShowFollowButton: Story = {
  name: TEST_CASES.showFollow.name,
  tags: ['test', 'features', 'valid'],
  args: TEST_CASES.showFollow.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.showFollow.description,
      },
    },
  },
};

export const AllFeatures: Story = {
  name: TEST_CASES.allFeatures.name,
  tags: ['test', 'features', 'valid'],
  args: TEST_CASES.allFeatures.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.allFeatures.description,
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

export const LynNip05: Story = {
  name: TEST_CASES.lyn.name,
  tags: ['test', 'input-types', 'valid'],
  args: TEST_CASES.lyn.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.lyn.description,
      },
    },
  },
};
