import { DEFAULT_WIDTH } from './testing-utils.ts';

export const TEST_CASES = {
  showNpub: {
    name: 'Show NPub Feature',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
      'show-npub': true,
      theme: 'light',
    },
    description: 'Tests the show-npub feature display and copy functionality.',
  },
  showFollow: {
    name: 'Show Follow Button',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3',
      'show-follow': true,
      theme: 'light',
    },
    description: 'Tests the follow button functionality and integration.',
  },
  allFeatures: {
    name: 'All Features',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s',
      'show-npub': true,
      'show-follow': true,
      theme: 'light',
    },
    description: 'Tests all features working together.',
  },
  rawPubkey: {
    name: 'Raw Pubkey Input',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: '1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b',
      theme: 'light',
    },
    description: 'Tests component with raw pubkey input instead of npub.',
  },
  narrowWidth: {
    name: 'Narrow Width',
    args: {
      width: 200,
      npub: 'npub1utx00neqgqln72j22kej3ux7803c2k986henvvha4thuwfkper4s7r50e8',
      theme: 'light',
    },
    description: 'Tests component behavior with constrained width.',
  },
  validNpub: {
    name: 'Valid NPub',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      theme: 'light',
    },
    description: 'Basic valid npub input test.',
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
      theme: 'dark',
    },
    description: 'Tests dark theme styling.',
  },
  // Public demo cases
  fiatjaf: {
    name: 'Fiatjaf - Default',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      theme: 'light',
    },
    description: 'Default profile badge with npub input.',
  },
  odell: {
    name: 'Odell - Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
      theme: 'dark',
    },
    description: 'Profile badge with dark theme.',
  },
  lyn: {
    name: 'Lyn - Nip05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: 'lyn@primal.net',
      theme: 'light',
    },
    description: 'Profile badge with nip05',
  },
};
