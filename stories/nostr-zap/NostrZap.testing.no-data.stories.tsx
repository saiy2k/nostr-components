import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Zap Button/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-zap',
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

export const NoData: Story = {
  name: NO_DATA_TEST_CASES.noData.name,
  args: NO_DATA_TEST_CASES.noData.args,
};
