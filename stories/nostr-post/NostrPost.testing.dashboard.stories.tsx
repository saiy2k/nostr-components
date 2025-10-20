import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateDashboardHTML, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Post/Testing',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

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
    TEST_CASES.darkTheme,
    TEST_CASES.eventId,
    TEST_CASES.rawHex,
    TEST_CASES.showStats,
    TEST_CASES.jackVideoProgramming,
    TEST_CASES.mentionPost,
  ], '✅ Valid Cases Dashboard', '#16a34a'),
  parameters: {
    layout: 'fullscreen',
  },
};

export const InvalidCasesDashboard: Story = {
  name: 'Invalid Cases Dashboard',
  tags: ['test', 'dashboard', 'invalid'],
  render: () => generateDashboardHTML([
    INVALID_TEST_CASES.invalidNoteId,
    INVALID_TEST_CASES.invalidEventId,
    INVALID_TEST_CASES.invalidHex,
    INVALID_TEST_CASES.emptyValues,
    INVALID_TEST_CASES.invalidRelay,
  ], '❌ Invalid Cases Dashboard', '#dc2626'),
  parameters: {
    layout: 'fullscreen',
  },
};
