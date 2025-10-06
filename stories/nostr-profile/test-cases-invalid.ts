import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNpub: {
    name: 'Invalid NPub',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'invalid-npub-format-xyz123',
    },
    description: 'Tests how the component handles malformed npub input.',
  },
  invalidNip05: {
    name: 'Invalid Nip 05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'malformed@invalid@domain.com',
    },
    description: 'Tests how the component handles malformed NIP-05 format.',
  },
  emptyInputs: {
    name: 'Empty/Null',
    args: {
      width: DEFAULT_WIDTH,
      npub: '',
      nip05: '',
      pubkey: '',
    },
    description: 'Tests component behavior with empty or null values.',
  },
  invalidPubkey: {
    name: 'Invalid Pubkey',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
    },
    description: 'Tests component with invalid pubkey format.',
  },
  networkFailure: {
    name: 'Network Failure',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      relays: 'wss://invalid-relay.nonexistent',
    },
    description: 'Tests component resilience with unreachable relays.',
  },
};
