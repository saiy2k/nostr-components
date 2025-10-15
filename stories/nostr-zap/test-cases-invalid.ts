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
  invalidPubkey: {
    name: 'Invalid Pubkey',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: 'invalid-pubkey-format-xyz123',
    },
  },
  emptyInputs: {
    name: 'Empty Inputs',
    args: {
      width: DEFAULT_WIDTH,
      npub: '',
      nip05: '',
      pubkey: '',
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
  invalidAmount: {
    name: 'Invalid Amount',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      amount: 'invalid-amount',
    },
  },
  amountTooHigh: {
    name: 'Amount Too High',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      amount: '300000',
    },
  },
  invalidDefaultAmount: {
    name: 'Invalid Default Amount',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      'default-amount': 'invalid-default',
    },
  },
  textTooLong: {
    name: 'Text Too Long',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      text: 'This is a very long text that exceeds the maximum allowed length of 128 characters for the zap button text attribute and should trigger an error state in the component',
    },
  },
};
