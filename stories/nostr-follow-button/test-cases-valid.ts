import { DEFAULT_WIDTH } from "./utils";
import { PROFILE_DATA } from '../profile-data';

export const TEST_CASES = {
  default: {
    name: 'Default',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.odell.npub,
      'data-theme': 'dark',
    },
  },
  nip05: {
    name: 'Nip05',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.lyn.nip05,
    },
  },
  rawPubkey: {
    name: 'Raw Pubkey Input',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: PROFILE_DATA.jack.pubkey,
    },
  },
  showAvatar: {
    name: 'Show Avatar',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      'show-avatar': true,
    },
  },
  customText: {
    name: 'Custom Text',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      text: 'Follow me please!',
    },
  },

  // Theme Variations
  oceanGlass: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
    },
    wrapperDataTheme: 'ocean-glass',
  },
  holographic: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jb55.npub,
    },
    wrapperDataTheme: 'holographic',
  },
  neoMatrix: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.derGigi.npub,
    },
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrange: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jack.npub,
    },
    wrapperDataTheme: 'bitcoin-orange',
  },
};