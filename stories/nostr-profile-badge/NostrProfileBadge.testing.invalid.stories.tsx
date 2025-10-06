import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";



import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Invalid',
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

export const InvalidNpub: Story = {
  name: INVALID_TEST_CASES.invalidNpub.name,
  args: INVALID_TEST_CASES.invalidNpub.args,
};

export const InvalidNip05: Story = {
  name: INVALID_TEST_CASES.invalidNip05.name,
  args: INVALID_TEST_CASES.invalidNip05.args,
};

export const InvalidPubkey: Story = {
  name: INVALID_TEST_CASES.invalidPubkey.name,
  args: INVALID_TEST_CASES.invalidPubkey.args,
};

export const EmptyInputs: Story = {
  name: INVALID_TEST_CASES.emptyInputs.name,
  args: INVALID_TEST_CASES.emptyInputs.args,
};

export const NetworkFailure: Story = {
  name: INVALID_TEST_CASES.networkFailure.name,
  args: INVALID_TEST_CASES.networkFailure.args,
};