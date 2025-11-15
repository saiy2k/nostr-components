// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Like Button/Testing/Invalid',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'Invalid test cases for the nostr-like component demonstrating error handling and validation.',
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

export const InvalidUrl: Story = {
  name: TEST_CASES.invalidUrl.name,
  args: TEST_CASES.invalidUrl.args,
};

export const LongText: Story = {
  name: TEST_CASES.longText.name,
  args: TEST_CASES.longText.args,
};

export const InvalidRelay: Story = {
  name: TEST_CASES.invalidRelay.name,
  args: TEST_CASES.invalidRelay.args,
};
