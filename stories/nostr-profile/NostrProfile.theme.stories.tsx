import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { PROFILE_THEMES } from './theme';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'NostrProfile/Themes',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
};

export default meta;
type Story = StoryObj<any>;

export const OceanGlass: Story = {
  name: TEST_CASES.oceanGlass.name,
  args: {
    ...TEST_CASES.oceanGlass.args,
    ...PROFILE_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographic.name,
  args: {
    ...TEST_CASES.holographic.args,
    ...PROFILE_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrix.name,
  args: {
    ...TEST_CASES.neoMatrix.args,
    ...PROFILE_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrange.name,
  args: {
    ...TEST_CASES.bitcoinOrange.args,
    ...PROFILE_THEMES['bitcoin-orange'],
  },
};
