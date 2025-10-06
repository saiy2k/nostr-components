import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNoteId: {
    name: 'Invalid Note ID Format',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'invalid-note-id-format-xyz123',
      'show-stats': true,
    },
    description: 'Tests how the component handles malformed note ID input.',
  },
  malformedNoteId: {
    name: 'Malformed Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1invalidformat',
      'show-stats': true,
    },
    description: 'Tests component with malformed note ID format.',
  },
  emptyNoteId: {
    name: 'Empty Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: '',
      'show-stats': true,
    },
    description: 'Tests component behavior with empty note ID.',
  },
  nullNoteId: {
    name: 'Null Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: null,
      'show-stats': true,
    },
    description: 'Tests component behavior with null note ID.',
  },
  tooLongNoteId: {
    name: 'Too Long Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1' + 'x'.repeat(200),
      'show-stats': true,
    },
    description: 'Tests component with excessively long note ID.',
  },
  invalidRelays: {
    name: 'Invalid Relays',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      relays: 'wss://invalid-relay.nonexistent,wss://another-bad-relay.fake',
      'show-stats': true,
    },
    description: 'Tests component resilience with unreachable relays.',
  },
  malformedRelays: {
    name: 'Malformed Relays',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      relays: 'invalid-relay-format,http://not-wss-protocol.com',
      'show-stats': true,
    },
    description: 'Tests component with malformed relay URLs.',
  },
  emptyRelays: {
    name: 'Empty Relays',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      relays: '',
      'show-stats': true,
    },
    description: 'Tests component with empty relay configuration.',
  },
  invalidShowStats: {
    name: 'Invalid Show Stats Value',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': 'invalid-boolean',
    },
    description: 'Tests component with invalid show-stats value.',
  },
  invalidWidth: {
    name: 'Invalid Width',
    args: {
      width: -100,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': true,
    },
    description: 'Tests component with negative width value.',
  },
  zeroWidth: {
    name: 'Zero Width',
    args: {
      width: 0,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': true,
    },
    description: 'Tests component with zero width.',
  },
  extremelyWideWidth: {
    name: 'Extremely Wide Width',
    args: {
      width: 10000,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': true,
    },
    description: 'Tests component with extremely wide width.',
  },
  invalidClickHandlers: {
    name: 'Invalid Click Handlers',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': true,
      onClick: 'nonExistentFunction',
      onAuthorClick: 'anotherNonExistentFunction',
      onMentionClick: 'yetAnotherNonExistentFunction',
    },
    description: 'Tests component with non-existent click handler functions.',
  },
  networkTimeout: {
    name: 'Network Timeout',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      relays: 'wss://very-slow-relay.example.com',
      'show-stats': true,
    },
    description: 'Tests component behavior with slow/unresponsive relays.',
  },
  invalidTheme: {
    name: 'Invalid Theme Value',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      'show-stats': true,
    },
    description: 'Tests component with invalid theme value.',
    wrapperDataTheme: 'invalid-theme',
  },
  specialCharactersNoteId: {
    name: 'Special Characters in Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1!@#$%^&*()_+-=[]{}|;:,.<>?',
      'show-stats': true,
    },
    description: 'Tests component with special characters in note ID.',
  },
  unicodeNoteId: {
    name: 'Unicode in Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1🚀🌙⭐💫🌟✨🎉🎊',
      'show-stats': true,
    },
    description: 'Tests component with unicode characters in note ID.',
  },
};
