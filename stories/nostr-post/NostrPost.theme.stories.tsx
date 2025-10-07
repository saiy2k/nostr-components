import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { POST_THEMES } from './theme';
import { POST_DATA } from '../post-data';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'NostrPost/Themes',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
};

export default meta;
type Story = StoryObj;

export const OceanGlass: Story = {
  name: TEST_CASES.oceanGlassTheme.name,
  args: {
    noteid: TEST_CASES.oceanGlassTheme.args.noteid,
    ...POST_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographicTheme.name,
  args: {
    noteid: TEST_CASES.holographicTheme.args.noteid,
    ...POST_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrixTheme.name,
  args: {
    noteid: TEST_CASES.neoMatrixTheme.args.noteid,
    ...POST_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrangeTheme.name,
  args: {
    noteid: TEST_CASES.bitcoinOrangeTheme.args.noteid,
    ...POST_THEMES['bitcoin-orange'],
  },
};

