import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNpub: {
    name: 'Invalid Npub',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'invalid-npub-format-xyz123',
    },
  },
  invalidNip05: {
    name: 'Invalid Nip 05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'malformed@invalid@domain.com',
    },
  },
  emptyInputs: {
    name: 'Empty/Null Inputs',
    args: {
      width: DEFAULT_WIDTH,
      npub: '',
      nip05: '',
      pubkey: '',
    },
  },
  invalidPubkey: {
    name: 'Invalid Pubkey',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
    },
  },
  invalidRelay: {
    name: 'Invalid Relay',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      relays: 'https://invalid-relay.com,ftp://another-invalid.com',
    },
  },
};
