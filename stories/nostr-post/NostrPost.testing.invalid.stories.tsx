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

export const InvalidNoteId: Story = {
  name: INVALID_TEST_CASES.invalidNoteId.name,
  args: INVALID_TEST_CASES.invalidNoteId.args,
};

export const InvalidEventId: Story = {
  name: INVALID_TEST_CASES.invalidEventId.name,
  args: INVALID_TEST_CASES.invalidEventId.args,
};

export const InvalidHex: Story = {
  name: INVALID_TEST_CASES.invalidHex.name,
  args: INVALID_TEST_CASES.invalidHex.args,
};

export const EmptyValues: Story = {
  name: INVALID_TEST_CASES.emptyValues.name,
  args: INVALID_TEST_CASES.emptyValues.args,
};