import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from "./utils";
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Profile/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile',
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

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const Lyn: Story = {
  name: TEST_CASES.nip05.name,
  args: TEST_CASES.nip05.args,
};

export const ShowNPub: Story = {
  name: TEST_CASES.showNpub.name,
  args: TEST_CASES.showNpub.args,
};

export const ShowFollow: Story = {
  name: TEST_CASES.showFollow.name,
  args: TEST_CASES.showFollow.args,
};

export const RawPubkey: Story = {
  name: TEST_CASES.rawPubkey.name,
  args: TEST_CASES.rawPubkey.args,
};