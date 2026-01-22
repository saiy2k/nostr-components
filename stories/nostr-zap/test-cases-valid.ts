import { DEFAULT_WIDTH } from "./utils";
import { PROFILE_DATA } from '../profile-data';

export const TEST_CASES = {
  default: {
    name: 'Default',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
      url: 'https://saiy2k.in/',
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
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
  customText: {
    name: 'Custom Text',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      text: 'Send Sats!',
    },
  },
  fixedAmount: {
    name: 'Fixed Amount',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      amount: '5000',
    },
  },
  defaultAmount: {
    name: 'Default Amount',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
      'default-amount': '2000',
    },
  },
  customIconSize: {
    name: 'Custom Icon Size',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.fiatjaf.npub,
    },
    cssVariables: {
      '--nostrc-icon-width': '30px',
      '--nostrc-icon-height': '30px',
    },
  },
  urlBasedZap: {
    name: 'URL-Based Zap',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
      url: 'https://saiy2k.in/',
    },
  },
  urlBasedZapCustomText: {
    name: 'URL-Based Zap with Custom Text',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
      url: 'https://saiy2k.in/',
      text: 'Support this article',
    },
  },
  urlBasedZapFixedAmount: {
    name: 'URL-Based Zap with Fixed Amount',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.saiy2k.npub,
      url: 'https://saiy2k.in/',
      amount: '5000',
      text: 'Support this article',
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
