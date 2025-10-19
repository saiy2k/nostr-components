import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { PROFILE_DATA } from '../profile-data';
import { INVALID_TEST_CASES } from './test-cases-invalid';
import { createPrimaryAttributeChangesPlay } from '../common/primary-attribute-changes';
import { createComprehensiveDynamicPlay } from '../common/comprehensive-dynamic';
import { createFastSwitchingPlay } from '../common/fast-switching';

const meta: Meta = {
  title: 'Follow Button/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-follow-button',
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

export const InputChanges: Story = {
  name: 'Input Changes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: createPrimaryAttributeChangesPlay(
    'nostr-follow-button',
    ['npub', 'nip05', 'pubkey'],
    [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'npub', value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
      { type: 'nip05', value: PROFILE_DATA.fiatjaf.nip05, name: 'Fiatjaf' },
      { type: 'nip05', value: INVALID_TEST_CASES.invalidNip05.args.nip05, name: 'Invalid NIP-05' },
      { type: 'pubkey', value: PROFILE_DATA.jb55.pubkey, name: 'jb55' },
      { type: 'pubkey', value: INVALID_TEST_CASES.invalidPubkey.args.pubkey, name: 'Invalid Pubkey' },
      { type: 'npub', value: PROFILE_DATA.odell.npub, name: 'Odell' },
      { type: 'npub', value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
    ],
    8000
  ),
};

export const AllAttributes: Story = {
  name: 'All attributes',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: createComprehensiveDynamicPlay({
    componentName: 'nostr-follow-button',
    inputAttributes: ['npub', 'nip05', 'pubkey'],
    testInputs: [
      { type: 'npub', value: PROFILE_DATA.jack.npub, name: 'Jack' },
      { type: 'npub', value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
      { type: 'nip05', value: PROFILE_DATA.fiatjaf.nip05, name: 'Fiatjaf' },
      { type: 'nip05', value: INVALID_TEST_CASES.invalidNip05.args.nip05, name: 'Invalid NIP-05' },
      { type: 'pubkey', value: PROFILE_DATA.jb55.pubkey, name: 'jb55' },
      { type: 'pubkey', value: INVALID_TEST_CASES.invalidPubkey.args.pubkey, name: 'Invalid Pubkey' },
      { type: 'npub', value: PROFILE_DATA.odell.npub, name: 'Odell' },
      { type: 'npub', value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
    ],
    widths: [300, 250, 200, 400],
    updateInterval: 6000
  }),
};

export const FastSwitching: Story = {
  name: 'Fast switching',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jack.npub,
  },
  play: createFastSwitchingPlay({
    componentName: 'nostr-follow-button',
    attribute1: {
      name: 'theme',
      values: [
        { value: 'light', name: 'Light Theme' },
        { value: 'dark', name: 'Dark Theme' },
      ]
    },
    attribute2: {
      name: 'npub',
      values: [
        { value: PROFILE_DATA.jack.npub, name: 'Jack' },
        { value: INVALID_TEST_CASES.invalidNpub.args.npub, name: 'Invalid NPub' },
        { value: PROFILE_DATA.derGigi.npub, name: 'DerGigi' },
        { value: PROFILE_DATA.fiatjaf.npub, name: 'Fiatjaf' },
        { value: INVALID_TEST_CASES.emptyInputs.args.npub, name: 'Empty NPub' },
        { value: PROFILE_DATA.jb55.npub, name: 'jb55' },
        { value: PROFILE_DATA.odell.npub, name: 'Odell' },
      ]
    },
    maxFastUpdates: 8,
    pauseDuration: 10000,
    fastDelayMin: 200,
    fastDelayMax: 500
  }),
};
