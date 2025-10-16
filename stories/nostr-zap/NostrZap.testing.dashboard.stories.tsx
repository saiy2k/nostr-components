import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateDashboardHTML, getArgTypes } from "./utils";
import { TEST_CASES } from './test-cases-valid';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Zap Button/Testing/Dashboard',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-zap',
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
type Story = StoryObj<any>;

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  render: () => generateDashboardHTML([
    TEST_CASES.darkTheme,
    TEST_CASES.nip05,
    TEST_CASES.rawPubkey,
    TEST_CASES.customText,
    TEST_CASES.fixedAmount,
    TEST_CASES.defaultAmount,
    TEST_CASES.customIconSize,
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
    INVALID_TEST_CASES.invalidRelay,
    INVALID_TEST_CASES.invalidAmount,
    INVALID_TEST_CASES.amountTooHigh,
    INVALID_TEST_CASES.invalidDefaultAmount,
    INVALID_TEST_CASES.textTooLong,
  ], '❌ Invalid Cases Dashboard', '#dc2626'),
  parameters: {
    layout: 'fullscreen',
  },
};
