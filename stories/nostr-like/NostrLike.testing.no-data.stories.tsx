// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Like Button/Testing/No Data',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'Test cases for the nostr-like component with no likes, demonstrating the component behavior when there are no likes.',
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

export const NoLikes: Story = {
  name: TEST_CASES.noLikes.name,
  args: TEST_CASES.noLikes.args,
};

export const NoLikesDark: Story = {
  name: TEST_CASES.noLikesDark.name,
  args: TEST_CASES.noLikesDark.args,
};
