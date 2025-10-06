import { DEFAULT_WIDTH } from "./utils";
import { POST_DATA } from '../post-data.ts';

export const TEST_CASES = {
  gigiFreeWeb: {
    name: 'Gigi - Free Web',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
    },
    description: 'Text post about free web from Gigi with stats display.',
  },
  utxoUsDollarBacking: {
    name: 'UTXO - US Dollar Backing',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
      'show-stats': true,
    },
    description: 'Post about US Dollar backing from UTXO with stats display.',
  },
  nvkFutureHere: {
    name: 'NVK - Future Here',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.nvk_future_here.hex,
      'show-stats': false,
    },
    description: 'Post about future from NVK using hex ID without stats display.',
  },
  benExpensiveGovernment: {
    name: 'Ben - Expensive Government',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.ben_expensive_government.hex,
      'show-stats': true,
    },
    description: 'Post about expensive government from Ben using hex ID with stats display.',
  },
  jackVideoProgramming: {
    name: 'Jack - Video Programming',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': true,
    },
    description: 'Video post from Jack about programming with stats display.',
  },
  toxicBitcoinerImage: {
    name: 'Toxic Bitcoiner - Image',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      'show-stats': true,
    },
    description: 'Image post from Toxic Bitcoiner about state existence with stats display.',
  },
  narrowWidth: {
    name: 'Narrow Width',
    args: {
      width: 300,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
    },
    description: 'Tests component behavior with constrained width.',
  },
  wideWidth: {
    name: 'Wide Width',
    args: {
      width: 800,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
      'show-stats': true,
    },
    description: 'Tests component with wider layout.',
  },
  noStats: {
    name: 'No Stats Display',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': false,
    },
    description: 'Post without stats display.',
  },
  customRelays: {
    name: 'Custom Relays',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      relays: 'wss://relay.damus.io,wss://nos.lol',
      'show-stats': true,
    },
    description: 'Tests component with custom relay configuration.',
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
      'show-stats': true,
    },
    description: 'Tests dark theme styling.',
    wrapperDataTheme: 'dark',
  },
  oceanGlassTheme: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
    },
    description: 'Post themed with ocean-glass via data-theme.',
    wrapperDataTheme: 'ocean-glass',
  },
  holographicTheme: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': true,
    },
    description: 'Post themed with holographic via data-theme.',
    wrapperDataTheme: 'holographic',
  },
  neoMatrixTheme: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      'show-stats': true,
    },
    description: 'Post themed with neo-matrix via data-theme.',
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrangeTheme: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.ben_expensive_government.noteid,
      'show-stats': true,
    },
    description: 'Post themed with bitcoin-orange via data-theme.',
    wrapperDataTheme: 'bitcoin-orange',
  },
  withClickHandlers: {
    name: 'With Click Handlers',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
      onMentionClick: 'handleMentionClick',
    },
    description: 'Post with all click handlers configured.',
  },
  mediaPost: {
    name: 'Media Post',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': true,
    },
    description: 'Post with embedded media content.',
  },
  imagePost: {
    name: 'Image Post',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      'show-stats': true,
    },
    description: 'Post with embedded image content.',
  },
  showStats: {
    name: 'Show Stats Feature',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
    },
    description: 'Tests the show-stats feature display and functionality.',
  },
  allFeatures: {
    name: 'All Features',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': true,
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
      onMentionClick: 'handleMentionClick',
    },
    description: 'Tests all features working together.',
  },
  validNoteId: {
    name: 'Valid Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
    description: 'Basic valid note ID input test.',
  },
  fiatjaf: {
    name: 'Fiatjaf - Default',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
    description: 'Default post with note ID input.',
  },
  odell: {
    name: 'Odell - Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
    },
    description: 'Post with dark theme.',
    wrapperDataTheme: 'dark',
  },
  jb55: {
    name: 'jb55 - Full Post',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': true,
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
    },
    description: 'Full post with all features enabled.',
  },
  derGigi: {
    name: 'DerGigi - Hex with Stats',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.nvk_future_here.hex,
      'show-stats': true,
    },
    description: 'Post with hex ID and stats display.',
  },
  utxo: {
    name: 'Utxo - Basic Post',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
    },
    description: 'Basic post without additional features.',
  },
  holographic: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
    },
    description: 'Post themed with holographic via data-theme on the component.',
    wrapperDataTheme: 'holographic',
  },
  oceanGlass: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
    description: 'Post themed with ocean-glass via data-theme.',
    wrapperDataTheme: 'ocean-glass',
  },
  neoMatrix: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
    },
    description: 'Post themed with neo-matrix via data-theme.',
    wrapperDataTheme: 'neo-matrix',
  },
  bitcoinOrange: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.ben_expensive_government.hex,
    },
    description: 'Post themed with bitcoin-orange via data-theme.',
    wrapperDataTheme: 'bitcoin-orange',
  },
  wideLayout: {
    name: 'Wide Layout',
    args: {
      width: 800,
      noteid: POST_DATA.gigi_free_web.noteid,
      'show-stats': true,
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
    },
    description: 'Tests component with wider layout.',
  },
};
