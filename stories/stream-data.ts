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
    naddr: 'naddr1qqjxgv3jvgurjc3495urydnp956xxvpc95uryd3j943kgdpnxa3xgepcx3skgqg4waehxw309aex2mrp0yhxgctdw4eju6t09upzpa4ztwrl0ea7exnfrcmc2xcm27nmf8aqpw6rz2qrqvqz504u5jy3qvzqqqrkvunnhlja',
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
