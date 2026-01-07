import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Zap Button/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-zap-button',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const InvalidNpub: Story = {
  name: INVALID_TEST_CASES.invalidNpub.name,
  args: INVALID_TEST_CASES.invalidNpub.args,
};

export const InvalidNip05: Story = {
  name: INVALID_TEST_CASES.invalidNip05.name,
  args: INVALID_TEST_CASES.invalidNip05.args,
};

export const InvalidPubkey: Story = {
  name: INVALID_TEST_CASES.invalidPubkey.name,
  args: INVALID_TEST_CASES.invalidPubkey.args,
};

export const EmptyInputs: Story = {
  name: INVALID_TEST_CASES.emptyInputs.name,
  args: INVALID_TEST_CASES.emptyInputs.args,
};

export const InvalidRelay: Story = {
  name: INVALID_TEST_CASES.invalidRelay.name,
  args: INVALID_TEST_CASES.invalidRelay.args,
};

export const InvalidAmount: Story = {
  name: INVALID_TEST_CASES.invalidAmount.name,
  args: INVALID_TEST_CASES.invalidAmount.args,
};

export const AmountTooHigh: Story = {
  name: INVALID_TEST_CASES.amountTooHigh.name,
  args: INVALID_TEST_CASES.amountTooHigh.args,
};

export const InvalidDefaultAmount: Story = {
  name: INVALID_TEST_CASES.invalidDefaultAmount.name,
  args: INVALID_TEST_CASES.invalidDefaultAmount.args,
};

export const TextTooLong: Story = {
  name: INVALID_TEST_CASES.textTooLong.name,
  args: INVALID_TEST_CASES.textTooLong.args,
};
