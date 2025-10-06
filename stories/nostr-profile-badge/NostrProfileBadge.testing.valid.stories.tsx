import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from './utils';

import { TEST_CASES } from './test-cases-valid.ts';
import { PROFILE_DATA } from '../profile-data.ts';

const meta = {
  title: 'NostrProfileBadge/Testing/Valid',
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

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const Nip05: Story = {
  name: TEST_CASES.nip05.name,
  args: TEST_CASES.nip05.args,
};

export const ShowNpub: Story = {
  name: TEST_CASES.showNpub.name,
  args: TEST_CASES.showNpub.args,
};

export const ShowFollow: Story = {
  name: TEST_CASES.showFollow.name,
  args: TEST_CASES.showFollow.args,
};

export const RawPubkeyInput: Story = {
  name: TEST_CASES.rawPubkey.name,
  args: TEST_CASES.rawPubkey.args,
};