import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Zap Button',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'A web component that displays a zap button for Nostr profiles. Supports npub, nip05, and pubkey inputs with theme customization and zap amount configuration.',
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

export const Default: Story = {
  name: TEST_CASES.default.name,
  args: TEST_CASES.default.args,
};

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
