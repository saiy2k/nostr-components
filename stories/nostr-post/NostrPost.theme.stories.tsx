import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils';
import { POST_THEMES } from './theme';
import { POST_DATA } from '../post-data';

const meta: Meta = {
  title: 'NostrPost/Themes',
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
};

export default meta;
type Story = StoryObj;

export const OceanGlass: Story = {
  name: 'Ocean Glass Theme',
  args: {
    width: 600,
    noteid: POST_DATA.gigi_free_web.noteid,
    'show-stats': true,
    ...POST_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: 'Holographic Theme',
  args: {
    width: 600,
    noteid: POST_DATA.jack_video_programming_you.noteid,
    'show-stats': true,
    ...POST_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix Theme',
  args: {
    width: 600,
    noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
    'show-stats': true,
    ...POST_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange Theme',
  args: {
    width: 600,
    noteid: POST_DATA.ben_expensive_government.hex,
    'show-stats': true,
    ...POST_THEMES['bitcoin-orange'],
  },
};
