import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'NostrPost',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'A web component that displays Nostr posts with content, metadata, and statistics. Supports note IDs, event IDs, and raw hex inputs.',
      },
      source: {
        transform: (code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<any>;

export const Default: Story = {
  name: TEST_CASES.default.name,
  args: TEST_CASES.default.args,
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const EventId: Story = {
  name: TEST_CASES.eventId.name,
  args: TEST_CASES.eventId.args,
};

export const RawHex: Story = {
  name: TEST_CASES.rawHex.name,
  args: TEST_CASES.rawHex.args,
};

export const ShowStats: Story = {
  name: TEST_CASES.showStats.name,
  args: TEST_CASES.showStats.args,
};
