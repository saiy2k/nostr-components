import { DEFAULT_WIDTH } from "./utils";
import { LIVESTREAM_DATA } from '../livestream-data';

export const TEST_CASES = {
  // Basic Display
  default: {
    name: 'Default - Live',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },
  darkTheme: {
    name: 'Dark Theme',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
      'data-theme': 'dark',
    },
  },

  // Status States - Planned
  plannedStatus: {
    name: 'Planned Status',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.planned.naddr,
    },
  },

  // Status States - Live
  liveStatus: {
    name: 'Live Status',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },

  // Status States - Ended
  endedStatus: {
    name: 'Ended Status',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.ended.naddr,
    },
  },

  // Video Player
  autoplay: {
    name: 'Autoplay Video',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
      'auto-play': 'true',
    },
  },

  // Participants
  withParticipants: {
    name: 'With Participants (Default)',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
      'show-participants': 'true',
    },
  },
  hideParticipants: {
    name: 'Hide Participants',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
      'show-participants': 'false',
    },
  },
  hideParticipantCount: {
    name: 'Hide Participant Count',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
      'show-participant-count': 'false',
    },
  },

  // Theme Variations
  oceanGlassTheme: {
    name: 'Ocean Glass Theme',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },
  holographicTheme: {
    name: 'Holographic Theme',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },
  neoMatrixTheme: {
    name: 'Neo Matrix Theme',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },
  bitcoinOrangeTheme: {
    name: 'Bitcoin Orange Theme',
    args: {
      width: DEFAULT_WIDTH,
      naddr: LIVESTREAM_DATA.live.naddr,
    },
  },
};
