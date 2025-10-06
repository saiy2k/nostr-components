import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta = {
  title: 'NostrPost/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
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
};

export const UtxoUsDollarBacking: Story = {
  name: 'UTXO - US Dollar Backing',
  args: TEST_CASES.utxoUsDollarBacking.args,
};

export const ToxicBitcoinerImage: Story = {
  name: 'Toxic Bitcoiner - Image',
  args: TEST_CASES.toxicBitcoinerImage.args,
};

export const NarrowWidth: Story = {
  name: 'Narrow Width',
  args: TEST_CASES.narrowWidth.args,
};

export const WideWidth: Story = {
  name: 'Wide Width',
  args: TEST_CASES.wideWidth.args,
};

export const NoStats: Story = {
  name: 'No Stats Display',
  args: TEST_CASES.noStats.args,
};

export const CustomRelays: Story = {
  name: 'Custom Relays',
  args: TEST_CASES.customRelays.args,
};

export const MediaPost: Story = {
  name: 'Media Post',
  args: TEST_CASES.mediaPost.args,
};

export const ImagePost: Story = {
  name: 'Image Post',
  args: TEST_CASES.imagePost.args,
};
