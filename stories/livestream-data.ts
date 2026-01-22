export interface Livestream {
  name: string;
  naddr: string;
}

export interface InputType {
  type: 'naddr';
  value: string;
  name: string;
}

export const LIVESTREAM_DATA: Record<string, Livestream> = {
  ended: {
    name: 'Ended Livestream',
    naddr: 'naddr1qqjrqvfevyekzv3495unqdnz95mngcen94skze3494nxgvrzvvenvwfjxvmrxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzq0d4uxua4ftuc6na254gd2r4wnh2ye0qwkwaawragns8ylmeakydqvzqqqrkvu5jsvfk',
  },
  live: {
    name: 'Live Livestream',
    naddr: 'naddr1qqjxgdrzv9jnwdmr94skgwpn956r2ety943xgwr995urwvtyvsckzd33x33xxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn6956apxcad0mfp8grcuugdysg44eepex68h50t73zcathmfs49qvzqqqrkvu0mc7et',
  },
  live2: {
    name: 'Live Livestream 2',
    naddr: 'naddr1qqjrydm9vsmryerz95mrqv3h956rgvrz95urzdty943r2d3jxy6kvcn9xsckxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn98aa2pmwpk39qnm96ufa4rte8vwwg45fvkcacyztvjsmnnyvtkqvzqqqrkvu7qdk0f',
  },
  planned: {
    name: 'Planned Livestream',
    naddr: 'naddr1placeholderforplannedstreamthatwillberepacedwhenavailable',
  },
};

export const getRandomLivestream = (): Livestream => {
  const livestreams = Object.values(LIVESTREAM_DATA);
  return livestreams[Math.floor(Math.random() * livestreams.length)];
};

export const getLivestreamsByType = (type: 'naddr'): InputType[] => {
  return Object.values(LIVESTREAM_DATA)
    .filter(livestream => Boolean(livestream[type]))
    .map(livestream => ({
      type,
      value: livestream[type],
      name: livestream.name,
    }));
};

export const getAllInputTypes = (): InputType[] => {
  const livestreams = Object.values(LIVESTREAM_DATA);
  const inputs: InputType[] = [];
  
  livestreams.forEach(livestream => {
    if (livestream.naddr) {
      inputs.push({ type: 'naddr', value: livestream.naddr, name: livestream.name });
    }
  });
  
  return inputs;
};
