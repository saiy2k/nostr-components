import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta = {
  title: 'NostrPost/Testing',
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
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const ValidNoteIdNoDataRelay: Story = {
  name: 'No Data',
  args: NO_DATA_TEST_CASES.validNoteIdNoDataRelay.args,
};
