import { DEFAULT_WIDTH } from './testing-utils.ts';

export const INVALID_TEST_CASES = {
  invalidNpub: {
    name: 'Invalid NPub Format',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'invalid-npub-format-xyz123',
      theme: 'light',
    },
    description: 'Tests how the component handles malformed npub input.',
  },
  invalidNip05: {
    name: 'Invalid NIP-05 Format',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'malformed@invalid@domain.com',
      theme: 'light',
    },
    description: 'Tests how the component handles malformed NIP-05 format.',
  },
  emptyInputs: {
    name: 'Empty/Null Inputs',
    args: {
      width: DEFAULT_WIDTH,
      npub: '',
      nip05: '',
      pubkey: '',
      theme: 'light',
    },
    description: 'Tests component behavior with empty or null values.',
  },
  invalidPubkey: {
    name: 'Invalid Pubkey Format',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
      theme: 'light',
    },
    description: 'Tests component with invalid pubkey format.',
  },
  invalidTheme: {
    name: 'Invalid Theme Value',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      theme: 'invalid-theme',
    },
    description: 'Tests component with invalid theme value.',
  },
  networkFailure: {
    name: 'Network/Relay Failure',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      relays: 'wss://invalid-relay.nonexistent',
      theme: 'light',
    },
    description: 'Tests component resilience with unreachable relays.',
  },
};
