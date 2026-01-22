import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Livestream/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-livestream',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
    docs: {
      description: {
        component: 'Invalid test cases for the nostr-livestream component demonstrating error handling and validation.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const InvalidNaddr: Story = {
  name: INVALID_TEST_CASES.invalidNaddr.name,
  args: INVALID_TEST_CASES.invalidNaddr.args,
};

export const InvalidNaddrFormat: Story = {
  name: INVALID_TEST_CASES.invalidNaddrFormat.name,
  args: INVALID_TEST_CASES.invalidNaddrFormat.args,
};

export const EmptyNaddr: Story = {
  name: INVALID_TEST_CASES.emptyNaddr.name,
  args: INVALID_TEST_CASES.emptyNaddr.args,
};

export const MalformedNaddr: Story = {
  name: INVALID_TEST_CASES.malformedNaddr.name,
  args: INVALID_TEST_CASES.malformedNaddr.args,
};

export const InvalidRelay: Story = {
  name: INVALID_TEST_CASES.invalidRelay.name,
  args: INVALID_TEST_CASES.invalidRelay.args,
};

export const NonExistentNaddr: Story = {
  name: INVALID_TEST_CASES.nonExistentNaddr.name,
  args: INVALID_TEST_CASES.nonExistentNaddr.args,
};
