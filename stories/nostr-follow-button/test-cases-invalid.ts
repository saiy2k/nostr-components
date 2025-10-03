import { DEFAULT_WIDTH } from './testing-utils.ts';

export const INVALID_TEST_CASES = {
  invalidNpub: {
    name: 'Invalid NPub Format',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'invalid-npub-format-xyz123',
      theme: 'light',
    },
    description: 'Tests malformed npub bech32 input.',
  },
  invalidNip05: {
    name: 'Invalid NIP-05 Format',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'malformed@invalid@domain.com',
      theme: 'light',
    },
    description: 'Tests malformed NIP-05 identifier.', 
  },
  invalidPubkey: {
    name: 'Invalid Pubkey Format',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
      theme: 'light',
    },
    description: 'Tests invalid hex pubkey format.',
  },
  emptyInputs: {
    name: 'Empty Inputs',
    args: {
      width: DEFAULT_WIDTH,
      npub: '',
      nip05: '',
      pubkey: '',
      theme: 'light',
    },
    description: 'Tests component with empty identifier values.',
  },
  invalidTheme: {
    name: 'Invalid Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      theme: 'invalid-theme',
    },
    description: 'Tests invalid theme value handling.',
  },
  networkFailure: {
    name: 'Unreachable Relays',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      relays: 'wss://invalid-relay.nonexistent',
      theme: 'light',
    },
    description: 'Tests network failure resilience.',
  },
};
