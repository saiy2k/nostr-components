import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils';
import { TEST_CASES } from './test-cases-valid';

const meta = {
  title: 'NostrPost/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
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
export const GigiFreeWeb: Story = {
  name: 'Gigi - Free Web',
  args: TEST_CASES.gigiFreeWeb.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.gigiFreeWeb.description,
      },
    },
  },
};

export const UtxoUsDollarBacking: Story = {
  name: 'UTXO - US Dollar Backing',
  args: TEST_CASES.utxoUsDollarBacking.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.utxoUsDollarBacking.description,
      },
    },
  },
};

export const ToxicBitcoinerImage: Story = {
  name: 'Toxic Bitcoiner - Image',
  args: TEST_CASES.toxicBitcoinerImage.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.toxicBitcoinerImage.description,
      },
    },
  },
};

export const NarrowWidth: Story = {
  name: 'Narrow Width',
  args: TEST_CASES.narrowWidth.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.narrowWidth.description,
      },
    },
  },
};

export const WideWidth: Story = {
  name: 'Wide Width',
  args: TEST_CASES.wideWidth.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.wideWidth.description,
      },
    },
  },
};

export const NoStats: Story = {
  name: 'No Stats Display',
  args: TEST_CASES.noStats.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.noStats.description,
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

export const MediaPost: Story = {
  name: 'Media Post',
  args: TEST_CASES.mediaPost.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.mediaPost.description,
      },
    },
  },
};

export const ImagePost: Story = {
  name: 'Image Post',
  args: TEST_CASES.imagePost.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.imagePost.description,
      },
    },
  },
};
