import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { STREAM_THEMES } from './theme';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Stream/Styling',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
};

export default meta;
type Story = StoryObj<any>;

export const OceanGlass: Story = {
  name: TEST_CASES.oceanGlassTheme.name,
  args: {
    naddr: TEST_CASES.oceanGlassTheme.args.naddr,
    ...STREAM_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: TEST_CASES.holographicTheme.name,
  args: {
    naddr: TEST_CASES.holographicTheme.args.naddr,
    ...STREAM_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: TEST_CASES.neoMatrixTheme.name,
  args: {
    naddr: TEST_CASES.neoMatrixTheme.args.naddr,
    ...STREAM_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: TEST_CASES.bitcoinOrangeTheme.name,
  args: {
    naddr: TEST_CASES.bitcoinOrangeTheme.args.naddr,
    ...STREAM_THEMES['bitcoin-orange'],
  },
};
