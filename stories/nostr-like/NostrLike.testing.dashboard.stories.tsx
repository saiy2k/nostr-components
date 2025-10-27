// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes, generateDashboardHTML } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Like Button/Testing/Dashboard',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'Dashboard view showing all valid test cases for the nostr-like component.',
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

export const Dashboard: Story = {
  name: 'All Valid Cases',
  render: () => generateDashboardHTML(
    Object.values(TEST_CASES),
    'Like Button - Valid Test Cases',
    '#1877f2'
  ),
  parameters: {
    docs: {
      source: {
        code: generateDashboardHTML(
          Object.values(TEST_CASES),
          'Like Button - Valid Test Cases',
          '#1877f2'
        ),
      },
    },
  },
};
