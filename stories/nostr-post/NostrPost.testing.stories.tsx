import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateDashboardHTML, getArgTypes } from './utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';
import { INVALID_TEST_CASES } from './test-cases-invalid.ts';

const meta = {
  title: 'NostrPost/Testing',
  tags: ['test', 'dev'],
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

// ====================================
// COMPREHENSIVE TESTING DASHBOARDS
// ====================================
// Individual test stories have been moved to separate files:
// - NostrPost.testing.valid.stories.tsx (for valid cases)
// - NostrPost.testing.invalid.stories.tsx (for invalid cases)

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  tags: ['test', 'dashboard', 'valid'],
  render: () => generateDashboardHTML([
    TEST_CASES.gigiFreeWeb,
    TEST_CASES.utxoUsDollarBacking,
    TEST_CASES.nvkFutureHere,
    TEST_CASES.benExpensiveGovernment,
    TEST_CASES.jackVideoProgramming,
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
    INVALID_TEST_CASES.invalidNoteId,
    INVALID_TEST_CASES.malformedNoteId,
    INVALID_TEST_CASES.emptyNoteId,
    INVALID_TEST_CASES.nullNoteId,
    INVALID_TEST_CASES.invalidRelays,
    INVALID_TEST_CASES.networkTimeout,
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
