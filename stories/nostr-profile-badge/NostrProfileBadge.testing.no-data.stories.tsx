import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";

import { NO_DATA_TEST_CASES } from './test-cases-no-data.ts';

const meta = {
  title: 'NostrProfileBadge/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const NoData: Story = {
  name: NO_DATA_TEST_CASES.saiNpubNoDataRelay.name,
  args: NO_DATA_TEST_CASES.saiNpubNoDataRelay.args,
};
