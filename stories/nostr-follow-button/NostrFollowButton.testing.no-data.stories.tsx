import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes, getTestingParameters } from "./utils";
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Follow Button/Testing/No Data',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: getTestingParameters(),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NoProfileData: Story = {
  name: NO_DATA_TEST_CASES.noDataRelay.name,
  tags: ['test', 'no-data', 'edge-cases'],
  args: NO_DATA_TEST_CASES.noDataRelay.args,
};
