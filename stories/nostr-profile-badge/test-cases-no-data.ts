import { DEFAULT_WIDTH } from './testing-utils.ts';

export const NO_DATA_TEST_CASES = {
  saiNpubNoDataRelay: {
    name: 'Sai NPub - No Data in relay',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3',
      relays: 'wss://no.netsec.vip/', // wss://nostr.wine',
      theme: 'light',
    },
    description: 'Tests component behavior when using Sai\'s npub with a relay that doesn\'t have the profile data.',
  },
};
