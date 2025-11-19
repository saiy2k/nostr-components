// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes, generateDashboardHTML } from './utils';
import { TEST_CASES } from './test-cases-valid';
import { TEST_CASES as INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Like Button/Testing',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'Dashboard views showing all test cases for the nostr-like component.',
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

export const ValidCases: Story = {
  name: 'Valid Cases Dashboard',
  render: () => generateDashboardHTML(
    Object.values(TEST_CASES).filter((case_: any) => !case_.wrapperDataTheme),
    'Like Button - Valid Test Cases',
    '#1877f2'
  ),
  parameters: {
    docs: {
      source: {
        code: generateDashboardHTML(
          Object.values(TEST_CASES).filter((case_: any) => !case_.wrapperDataTheme),
          'Like Button - Valid Test Cases',
          '#1877f2'
        ),
      },
    },
  },
};

export const InvalidCases: Story = {
  name: 'Invalid Cases Dashboard',
  render: () => generateDashboardHTML(
    Object.values(INVALID_TEST_CASES),
    'Like Button - Invalid Test Cases',
    '#dc2626'
  ),
  parameters: {
    docs: {
      source: {
        code: generateDashboardHTML(
          Object.values(INVALID_TEST_CASES),
          'Like Button - Invalid Test Cases',
          '#dc2626'
        ),
      },
    },
  },
};
