import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Stream/Testing/Valid',
  tags: ['test', 'valid'],
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

// Basic Display
export const Default: Story = {
  name: TEST_CASES.default.name,
  args: TEST_CASES.default.args,
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

// Status States
export const PlannedStatus: Story = {
  name: TEST_CASES.plannedStatus.name,
  args: TEST_CASES.plannedStatus.args,
};

export const EndedStatus: Story = {
  name: TEST_CASES.endedStatus.name,
  args: TEST_CASES.endedStatus.args,
};

// Video Player
export const Autoplay: Story = {
  name: TEST_CASES.autoplay.name,
  args: TEST_CASES.autoplay.args,
};

// Participants
export const WithParticipants: Story = {
  name: TEST_CASES.withParticipants.name,
  args: TEST_CASES.withParticipants.args,
};

export const HideParticipants: Story = {
  name: TEST_CASES.hideParticipants.name,
  args: TEST_CASES.hideParticipants.args,
};

export const HideParticipantCount: Story = {
  name: TEST_CASES.hideParticipantCount.name,
  args: TEST_CASES.hideParticipantCount.args,
};
