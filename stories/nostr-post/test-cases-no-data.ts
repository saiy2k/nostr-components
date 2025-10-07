import { DEFAULT_WIDTH } from "./utils";

export const NO_DATA_TEST_CASES = {
  validNoteIdNoDataRelay: {
    name: 'Valid Note ID - No Data in Relay',
    args: {
      width: DEFAULT_WIDTH,
      noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
      relays: 'wss://no.netsec.vip/',
      'show-stats': "true",
    },
  },
};
