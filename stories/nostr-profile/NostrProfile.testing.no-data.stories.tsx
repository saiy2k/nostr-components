import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils';
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta = {
  title: 'NostrProfile/Testing',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile',
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

// Individual story exports for better organization
export const SaiNpubNoDataRelay: Story = {
  name: 'No Data',
  args: NO_DATA_TEST_CASES.saiNpubNoDataRelay.args,
  parameters: {
    docs: {
      description: {
        story: NO_DATA_TEST_CASES.saiNpubNoDataRelay.description,
      },
    },
  },
};
