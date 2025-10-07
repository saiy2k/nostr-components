import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta = {
  title: 'NostrPost/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
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

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const EventId: Story = {
  name: TEST_CASES.eventId.name,
  args: TEST_CASES.eventId.args,
};

export const RawHex: Story = {
  name: TEST_CASES.rawHex.name,
  args: TEST_CASES.rawHex.args,
};

export const ShowStats: Story = {
  name: TEST_CASES.showStats.name,
  args: TEST_CASES.showStats.args,
};

export const VideoContent: Story = {
  name: TEST_CASES.jackVideoProgramming.name,
  args: TEST_CASES.jackVideoProgramming.args,
};