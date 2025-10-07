import { DEFAULT_WIDTH } from "./utils";
import { PROFILE_DATA } from '../profile-data';

export const TEST_CASES = {
  default: {
    name: 'Default',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jb55.npub,
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.ross.npub,
      'data-theme': 'dark',
    },
  },
  nip05: {
    name: 'Nip05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.snowden.nip05,
    },
  },
  rawPubkey: {
    name: 'Raw Pubkey Input',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: PROFILE_DATA.vitor.pubkey,
    },
  },

  showFollow: {
    name: 'Show Follow Button',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
      'show-follow': true,
    },
  },
  showNpub: {
    name: 'Show NPub',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.calle.npub,
      'show-npub': true,
    },
  },

  // Theme Variations
  oceanGlass: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.vitor.npub,
    },
    wrapperDataTheme: 'ocean-glass',
  },
  holographic: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.utxo.npub,
    },
    wrapperDataTheme: 'holographic',
  },
  neoMatrix: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.samson.npub,
    },
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrange: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.walker.npub,
    },
    wrapperDataTheme: 'bitcoin-orange',
  },
};
