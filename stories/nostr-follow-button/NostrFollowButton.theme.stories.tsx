import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { FOLLOW_BUTTON_THEMES } from './theme';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'NostrFollowButton/Themes',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
};

export default meta;
type Story = StoryObj;

export const OceanGlass: Story = {
  name: TEST_CASES.oceanGlass.name,
  args: {
    ...TEST_CASES.oceanGlass.args,
    ...FOLLOW_BUTTON_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographic.name,
  args: {
    ...TEST_CASES.holographic.args,
    ...FOLLOW_BUTTON_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrix.name,
  args: {
    ...TEST_CASES.neoMatrix.args,
    ...FOLLOW_BUTTON_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrange.name,
  args: {
    ...TEST_CASES.bitcoinOrange.args,
    ...FOLLOW_BUTTON_THEMES['bitcoin-orange'],
  },
};

