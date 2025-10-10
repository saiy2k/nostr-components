import type { Meta, StoryObj } from '@storybook/web-components';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from "./utils";
import { POST_DATA } from '../post-data';
import { INVALID_TEST_CASES } from './test-cases-invalid';
import { createPrimaryAttributeChangesPlay } from '../common/primary-attribute-changes';
import { createComprehensiveDynamicPlay } from '../common/comprehensive-dynamic';
import { createFastSwitchingPlay } from '../common/fast-switching';

const meta: Meta = {
  title: 'Post/Testing/Dynamic',
  tags: ['test', 'dynamic'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
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
    noteid: POST_DATA.gigi_free_web.noteid,
  },
  play: createPrimaryAttributeChangesPlay(
    'nostr-post',
    ['noteid', 'hex', 'eventid'],
    [
      { type: 'noteid', value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
      { type: 'noteid', value: INVALID_TEST_CASES.invalidNoteId.args.noteid, name: 'Invalid Note ID' },
      { type: 'noteid', value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
      { type: 'hex', value: INVALID_TEST_CASES.invalidHex.args.hex, name: 'Invalid Hex' },
      { type: 'noteid', value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
      { type: 'eventid', value: INVALID_TEST_CASES.invalidEventId.args.eventid, name: 'Invalid Event ID' },
      { type: 'hex', value: POST_DATA.nvk_future_here.hex, name: 'NVK Future' },
      { type: 'noteid', value: INVALID_TEST_CASES.emptyValues.args.noteid, name: 'Empty Note ID' },
    ],
    8000
  ),
};

export const AllAttributes: Story = {
  name: 'All Attributes',
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
  },
  play: createComprehensiveDynamicPlay({
    componentName: 'nostr-post',
    inputAttributes: ['noteid', 'hex', 'eventid'],
    testInputs: [
      { type: 'noteid', value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
      { type: 'noteid', value: INVALID_TEST_CASES.invalidNoteId.args.noteid, name: 'Invalid Note ID' },
      { type: 'noteid', value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
      { type: 'hex', value: INVALID_TEST_CASES.invalidHex.args.hex, name: 'Invalid Hex' },
      { type: 'noteid', value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
      { type: 'eventid', value: INVALID_TEST_CASES.invalidEventId.args.eventid, name: 'Invalid Event ID' },
      { type: 'hex', value: POST_DATA.nvk_future_here.hex, name: 'NVK Future' },
      { type: 'noteid', value: INVALID_TEST_CASES.emptyValues.args.noteid, name: 'Empty Note ID' },
    ],
    widths: [600, 500, 400, 700],
    booleanAttributes: ['show-stats'],
    updateInterval: 8000
  }),
};

export const FastSwitching: Story = {
  name: 'Fast switching',
  args: {
    width: DEFAULT_WIDTH,
    noteid: POST_DATA.gigi_free_web.noteid,
    'show-stats': "true",
  },
  play: createFastSwitchingPlay({
    componentName: 'nostr-post',
    attribute1: {
      name: 'noteid',
      values: [
        { value: POST_DATA.gigi_free_web.noteid, name: 'Gigi Free Web' },
        { value: INVALID_TEST_CASES.invalidNoteId.args.noteid, name: 'Invalid Note ID' },
        { value: POST_DATA.utxo_us_dollar_backing.noteid, name: 'UTXO Dollar' },
        { value: POST_DATA.jack_video_programming_you.noteid, name: 'Jack Video' },
        { value: POST_DATA.nvk_future_here.noteid, name: 'NVK Future' },
        { value: POST_DATA.gigi_free_web.hex, name: 'Gigi Hex' },
        { value: INVALID_TEST_CASES.emptyValues.args.noteid, name: 'Empty Note ID' },
        { value: POST_DATA.utxo_us_dollar_backing.hex, name: 'UTXO Hex' },
      ]
    },
    attribute2: {
      name: 'show-stats',
      values: [
        { value: 'true', name: 'Show Stats' },
        { value: 'false', name: 'Hide Stats' },
      ]
    },
    maxFastUpdates: 8,
    pauseDuration: 12000,
    fastDelayMin: 150,
    fastDelayMax: 300
  }),
};