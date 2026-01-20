import { DEFAULT_WIDTH } from "./utils";

export const INVALID_TEST_CASES = {
  invalidNaddr: {
    name: 'Invalid Naddr',
    args: {
      width: DEFAULT_WIDTH,
      naddr: 'invalid-naddr-format-xyz123',
    },
  },
  invalidNaddrFormat: {
    name: 'Invalid Naddr Format',
    args: {
      width: DEFAULT_WIDTH,
      naddr: 'note1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2crukmm9a9a0w8a4jrqygq', // note1 instead of naddr1
    },
  },
  emptyNaddr: {
    name: 'Empty Naddr',
    args: {
      width: DEFAULT_WIDTH,
      naddr: '',
    },
  },
  malformedNaddr: {
    name: 'Malformed Naddr',
    args: {
      width: DEFAULT_WIDTH,
      naddr: 'naddr1invalidbech32string',
    },
  },
  invalidRelay: {
    name: 'Invalid Relay',
    args: {
      width: DEFAULT_WIDTH,
      naddr: 'naddr1qqjr2vehvyenvdtr94nrzetr956rgctr94skvvfs95eryep3x3snwve389nxyqgwwaehxw309ahx7uewd3hkctcpz4mhxue69uhhyetvv9ujuerpd46hxtnfduhszxthwden5te0wfjkccte9eekummjwsh8xmmrd9skctcpzamhxue69uhhyetvv9ujumn0wd68ytnzv9hxgtcpz9mhxue69uhkummnw3ezumrpdejz7qg7waehxw309ahx7um5wgkhqatz9emk2mrvdaexgetj9ehx2ap0qyghwumn8ghj7mn0wd68ytnhd9hx2tcpz4mhxue69uhhyetvv9ujumn0wd68ytnzvuhsz9thwden5te0dehhxarj9ehhsarj9ejx2a30qgsv73dxhgfk8tt76gf6q788zrfyz9dwwgwfk3aar6l5gk82a76v9fgrqsqqqan8tp7le0',
      relays: 'https://invalid-relay.com,ftp://another-invalid.com',
    },
  },
  nonExistentNaddr: {
    name: 'Non-Existent Naddr',
    args: {
      width: DEFAULT_WIDTH,
      naddr: 'naddr1qqjrqvfevgurzeps956rvcfs95mn2cmp95urzdpe956rjd338yunsve3vdjrgqgwwaehxw309ahx7uewd3hkctczyrt8hwqfm33fqvryz4v9lywftgax3n3x3w9vdx04syyr3xya8pskvqcyqqq8vecaj5ryr',
    },
  },
};
