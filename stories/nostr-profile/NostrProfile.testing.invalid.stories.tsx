import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from "./utils";
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta = {
  title: 'NostrProfile/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
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

// Stories from InvalidCasesDashboard
export const InvalidNpub: Story = {
  name: 'Invalid NPub',
  args: INVALID_TEST_CASES.invalidNpub.args,
};

export const InvalidNip05: Story = {
  name: 'Invalid NIP-05',
  args: INVALID_TEST_CASES.invalidNip05.args,
};

export const InvalidPubkey: Story = {
  name: 'Invalid Pubkey',
  args: INVALID_TEST_CASES.invalidPubkey.args,
};

export const EmptyInputs: Story = {
  name: 'Empty/Null Inputs',
  args: INVALID_TEST_CASES.emptyInputs.args,
};

export const NetworkFailure: Story = {
  name: 'Network Failure',
  args: INVALID_TEST_CASES.networkFailure.args,
};