import { DEFAULT_WIDTH } from './utils';

export const INVALID_TEST_CASES = {
  missingIdentifier: {
    name: 'Missing identifier',
    args: {
      width: DEFAULT_WIDTH,
      text: 'Zap fundraiser',
    },
  },
  invalidHex: {
    name: 'Invalid hex',
    args: {
      width: DEFAULT_WIDTH,
      text: 'Zap fundraiser',
      hex: 'abc123',
    },
  },
  invalidNoteid: {
    name: 'Invalid noteid',
    args: {
      width: DEFAULT_WIDTH,
      text: 'Zap fundraiser',
      noteid: 'note1invalidfundraiser',
    },
  },
  invalidEventid: {
    name: 'Invalid eventid',
    args: {
      width: DEFAULT_WIDTH,
      text: 'Zap fundraiser',
      eventid: 'nevent1invalidfundraiser',
    },
  },
};
