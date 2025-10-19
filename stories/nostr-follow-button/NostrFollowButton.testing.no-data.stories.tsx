import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Follow Button/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-follow-button',
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

export const NoProfileData: Story = {
  name: NO_DATA_TEST_CASES.noData.name,
  tags: ['test', 'no-data', 'edge-cases'],
  args: NO_DATA_TEST_CASES.noData.args,
};
