import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, generateArgTypes } from './testing-utils.ts';
import { NO_DATA_TEST_CASES } from './test-cases-no-data.ts';

const meta = {
  title: 'NostrFollowButton/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-follow-button',
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

export const NoProfileData: Story = {
  name: NO_DATA_TEST_CASES.noData.name,
  tags: ['test', 'no-data', 'edge-cases'],
  args: NO_DATA_TEST_CASES.noData.args,
  parameters: {
    docs: {
      description: {
        story: NO_DATA_TEST_CASES.noData.description,
      },
    },
  },
};
