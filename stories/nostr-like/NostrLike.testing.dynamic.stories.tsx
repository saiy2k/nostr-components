import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';
import { TEST_CASES as INVALID_TEST_CASES } from './test-cases-invalid';
import { createComprehensiveDynamicPlay } from '../common/comprehensive-dynamic';
import { createFastSwitchingPlay } from '../common/fast-switching';

const meta: Meta = {
  title: 'Like Button/Testing/Dynamic',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-like',
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

export const AllAttributes: Story = {
  name: 'All Attributes',
  args: {
    text: 'Like',
    url: 'https://github.com/nostr-protocol/nips',
  },
  play: createComprehensiveDynamicPlay({
    componentName: 'nostr-like',
    inputAttributes: ['url', 'text'],
    testInputs: [
      { type: 'url', value: 'https://github.com/nostr-protocol/nips', name: 'NIPs Repo' },
      { type: 'url', value: 'https://saiy2k.in/2025/02/17/nostr-components/', name: 'Nostr components - Launch post' },
      { type: 'url', value: INVALID_TEST_CASES.invalidUrl.args.url, name: 'Invalid URL' },
      { type: 'url', value: 'https://saiy2k.in', name: 'Saiy2k - Home' },
      { type: 'url', value: 'https://example.com/article', name: 'Example Article' },
      { type: 'url', value: 'https://stuff.fiatjaf.com/', name: 'Fiatjaf - Stuff' },
      { type: 'text', value: 'Awesome!', name: 'Awesome!' },
      { type: 'url', value: 'https://primal.net/', name: 'Primal' },
      { type: 'text', value: '👍', name: 'Emoji' },
      { type: 'url', value: 'https://damus.io/', name: 'Damus' },
    ],
    widths: [600, 500, 400, 700],
    booleanAttributes: [],
    updateInterval: 20000
  }),
};

export const FastSwitching: Story = {
  name: 'Fast switching',
  args: {
    text: 'Like',
    url: 'https://github.com/nostr-protocol/nips',
  },
  play: createFastSwitchingPlay({
    componentName: 'nostr-like',
    attribute1: {
      name: 'url',
      values: [
        { value: 'https://github.com/nostr-protocol/nips', name: 'NIPs Repo' },
        { value: 'https://example.com/article', name: 'Example Article' },
        { value: 'https://saiy2k.in/2025/02/17/nostr-components/', name: 'Nostr components - Launch post' },
        { value: 'https://stuff.fiatjaf.com/', name: 'Fiatjaf - Stuff' },
        { value: 'https://primal.net/', name: 'Primal' },
        { value: INVALID_TEST_CASES.invalidUrl.args.url, name: 'Invalid URL' },
        { value: 'https://damus.io/', name: 'Damus' },
        { value: '', name: 'Empty URL' },
      ]
    },
    attribute2: {
      name: 'relays',
      values: [
        { value: 'wss://relay.damus.io', name: 'Damus Relay' },
        { value: 'wss://relay.snort.social', name: 'Snort Social' },
        { value: 'wss://nos.lol', name: 'Nos.lol' },
        { value: 'wss://relay.nostr.band', name: 'Nostr Band' },
        { value: 'wss://relay.damus.io,wss://relay.snort.social', name: 'Multiple Relays' },
        { value: INVALID_TEST_CASES.invalidRelay.args.relays, name: 'Invalid Relay' },
        { value: '', name: 'No Relays' },
      ]
    },
    maxFastUpdates: 10,
    pauseDuration: 15000,
    fastDelayMin: 100,
    fastDelayMax: 200
  }),
};

