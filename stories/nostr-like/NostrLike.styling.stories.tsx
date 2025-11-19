// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { LIKE_BUTTON_THEMES } from './theme';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Like Button/Styling',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {
    text: 'Like',
  },
  parameters: {
    docs: {
      description: {
        component: 'Styling examples for the nostr-like component using CSS variables.',
      },
      source: {
        transform: (code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const OceanGlass: Story = {
  name: TEST_CASES.oceanGlass.name,
  args: {
    ...TEST_CASES.oceanGlass.args,
    ...LIKE_BUTTON_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographic.name,
  args: {
    ...TEST_CASES.holographic.args,
    ...LIKE_BUTTON_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrix.name,
  args: {
    ...TEST_CASES.neoMatrix.args,
    ...LIKE_BUTTON_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrange.name,
  args: {
    ...TEST_CASES.bitcoinOrange.args,
    ...LIKE_BUTTON_THEMES['bitcoin-orange'],
  },
};
