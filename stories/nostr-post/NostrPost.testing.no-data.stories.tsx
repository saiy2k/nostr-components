import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Post/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
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

export const ValidNoteIdNoDataRelay: Story = {
  name: 'No Data',
  args: NO_DATA_TEST_CASES.validNoteIdNoDataRelay.args,
};
