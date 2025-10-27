// SPDX-License-Identifier: MIT

import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';

const meta: Meta = {
  title: 'Like Button/Styling',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {
    text: 'Like',
    url: 'https://example.com/article',
  },
  parameters: {
    docs: {
      description: {
        component: 'Styling examples for the nostr-like component using CSS variables.',
      },
      source: {
        transform: (code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const CustomColors: Story = {
  name: 'Custom Colors',
  args: {
    text: 'Like',
    url: 'https://example.com/article',
    '--nostrc-like-btn-bg': '#ff6b35',
    '--nostrc-like-btn-color': '#ffffff',
    '--nostrc-like-btn-liked-bg': '#ff8c5a',
    '--nostrc-like-btn-liked-color': '#ffffff',
  },
};

export const CustomSize: Story = {
  name: 'Custom Size',
  args: {
    text: 'Like',
    url: 'https://example.com/article',
    '--nostrc-icon-width': '24px',
    '--nostrc-icon-height': '24px',
    '--nostrc-like-btn-padding': '12px 20px',
  },
};

export const CustomBorderRadius: Story = {
  name: 'Custom Border Radius',
  args: {
    text: 'Like',
    url: 'https://example.com/article',
    '--nostrc-like-btn-border-radius': '20px',
  },
};
