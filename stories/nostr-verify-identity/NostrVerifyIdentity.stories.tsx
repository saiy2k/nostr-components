// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';

// Ensure the custom element is registered for the stories.
import '../../src/nostr-verify-identity/nostr-verify';

interface VerifyArgs {
  platform: string;
  handle: string;
  relays: string;
  theme: 'light' | 'dark';
}

function render(args: VerifyArgs): string {
  const attrs = [
    args.platform ? `platform="${args.platform}"` : '',
    args.handle ? `handle="${args.handle}"` : '',
    args.relays ? `relays="${args.relays}"` : '',
    `data-theme="${args.theme || 'light'}"`,
  ]
    .filter(Boolean)
    .join(' ');
  return `<nostr-verify-identity ${attrs}></nostr-verify-identity>`;
}

const meta: Meta<VerifyArgs> = {
  title: 'Verify Identity',
  tags: ['autodocs'],
  render,
  argTypes: {
    platform: { control: 'select', options: ['twitter'] },
    handle: { control: 'text' },
    relays: { control: 'text' },
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
  },
  args: {
    platform: 'twitter',
    handle: '',
    relays: '',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        component:
          'A NIP-39 identity verification widget. It walks a Nostr user through ' +
          'proving control of an X/Twitter account (post a proof tweet containing ' +
          'their npub) and publishes the resulting `i` tag to **kind:10011** (and ' +
          'mirrors it into the user\'s **kind:0** profile, non-destructively).\n\n' +
          '**How verification works (free, no backend):** the proof tweet is loaded ' +
          'via Twitter\'s oEmbed endpoint over JSONP — no CORS, no paid X API. The ' +
          'returned HTML carries both the author handle and the tweet text, so the ' +
          'widget checks *authored-by-handle* **AND** *npub-in-text* entirely ' +
          'client-side.\n\n' +
          '**Note:** signing requires a NIP-07 signer (window.nostr). In Storybook ' +
          'the connect/publish steps need a real signer to complete.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<VerifyArgs>;

export const Default: Story = {
  name: 'Default (any X account)',
};

export const PinnedHandle: Story = {
  name: 'Pinned handle (must match)',
  args: { handle: 'jack' },
};

export const DarkTheme: Story = {
  name: 'Dark theme',
  args: { theme: 'dark' },
};
