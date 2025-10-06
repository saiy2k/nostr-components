import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNpub: {
    name: 'Invalid Npub',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'invalid-npub-format-xyz123',
    },
    description: 'Tests malformed npub bech32 input.',
  },
  invalidNip05: {
    name: 'Invalid Nip 05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'malformed@invalid@domain.com',
    },
    description: 'Tests malformed NIP-05 identifier.', 
  },
  invalidPubkey: {
    name: 'Invalid Pubkey',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
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
    },
    description: 'Tests component with empty identifier values.',
  },
  networkFailure: {
    name: 'Unreachable Relays',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      relays: 'wss://invalid-relay.nonexistent',
    },
    description: 'Tests network failure resilience.',
  },
};
