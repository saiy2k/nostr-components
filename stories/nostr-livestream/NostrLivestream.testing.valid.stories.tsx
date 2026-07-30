import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes, getTestingParameters } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Livestream/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: getTestingParameters(),
};

export default meta;
type Story = StoryObj<typeof meta>;

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
export const HideParticipants: Story = {
  name: TEST_CASES.hideParticipants.name,
  args: TEST_CASES.hideParticipants.args,
};

export const HideParticipantCount: Story = {
  name: TEST_CASES.hideParticipantCount.name,
  args: TEST_CASES.hideParticipantCount.args,
};
