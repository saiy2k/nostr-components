import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils.ts';
import { PROFILE_BADGE_THEMES } from './theme';
import { PROFILE_DATA } from '../profile-data.ts';

const meta: Meta = {
  title: 'NostrProfileBadge/Themes',
  render: args => {
    const html = generateCode(args);
    // Create a template element to avoid HTML encoding
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true);
  },
  argTypes: getArgTypes(),
  args: { onClick: () => {} },
};

export default meta;
type Story = StoryObj;

export const OceanGlass: Story = {
  name: 'Ocean Glass',
  args: {
    pubkey: PROFILE_DATA.adamback.pubkey,
    ...PROFILE_BADGE_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: 'Holographic',
  args: {
    pubkey: PROFILE_DATA.preston.pubkey,
    ...PROFILE_BADGE_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    pubkey: PROFILE_DATA.jimmysong.pubkey,
    ...PROFILE_BADGE_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    pubkey: PROFILE_DATA.guyswann.pubkey,
    ...PROFILE_BADGE_THEMES['bitcoin-orange'],
  },
};
