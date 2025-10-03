import { DEFAULT_WIDTH } from './testing-utils.ts';

export const NO_DATA_TEST_CASES = {
  noData: {
    name: 'No Data',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3',
      relays: 'wss://no.netsec.vip/(-',
      theme: 'light',
    },
    description: 'Tests component when npub is valid but no profile data exists in relays.',
  },
};
