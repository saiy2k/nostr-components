import { DEFAULT_WIDTH } from './testing-utils.ts';
import { PROFILE_DATA } from '../profile-data.ts';

export const TEST_CASES = {
  showNpub: {
    name: 'Show NPub Feature',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.derGigi.npub,
      'show-npub': true,
      theme: 'light',
    },
    description: 'Tests the show-npub feature display and copy functionality.',
  },
  showFollow: {
    name: 'Show Follow Button',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      'show-follow': true,
      theme: 'light',
    },
    description: 'Tests the follow button functionality and integration.',
  },
  allFeatures: {
    name: 'All Features',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jb55.npub,
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
      pubkey: PROFILE_DATA.jack.pubkey,
      theme: 'light',
    },
    description: 'Tests component with raw pubkey input instead of npub.',
  },
  narrowWidth: {
    name: 'Narrow Width',
    args: {
      width: 200,
      npub: PROFILE_DATA.lyn.npub,
      theme: 'light',
    },
    description: 'Tests component behavior with constrained width.',
  },
  validNpub: {
    name: 'Valid NPub',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jack.npub,
      theme: 'light',
    },
    description: 'Basic valid npub input test.',
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.odell.npub,
      theme: 'dark',
    },
    description: 'Tests dark theme styling.',
  },
  // Public demo cases
  fiatjaf: {
    name: 'Fiatjaf - Default',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      theme: 'light',
    },
    description: 'Default profile badge with npub input.',
  },
  odell: {
    name: 'Odell - Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.odell.npub,
      theme: 'dark',
    },
    description: 'Profile badge with dark theme.',
  },
  lyn: {
    name: 'Nip05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.lyn.nip05,
      theme: 'light',
    },
    description: 'Profile badge with nip05',
  },
};
