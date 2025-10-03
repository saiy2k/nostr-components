import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes, generateDashboardHTML } from './testing-utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrFollowButton/Testing',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-follow-button',
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
// - NostrFollowButton.testing.valid.stories.tsx (for valid cases)
// - NostrFollowButton.testing.invalid.stories.tsx (for invalid cases)

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  tags: ['test', 'dashboard', 'valid'],
  render: () => generateDashboardHTML([
    TEST_CASES.npub,
    TEST_CASES.nip05,
    TEST_CASES.pubkey,
    TEST_CASES.darkTheme,
    TEST_CASES.narrowWidth,
  ], '✅ Valid Cases Dashboard', '#16a34a'),
  parameters: {
    docs: {
      description: { 
        story: 'Dashboard showcasing all valid input scenarios and proper component behavior.',
      },
    },
    layout: 'fullscreen',
  },
};

export const InvalidCasesDashboard: Story = {
  name: 'Invalid Cases Dashboard',
  tags: ['test', 'dashboard', 'invalid'],
  render: () => generateDashboardHTML([
    INVALID_TEST_CASES.invalidNpub,
    INVALID_TEST_CASES.invalidNip05,
    INVALID_TEST_CASES.invalidPubkey,
    INVALID_TEST_CASES.emptyInputs,
    INVALID_TEST_CASES.invalidTheme,
    INVALID_TEST_CASES.networkFailure,
  ], '❌ Invalid Cases Dashboard', '#dc2626'),
  parameters: {
    docs: {
      description: {
        story: 'Dashboard showcasing error handling and component behavior with invalid inputs.',
      },
    },
    layout: 'fullscreen',
  },
};
