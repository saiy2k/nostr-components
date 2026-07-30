import { DEFAULT_WIDTH } from "./utils";
import { NO_DATA_FIXTURES } from '../common/no-data';

export const NO_DATA_TEST_CASES = {
  noDataRelay: {
    name: 'Valid Note ID - No Data in Relay',
    args: {
      width: DEFAULT_WIDTH,
      noteid: NO_DATA_FIXTURES.postNoteId,
      relays: NO_DATA_FIXTURES.relay,
      'show-stats': "true",
    },
  },
};
