export interface Stream {
  name: string;
  naddr: string;
}

export interface InputType {
  type: 'naddr';
  value: string;
  name: string;
}

export const STREAM_DATA: Record<string, Stream> = {
  ended: {
    name: 'Ended Stream',
    naddr: 'naddr1qqjrqvfevyekzv3495unqdnz95mngcen94skze3494nxgvrzvvenvwfjxvmrxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzq0d4uxua4ftuc6na254gd2r4wnh2ye0qwkwaawragns8ylmeakydqvzqqqrkvu5jsvfk',
  },
  live: {
    name: 'Live Stream',
    naddr: 'naddr1qqjxgdrzv9jnwdmr94skgwpn956r2ety943xgwr995urwvtyvsckzd33x33xxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn6956apxcad0mfp8grcuugdysg44eepex68h50t73zcathmfs49qvzqqqrkvu0mc7et',
  },
  live2: {
    name: 'Live Stream 2',
    naddr: 'naddr1qqjrydm9vsmryerz95mrqv3h956rgvrz95urzdty943r2d3jxy6kvcn9xsckxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn98aa2pmwpk39qnm96ufa4rte8vwwg45fvkcacyztvjsmnnyvtkqvzqqqrkvu7qdk0f',
  },
  planned: {
    name: 'Planned Stream',
    naddr: 'naddr1placeholderforplannedstreamthatwillberepacedwhenavailable',
  },
};

export const getRandomStream = (): Stream => {
  const streams = Object.values(STREAM_DATA);
  return streams[Math.floor(Math.random() * streams.length)];
};

export const getStreamsByType = (type: 'naddr'): InputType[] => {
  return Object.values(STREAM_DATA)
    .filter(stream => Boolean(stream[type]))
    .map(stream => ({
      type,
      value: stream[type],
      name: stream.name,
    }));
};

export const getAllInputTypes = (): InputType[] => {
  const streams = Object.values(STREAM_DATA);
  const inputs: InputType[] = [];
  
  streams.forEach(stream => {
    if (stream.naddr) {
      inputs.push({ type: 'naddr', value: stream.naddr, name: stream.name });
    }
  });
  
  return inputs;
};
