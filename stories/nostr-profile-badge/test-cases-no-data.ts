import { DEFAULT_WIDTH } from "./utils";
import { NO_DATA_FIXTURES } from '../common/no-data';

export const NO_DATA_TEST_CASES = {
  noDataRelay: {
    name: 'Sai NPub - No Data in Relay',
    args: {
      width: DEFAULT_WIDTH,
      npub: NO_DATA_FIXTURES.profileNpub,
      relays: NO_DATA_FIXTURES.relay,
    },
  },
};
