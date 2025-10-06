import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta = {
  title: 'NostrPost/Testing/Invalid',
  tags: ['test', 'invalid'],
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

// Stories from InvalidTestCasesDashboard
export const InvalidNoteId: Story = {
  name: 'Invalid Note ID Format',
  args: INVALID_TEST_CASES.invalidNoteId.args,
};

export const MalformedNoteId: Story = {
  name: 'Malformed Note ID',
  args: INVALID_TEST_CASES.malformedNoteId.args,
};

export const EmptyNoteId: Story = {
  name: 'Empty Note ID',
  args: INVALID_TEST_CASES.emptyNoteId.args,
};

export const NullNoteId: Story = {
  name: 'Null Note ID',
  args: INVALID_TEST_CASES.nullNoteId.args,
};

export const InvalidRelays: Story = {
  name: 'Invalid Relays',
  args: INVALID_TEST_CASES.invalidRelays.args,
};

export const NetworkTimeout: Story = {
  name: 'Network Timeout',
  args: INVALID_TEST_CASES.networkTimeout.args,
};