import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateDashboardHTML, getArgTypes } from "./utils";

import { TEST_CASES } from './test-cases-valid';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta = {
  title: 'NostrProfileBadge/Testing',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
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

// ====================================
// COMPREHENSIVE TESTING DASHBOARDS
// ====================================
// Individual test stories have been moved to separate files:
// - NostrProfileBadge.testing.valid.stories.tsx (for valid cases)
// - NostrProfileBadge.testing.invalid.stories.tsx (for invalid cases)

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  render: () => generateDashboardHTML([
    TEST_CASES.darkTheme,
    TEST_CASES.nip05,
    TEST_CASES.showNpub,
    TEST_CASES.showFollow,
    TEST_CASES.rawPubkey,
  ], '✅ Valid Cases Dashboard', '#16a34a'),
  parameters: {
    layout: 'fullscreen',
  },
};

export const InvalidCasesDashboard: Story = {
  name: 'Invalid Cases Dashboard',
  render: () => generateDashboardHTML([
    INVALID_TEST_CASES.invalidNpub,
    INVALID_TEST_CASES.invalidNip05,
    INVALID_TEST_CASES.invalidPubkey,
    INVALID_TEST_CASES.emptyInputs,
    INVALID_TEST_CASES.networkFailure,
  ], '❌ Invalid Cases Dashboard', '#dc2626'),
  parameters: {
    layout: 'fullscreen',
  },
};