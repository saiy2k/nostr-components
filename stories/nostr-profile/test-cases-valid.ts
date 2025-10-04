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
      width: 300,
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
    description: 'Default profile with npub input.',
  },
  odell: {
    name: 'Odell - Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.odell.npub,
      theme: 'dark',
    },
    description: 'Profile with dark theme.',
  },
  lyn: {
    name: 'Lyn - NIP-05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.lyn.nip05,
      theme: 'light',
    },
    description: 'Profile with nip05 input.',
  },
  jb55: {
    name: 'jb55 - Full Profile',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jb55.npub,
      'show-npub': true,
      'show-follow': true,
      theme: 'light',
    },
    description: 'Full profile with all features enabled.',
  },
  derGigi: {
    name: 'DerGigi - NIP-05 with Follow',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.derGigi.nip05,
      'show-follow': true,
      theme: 'light',
    },
    description: 'Profile with NIP-05 and follow button.',
  },
  utxo: {
    name: 'Utxo - Basic Profile',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.utxo.npub,
      theme: 'light',
    },
    description: 'Basic profile without additional features.',
  },
  holographic: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jb55.npub,
      theme: 'light',
    },
    description: 'Profile themed with holographic via data-theme on the component.',
    wrapperDataTheme: 'holographic',
  },
  oceanGlass: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      theme: 'light',
    },
    description: 'Profile themed with ocean-glass via data-theme.',
    wrapperDataTheme: 'ocean-glass',
  },
  neoMatrix: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.derGigi.npub,
      theme: 'light',
    },
    description: 'Profile themed with neo-matrix via data-theme.',
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrange: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jack.npub,
      theme: 'light',
    },
    description: 'Profile themed with bitcoin-orange via data-theme.',
    wrapperDataTheme: 'bitcoin-orange',
  },
  wideLayout: {
    name: 'Wide Layout',
    args: {
      width: 800,
      npub: PROFILE_DATA.jack.npub,
      'show-npub': true,
      'show-follow': true,
      theme: 'light',
    },
    description: 'Tests component with wider layout.',
  },
  customRelays: {
    name: 'Custom Relays',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.sai.npub,
      relays: 'wss://relay.damus.io,wss://nos.lol',
      theme: 'light',
    },
    description: 'Tests component with custom relay configuration.',
  },
};
