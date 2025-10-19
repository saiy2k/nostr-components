import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";

import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Profile Badge/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
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
  name: NO_DATA_TEST_CASES.saiNpubNoDataRelay.name,
  args: NO_DATA_TEST_CASES.saiNpubNoDataRelay.args,
};
