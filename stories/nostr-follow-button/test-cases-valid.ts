import { DEFAULT_WIDTH } from './testing-utils.ts';
import { PROFILE_DATA } from '../profile-data.ts';

export const TEST_CASES = {
  // Basic Input Methods
  npub: {
    name: 'NPub Input',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.jack.npub,
      theme: 'light',
    },
    description: 'Tests standard npub bech32 input.',
  },
  nip05: {
    name: 'NIP-05 Input',
    args: {
      width: DEFAULT_WIDTH,
      nip05: PROFILE_DATA.fiatjaf.nip05,
      theme: 'light',
    },
    description: 'Tests nip05 identifier input.',
  },
  pubkey: {
    name: 'Raw Pubkey',
    args: {
      width: DEFAULT_WIDTH,
      pubkey: PROFILE_DATA.jb55.pubkey,
      theme: 'light',
    },
    description: 'Tests raw hex pubkey input.',
  },

  // Theme Variations
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.odell.npub,
      theme: 'dark',
    },
    description: 'Tests dark theme styling.',
  },

  // Layout Variations  
  narrowWidth: {
    name: 'Narrow Width',
    args: {
      width: 200,
      npub: PROFILE_DATA.derGigi.npub,
      theme: 'light',
    },
    description: 'Tests narrow container behavior.',
  },
  wideWidth: {
    name: 'Wide Width',
    args: {
      width: 400,
      npub: PROFILE_DATA.utxo.npub,
      theme: 'light',
    },
    description: 'Tests wide container behavior.',
  },

  // CSS Customization
  customIconSize: {
    name: 'Custom Icon Size',
    args: {
      width: DEFAULT_WIDTH,
      npub: PROFILE_DATA.lyn.npub,
      theme: 'light',
      '--nostrc-icon-width': '32px',
      '--nostrc-icon-height': '32px',
    },
    description: 'Tests custom icon dimensions.',
  },
};