import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from "./utils";
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Profile/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile',
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
type Story = StoryObj<any>;

// Stories from InvalidCasesDashboard
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