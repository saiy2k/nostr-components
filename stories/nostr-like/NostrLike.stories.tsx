// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const STORY_PAGE_URL = 'https://saiy2k.in/2025/02/17/nostr-components/';

const meta: Meta = {
  title: 'Like Button',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        // Keep this description aligned with README.md, stories/Introduction.mdx,
        // and src/nostr-like-button/spec/spec.md.
        component: 'A web component that displays a like button for URLs using NIP-25 External Content Reactions (kind 17). Supports URL-based likes with theme customization. The count is each pubkey\'s newest reaction, and the count opens a likers list.\n\n**Features:**\n- Like and unlike support with confirmation before unlike\n- Automatic URL detection from the current page\n- First-click onboarding before the signer approval flow\n- Connected signer support via `window.nostr.js` (NIP-07 / NIP-46)\n- Progressive profile loading in the likers dialog\n\n⚠️ **Scalability Limitation:** The component queries up to 1000 reaction events per URL. For viral content, the count and the likers list may be incomplete.',
      },
      source: {
        transform: (code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: TEST_CASES.default.name,
  args: { ...TEST_CASES.default.args, url: STORY_PAGE_URL },
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: { ...TEST_CASES.darkTheme.args, url: STORY_PAGE_URL },
};

export const CustomText: Story = {
  name: TEST_CASES.customText.name,
  args: { ...TEST_CASES.customText.args, url: STORY_PAGE_URL },
};

export const CustomUrl: Story = {
  name: TEST_CASES.customUrl.name,
  args: TEST_CASES.customUrl.args,
};

export const CustomRelays: Story = {
  name: TEST_CASES.customRelays.name,
  args: { ...TEST_CASES.customRelays.args, url: STORY_PAGE_URL },
};

export const NoUrl: Story = {
  name: TEST_CASES.noUrl.name,
  args: TEST_CASES.noUrl.args,
};
