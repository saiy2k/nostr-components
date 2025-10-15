import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { ZAP_BUTTON_THEMES } from './theme';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Zap Button/Styling',
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
    ...ZAP_BUTTON_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographic.name,
  args: {
    ...TEST_CASES.holographic.args,
    ...ZAP_BUTTON_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrix.name,
  args: {
    ...TEST_CASES.neoMatrix.args,
    ...ZAP_BUTTON_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrange.name,
  args: {
    ...TEST_CASES.bitcoinOrange.args,
    ...ZAP_BUTTON_THEMES['bitcoin-orange'],
  },
};
