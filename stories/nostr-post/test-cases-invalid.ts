import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNoteId: {
    name: 'Invalid Note ID',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'invalid-note-id-format-xyz123',
    },
  },
  invalidEventId: {
    name: 'Invalid Event ID',
    args: {
      width: DEFAULT_WIDTH,
      eventid: 'invalid-event-id-format-xyz123',
    },
  },
  invalidHex: {
    name: 'Invalid Hex',
    args: {
      width: DEFAULT_WIDTH,
      hex: 'invalid-hex',
    },
  },
  emptyValues: {
    name: 'Empty Values',
    args: {
      width: DEFAULT_WIDTH,
      noteid: '',
      eventid: '',
      hex: '',
    },
  },
};
