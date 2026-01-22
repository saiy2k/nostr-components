import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { LIVESTREAM_DATA } from '../livestream-data';
import { INVALID_TEST_CASES } from './test-cases-invalid';
import { createPrimaryAttributeChangesPlay } from '../common/primary-attribute-changes';
import { createComprehensiveDynamicPlay } from '../common/comprehensive-dynamic';
import { createFastSwitchingPlay } from '../common/fast-switching';

const meta: Meta = {
  title: 'Livestream/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-livestream',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const InputChanges: Story = {
  name: 'Input Changes',
  args: {
    width: DEFAULT_WIDTH,
    naddr: LIVESTREAM_DATA.live.naddr,
  },
  play: createPrimaryAttributeChangesPlay(
    'nostr-livestream',
    ['naddr'],
    [
      { type: 'naddr', value: LIVESTREAM_DATA.live.naddr, name: 'Live Livestream' },
      { type: 'naddr', value: LIVESTREAM_DATA.live2.naddr, name: 'Live Livestream 2' },
      { type: 'naddr', value: INVALID_TEST_CASES.invalidNaddr.args.naddr, name: 'Invalid Naddr' },
      { type: 'naddr', value: LIVESTREAM_DATA.ended.naddr, name: 'Ended Livestream' },
      { type: 'naddr', value: INVALID_TEST_CASES.malformedNaddr.args.naddr, name: 'Malformed Naddr' },
      { type: 'naddr', value: LIVESTREAM_DATA.planned.naddr, name: 'Planned Livestream' },
      { type: 'naddr', value: LIVESTREAM_DATA.live2.naddr, name: 'Live Livestream 2' },
      { type: 'naddr', value: INVALID_TEST_CASES.emptyNaddr.args.naddr, name: 'Empty Naddr' },
    ],
    12000
  ),
};

export const AllAttributes: Story = {
  name: 'All Attributes',
  args: {
    width: DEFAULT_WIDTH,
    naddr: LIVESTREAM_DATA.live.naddr,
  },
  play: createComprehensiveDynamicPlay({
    componentName: 'nostr-livestream',
    inputAttributes: ['naddr'],
    testInputs: [
      { type: 'naddr', value: LIVESTREAM_DATA.live.naddr, name: 'Live Livestream' },
      { type: 'naddr', value: LIVESTREAM_DATA.live2.naddr, name: 'Live Livestream 2' },
      { type: 'naddr', value: INVALID_TEST_CASES.invalidNaddr.args.naddr, name: 'Invalid Naddr' },
      { type: 'naddr', value: LIVESTREAM_DATA.ended.naddr, name: 'Ended Livestream' },
      { type: 'naddr', value: INVALID_TEST_CASES.malformedNaddr.args.naddr, name: 'Malformed Naddr' },
      { type: 'naddr', value: LIVESTREAM_DATA.planned.naddr, name: 'Planned Livestream' },
      { type: 'naddr', value: LIVESTREAM_DATA.live2.naddr, name: 'Live Livestream 2' },
      { type: 'naddr', value: INVALID_TEST_CASES.emptyNaddr.args.naddr, name: 'Empty Naddr' },
    ],
    widths: [800, 600, 500, 900],
    booleanAttributes: ['show-participants', 'show-participant-count', 'auto-play'],
    updateInterval: 8000
  }),
};

export const FastSwitching: Story = {
  name: 'Fast switching',
  args: {
    width: DEFAULT_WIDTH,
    naddr: LIVESTREAM_DATA.live.naddr,
    'show-participants': "true",
  },
  play: createFastSwitchingPlay({
    componentName: 'nostr-livestream',
    attribute1: {
      name: 'naddr',
      values: [
        { value: LIVESTREAM_DATA.live.naddr, name: 'Live Livestream' },
        { value: INVALID_TEST_CASES.invalidNaddr.args.naddr, name: 'Invalid Naddr' },
        { value: LIVESTREAM_DATA.ended.naddr, name: 'Ended Livestream' },
        { value: LIVESTREAM_DATA.live2.naddr, name: 'Live Livestream 2' },
        { value: INVALID_TEST_CASES.malformedNaddr.args.naddr, name: 'Malformed Naddr' },
        { value: LIVESTREAM_DATA.planned.naddr, name: 'Planned Livestream' },
        { value: INVALID_TEST_CASES.emptyNaddr.args.naddr, name: 'Empty Naddr' },
      ]
    },
    attribute2: {
      name: 'show-participants',
      values: [
        { value: 'true', name: 'Show Participants' },
        { value: 'false', name: 'Hide Participants' },
      ]
    },
    maxFastUpdates: 8,
    pauseDuration: 12000,
    fastDelayMin: 150,
    fastDelayMax: 300
  }),
};
