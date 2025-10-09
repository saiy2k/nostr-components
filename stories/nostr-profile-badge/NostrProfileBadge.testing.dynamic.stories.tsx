import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { PROFILE_DATA, getAllInputTypes } from '../profile-data';
import { INVALID_TEST_CASES } from './test-cases-invalid';
import { createPrimaryAttributeChangesPlay } from '../common/primary-attribute-changes';
import { createComprehensiveDynamicPlay } from '../common/comprehensive-dynamic';
import { createFastSwitchingPlay } from '../common/fast-switching';

const meta: Meta = {
  title: 'Profile Badge/Testing/Dynamic',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const NPubChanges: Story = {
  name: 'Npub Changes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: createPrimaryAttributeChangesPlay(
    'nostr-profile-badge',
    ['npub', 'nip05', 'pubkey'],
    [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'npub', value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
      { type: 'npub', value: PROFILE_DATA.derGigi.npub, name: 'DerGigi' },
      { type: 'nip05', value: INVALID_TEST_CASES.invalidNip05.args.nip05, name: 'Invalid NIP-05' },
      { type: 'npub', value: PROFILE_DATA.fiatjaf.npub, name: 'Fiatjaf' },
      { type: 'pubkey', value: INVALID_TEST_CASES.invalidPubkey.args.pubkey, name: 'Invalid Pubkey' },
      { type: 'npub', value: PROFILE_DATA.jb55.npub, name: 'jb55' },
      { type: 'npub', value: PROFILE_DATA.odell.npub, name: 'Odell' },
      { type: 'npub', value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
    ],
    5000
  ),
};

export const AllAttributes: Story = {
  name: 'All Attributes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: createComprehensiveDynamicPlay({
    componentName: 'nostr-profile-badge',
    inputAttributes: ['npub', 'nip05', 'pubkey'],
    testInputs: [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'npub', value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
      { type: 'nip05', value: PROFILE_DATA.derGigi.nip05, name: 'DerGigi' },
      { type: 'nip05', value: INVALID_TEST_CASES.invalidNip05.args.nip05, name: 'Invalid NIP-05' },
      { type: 'pubkey', value: PROFILE_DATA.fiatjaf.pubkey, name: 'Fiatjaf' },
      { type: 'pubkey', value: INVALID_TEST_CASES.invalidPubkey.args.pubkey, name: 'Invalid Pubkey' },
      { type: 'npub', value: PROFILE_DATA.jb55.npub, name: 'jb55' },
      { type: 'nip05', value: PROFILE_DATA.lyn.nip05, name: 'Lyn' },
      { type: 'npub', value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
      { type: 'nip05', value: INVALID_TEST_CASES.emptyInputs.args.nip05, name: 'Empty NIP-05' },
    ],
    widths: [600, 500, 400, 700],
    booleanAttributes: ['show-follow', 'show-npub'],
    updateInterval: 5000
  }),
};

export const NPubAndRelays: Story = {
  name: 'Fast switching',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
    relays: 'wss://relay.damus.io',
  },
  play: createFastSwitchingPlay({
    componentName: 'nostr-profile-badge',
    attribute1: {
      name: 'npub',
      values: [
        { value: PROFILE_DATA.jack.npub, name: 'Jack' },
        { value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
        { value: PROFILE_DATA.derGigi.npub, name: 'DerGigi' },
        { value: PROFILE_DATA.fiatjaf.npub, name: 'Fiatjaf' },
        { value: PROFILE_DATA.jb55.npub, name: 'jb55' },
        { value: PROFILE_DATA.odell.npub, name: 'Odell' },
        { value: PROFILE_DATA.lyn.npub, name: 'Lyn' },
        { value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
        { value: PROFILE_DATA.utxo.npub, name: 'Utxo' },
        { value: PROFILE_DATA.saiy2k.npub, name: 'Sai' },
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
        { value: 'wss://no.netsec.vip/', name: 'New Relay' },
        { value: 'wss://invalid-relay.nonexistent', name: 'Invalid Relay' },
        { value: '', name: 'No Relays' },
      ]
    },
    maxFastUpdates: 10,
    pauseDuration: 15000,
    fastDelayMin: 100,
    fastDelayMax: 200
  }),
};

