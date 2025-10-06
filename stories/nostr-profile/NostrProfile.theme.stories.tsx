import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, generateCode, getArgTypes } from './utils.ts';
import { PROFILE_THEMES } from './theme';
import { PROFILE_DATA } from '../profile-data.ts';

const meta: Meta = {
  title: 'NostrProfile/Themes',
  render: args => {
    const html = generateCode(args);
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
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.saiy2k.npub,
    ...PROFILE_THEMES['ocean-glass'],
  },
};

export const Holographic: Story = {
  name: 'Holographic',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.jb55.npub,
    ...PROFILE_THEMES['holographic'],
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.derGigi.npub,
    ...PROFILE_THEMES['neo-matrix'],
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    width: DEFAULT_WIDTH,
    npub: PROFILE_DATA.utxo.npub,
    ...PROFILE_THEMES['bitcoin-orange'],
  },
};
