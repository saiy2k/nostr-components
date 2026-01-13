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
    naddr: 'naddr1qqjrqvfevgurzeps956rvcfs95mn2cmp95urzdpe956rjd338yunsve3vdjrgqgwwaehxw309ahx7uewd3hkctczyrt8hwqfm33fqvryz4v9lywftgax3n3x3w9vdx04syyr3xya8pskvqcyqqq8vecaj5ryr',
  },
  live: {
    name: 'Live Stream',
    naddr: 'naddr1qqjxxwp3xymrwdek95cxxv3h956rvdmz943rvvfh94sngef5x4jkxe3nvf3nxqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpn6956apxcad0mfp8grcuugdysg44eepex68h50t73zcathmfs49qvzqqqrkvu7k4zz2',
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
