import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateDashboardHTML, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Stream/Testing',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-stream',
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
// - NostrStream.testing.valid.stories.tsx (for valid cases)
// - NostrStream.testing.invalid.stories.tsx (for invalid cases)

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  tags: ['test', 'dashboard', 'valid'],
  render: () => generateDashboardHTML([
    TEST_CASES.default,
    TEST_CASES.darkTheme,
    TEST_CASES.plannedStatus,
    TEST_CASES.liveStatus,
    TEST_CASES.endedStatus,
    TEST_CASES.autoplay,
    TEST_CASES.withParticipants,
    TEST_CASES.hideParticipants,
    TEST_CASES.hideParticipantCount,
  ], '✅ Valid Cases Dashboard', '#16a34a'),
  parameters: {
    layout: 'fullscreen',
  },
};

export const InvalidCasesDashboard: Story = {
  name: 'Invalid Cases Dashboard',
  tags: ['test', 'dashboard', 'invalid'],
  render: () => generateDashboardHTML([
    INVALID_TEST_CASES.invalidNaddr,
    INVALID_TEST_CASES.invalidNaddrFormat,
    INVALID_TEST_CASES.emptyNaddr,
    INVALID_TEST_CASES.malformedNaddr,
    INVALID_TEST_CASES.invalidRelay,
    INVALID_TEST_CASES.nonExistentNaddr,
  ], '❌ Invalid Cases Dashboard', '#dc2626'),
  parameters: {
    layout: 'fullscreen',
  },
};
