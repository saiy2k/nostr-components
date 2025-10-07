import React from 'react';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'NostrPost',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: fn(), onAuthorClick: fn(), onMentionClick: fn() },
  parameters: {
    docs: {
      source: {
        transform: (code, storyContext) =>
          generateCode(storyContext.args, true),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: TEST_CASES.Default.name,
  args: TEST_CASES.Default.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.Default.description,
      },
    },
  },
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.darkTheme.description,
      },
    },
  },
};

export const eventId: Story = {
  name: TEST_CASES.eventId.name,
  args: TEST_CASES.eventId.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.eventId.description,
      },
    },
  },
};

export const rawHex: Story = {
  name: TEST_CASES.rawHex.name,
  args: TEST_CASES.rawHex.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.rawHex.description,
      },
    },
  },
};

export const showStats: Story = {
  name: TEST_CASES.showStats.name,
  args: TEST_CASES.showStats.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.showStats.description,
      },
    },
  },
};
