import React from 'react';
import { fn } from 'storybook/test';
import type { ArgTypes, Meta, StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes, THEME_PRESETS } from './testing-utils';
import { POST_DATA } from '../post-data';

const meta: Meta = {
  title: 'NostrPost',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: fn(), onAuthorClick: fn(), onMentionClick: fn() },
  parameters: {
    docs: {
      source: {
        transform: (code, storyContext) =>
          generateCode(storyContext.args, true),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ====================================
// CORE FUNCTIONALITY STORIES
// ====================================

export const Default: Story = {
  name: 'Dergigi - Default',
  args: {
    width: 600,
    noteid: POST_DATA.gigi_free_web.noteid,
    'show-stats': true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Default post display with stats enabled. Shows the basic functionality of the nostr-post component.',
      },
    },
  },
};

export const WithHexId: Story = {
  name: 'With Hex ID',
  args: {
    width: 600,
    hex: POST_DATA.nvk_future_here.hex,
    'show-stats': false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Post using hex format event ID instead of note ID. Demonstrates alternative input format support.',
      },
    },
  },
};

export const NoStats: Story = {
  name: 'No Stats',
  args: {
    width: 600,
    noteid: POST_DATA.jack_video_programming_you.noteid,
    'show-stats': false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Post without stats display. Cleaner look for minimal interfaces.',
      },
    },
  },
};

export const CustomRelays: Story = {
  name: 'Custom Relays',
  args: {
    width: 600,
    noteid: POST_DATA.utxo_us_dollar_backing.noteid,
    relays: 'wss://relay.damus.io,wss://nos.lol',
    'show-stats': true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with custom relay configuration. Demonstrates relay customization capability.',
      },
    },
  },
};

// ====================================
// THEME STORIES
// ====================================

export const DarkTheme: Story = {
  name: 'Dark Theme',
  args: {
    width: 600,
    noteid: POST_DATA.utxo_us_dollar_backing.noteid,
    'show-stats': true,
    wrapperDataTheme: 'dark',
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with dark theme applied via data-theme attribute.',
      },
    },
  },
};

export const OceanGlass: Story = {
  name: 'Ocean Glass Theme',
  args: {
    width: 600,
    noteid: POST_DATA.gigi_free_web.noteid,
    'show-stats': true,
    ...THEME_PRESETS['Ocean Glass'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with Ocean Glass theme applied via CSS variables. Demonstrates gradient backgrounds and glassmorphism effects.',
      },
    },
  },
};

export const Holographic: Story = {
  name: 'Holographic Theme',
  args: {
    width: 600,
    noteid: POST_DATA.jack_video_programming_you.noteid,
    'show-stats': true,
    ...THEME_PRESETS['Holographic'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with Holographic theme applied via CSS variables. Shows vibrant gradient styling.',
      },
    },
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix Theme',
  args: {
    width: 600,
    noteid: POST_DATA.toxic_bitcoiner_image_state_exists.noteid,
    'show-stats': true,
    ...THEME_PRESETS['Neo Matrix'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with Neo Matrix theme applied via CSS variables. Cyberpunk-inspired green terminal styling.',
      },
    },
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange Theme',
  args: {
    width: 600,
    noteid: POST_DATA.ben_expensive_government.hex,
    'show-stats': true,
    ...THEME_PRESETS['Bitcoin Orange'],
  },
  parameters: {
    docs: {
      description: {
        story: 'Post with Bitcoin Orange theme applied via CSS variables. Bitcoin-inspired orange and black styling.',
      },
    },
  },
};