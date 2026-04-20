import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes, getTestingParameters } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Zap Button/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: getTestingParameters(),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const Nip05: Story = {
  name: TEST_CASES.nip05.name,
  args: TEST_CASES.nip05.args,
};

export const RawPubkey: Story = {
  name: TEST_CASES.rawPubkey.name,
  args: TEST_CASES.rawPubkey.args,
};

export const CustomText: Story = {
  name: TEST_CASES.customText.name,
  args: TEST_CASES.customText.args,
};

export const FixedAmount: Story = {
  name: TEST_CASES.fixedAmount.name,
  args: TEST_CASES.fixedAmount.args,
};

export const DefaultAmount: Story = {
  name: TEST_CASES.defaultAmount.name,
  args: TEST_CASES.defaultAmount.args,
};

export const CustomIconSize: Story = {
  name: TEST_CASES.customIconSize.name,
  args: TEST_CASES.customIconSize.args,
};
