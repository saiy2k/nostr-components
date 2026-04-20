import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes, getTestingParameters } from "./utils";
import { NO_DATA_TEST_CASES } from './test-cases-no-data';

const meta: Meta = {
  title: 'Zap Button/Testing/No Data',
  tags: ['test', 'no-data'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: getTestingParameters(),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NoData: Story = {
  name: NO_DATA_TEST_CASES.noData.name,
  args: NO_DATA_TEST_CASES.noData.args,
};
