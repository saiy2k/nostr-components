// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Like Button/Testing/Valid',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'Valid test cases for the nostr-like component demonstrating various configurations and use cases.',
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

export const CustomText: Story = {
  name: TEST_CASES.customText.name,
  args: TEST_CASES.customText.args,
};

export const CustomUrl: Story = {
  name: TEST_CASES.customUrl.name,
  args: TEST_CASES.customUrl.args,
};

export const CustomRelays: Story = {
  name: TEST_CASES.customRelays.name,
  args: TEST_CASES.customRelays.args,
};

export const NoUrl: Story = {
  name: TEST_CASES.noUrl.name,
  args: TEST_CASES.noUrl.args,
};

