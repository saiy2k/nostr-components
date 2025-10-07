import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, getArgTypes } from './utils.ts';
import { FOLLOW_BUTTON_THEMES } from './theme';
import { PROFILE_DATA } from '../profile-data.ts';

const meta: Meta = {
  title: 'NostrFollowButton/Themes',
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
    ...FOLLOW_BUTTON_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: 'Holographic',
  args: {
    pubkey: PROFILE_DATA.preston.pubkey,
    ...FOLLOW_BUTTON_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    pubkey: PROFILE_DATA.jimmysong.pubkey,
    ...FOLLOW_BUTTON_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    pubkey: PROFILE_DATA.guyswann.pubkey,
    ...FOLLOW_BUTTON_THEMES['bitcoin-orange'],
  },
};

