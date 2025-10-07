import { DEFAULT_WIDTH } from "./utils";
import { POST_DATA } from '../post-data.ts';

export const TEST_CASES = {
  Default: {
    name: 'Default',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
    description: '',
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_rough_consensus.noteid,
      'data-theme': 'dark',
    },
    description: 'Dark theme',
  },
  eventId: {
    name: 'Event id',
    args: {
      width: DEFAULT_WIDTH,
      eventid: POST_DATA.calle_build_fools.eventid,
    },
    description: 'Using event Id',
  },
  rawHex: {
    name: 'Raw hex',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.nvk_future_here.hex,
    },
    description: 'Using Raw hex',
  },
  showStats: {
    name: 'Show Stats',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
      'show-stats': "true",
    },
    description: 'Show stats',
  },

  // Theme Variations
  oceanGlassTheme: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'data-theme': 'ocean-glass',
    },
  },
  holographicTheme: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'data-theme': 'holographic',
    },
  },
  neoMatrixTheme: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      'data-theme': 'neo-matrix',
    },
  },
  bitcoinOrangeTheme: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_rough_consensus.noteid,
      'data-theme': 'bitcoin-orange',
    },
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

  jackVideoProgramming: {
    name: 'Video content',
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

  // Types:
  // 1. Image
  // 2. Image Carousel
  // 3. Video
  // 4. Link
  // 5. Text
  // 6. Embedded Note
  // 7. Embedded Note (Nested)
  // 8. Audio
  // 9. Poll
};
