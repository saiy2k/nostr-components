import { DEFAULT_WIDTH } from "./utils";
import { POST_DATA } from '../post-data';

export const TEST_CASES = {
  default: {
    name: 'Default',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
      'data-theme': 'dark',
    },
  },
  eventId: {
    name: 'Event id',
    args: {
      width: DEFAULT_WIDTH,
      eventid: POST_DATA.calle_build_fools.eventid,
    },
  },
  rawHex: {
    name: 'Raw hex',
    args: {
      width: DEFAULT_WIDTH,
      hex: POST_DATA.nvk_future_here.hex,
    },
  },
  showStats: {
    name: 'Show Stats',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.utxo_us_dollar_backing.noteid,
      'show-stats': "true",
    },
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
      'show-stats': "true",
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
      onMentionClick: 'handleMentionClick',
    },
  },
  mediaPost: {
    name: 'Media Post',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': "true",
    },
  },
  allFeatures: {
    name: 'All Features',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': "true",
      onClick: 'handlePostClick',
      onAuthorClick: 'handleAuthorClick',
      onMentionClick: 'handleMentionClick',
    },
  },
  validNoteId: {
    name: 'Valid Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.gigi_free_web.noteid,
    },
  },

  jackVideoProgramming: {
    name: 'Video content',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
      'show-stats': "true",
    },
  },
  toxicBitcoinerImage: {
    name: 'Toxic Bitcoiner - Image',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
      'show-stats': "true",
    },
  },
  mentionPost: {
    name: 'Mention Post',
    args: {
      width: DEFAULT_WIDTH,
      eventid: 'nevent1qqs8d9yr3klx02zcvst90yuc0wmhe0t6sld2gssmvas2xrpydvlf9fsze7l8h',
    },
  },

  // Content Types:
  longFormContent: {
    name: '[Text] Long Form Content',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1c42y3yf322dy82u0nl9yjkrm573dn6tj8v8lkkw5qxkrppsn7m8q9kdnkr',
    },
  },
  longFormContent2: {
    name: '[Text] Long Form Content 2',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1ptpydsx7d2d00d5s55nw7mjt7wznmvlqhznwa8apz35ayuu3ck7qq87t4l',
    },
  },
  gifPost: {
    name: '[GIF] Animated GIF',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1q95df66as8758tvgscyhz5ag4ftpdegkjqttamp46etxa0zp90sq2k0j8m',
    },
  },
  twoImagesPost: {
    name: '[Image Carousel] 2 Images',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note17cgnk678resewwewnk8jhy7n6e7a5tk30asekq64fzr9z9xerp8q5u5gjw',
    },
  },
  fourImagesPost: {
    name: '[Image Carousel] 4 Images',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note15z6xauhc38qraartk8p8ftrfj7lwtt93x2nd68ldtc6atuxjv5zslqkjwk',
    },
  },
  imageAndLinkPost: {
    name: '[Link] Image and Link',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1fslhksxfv88fusnnk0fkhhca25klexv2zy9nkq2tgw5fhal50ausf9e38r',
    },
  },
  videoPost: {
    name: '[Video] Video Content',
    args: {
      width: DEFAULT_WIDTH,
      noteid: POST_DATA.jack_video_programming_you.noteid,
    },
  },
  embeddedNoteWithVideoPost: {
    name: '[Embedded Note] With Video',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1qp6fq9pl384mc5fn8fsk82kwedq5pkvxp633xyrzpwx9lk9ljjqsz4c4we',
    },
  },
  mentionAndVideoPost: {
    name: '[Mention] Mention and Video',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1e3qq7qaehe482u0yufpm5nx0u6nfust5nl45xzzg3fhs7glftqkqa979a4',
    },
  },
  emojisPost: {
    name: '[Text] Emojis',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1qz9c05y23dux2f3d6ngm702mmmgytqwwwuyt9nvk7x5q4lqxzk5splg423',
    },
  },
};
