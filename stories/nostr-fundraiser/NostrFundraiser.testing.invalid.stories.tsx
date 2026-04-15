import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta: Meta = {
  title: 'Fundraiser/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-fundraiser',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
    docs: {
      description: {
        component: 'Validation and error-state stories for `nostr-fundraiser`, including the missing identifier case that shows "Provide hex, noteid, or eventid attribute".',
      },
      source: {
        transform: (_code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const MissingIdentifier: Story = {
  name: INVALID_TEST_CASES.missingIdentifier.name,
  args: INVALID_TEST_CASES.missingIdentifier.args,
};

export const InvalidHex: Story = {
  name: INVALID_TEST_CASES.invalidHex.name,
  args: INVALID_TEST_CASES.invalidHex.args,
};

export const InvalidNoteId: Story = {
  name: INVALID_TEST_CASES.invalidNoteid.name,
  args: INVALID_TEST_CASES.invalidNoteid.args,
};

export const InvalidEventId: Story = {
  name: INVALID_TEST_CASES.invalidEventid.name,
  args: INVALID_TEST_CASES.invalidEventid.args,
};
