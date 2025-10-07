import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from "./utils";
import { TEST_CASES } from './test-cases-valid';

const meta = {
  title: 'NostrProfile/Testing/Valid',
  tags: ['test', 'valid'],
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

// Stories from ValidCasesDashboard
export const DarkTheme: Story = {
  name: 'Dark Theme',
  args: TEST_CASES.darkTheme.args,
};

export const Lyn: Story = {
  name: 'Nip 05',
  args: TEST_CASES.nip05.args,
};

export const ShowNPub: Story = {
  name: 'Show Npub',
  args: TEST_CASES.showNpub.args,
};

export const ShowFollow: Story = {
  name: 'Show Follow',
  args: TEST_CASES.showFollow.args,
};

export const RawPubkey: Story = {
  name: 'Raw Pubkey Input',
  args: TEST_CASES.rawPubkey.args,
};