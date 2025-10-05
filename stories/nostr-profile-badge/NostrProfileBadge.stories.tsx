import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes, THEME_PRESETS } from './testing-utils.ts';
import { TEST_CASES } from './test-cases-valid.ts';

const meta: Meta = {
  title: 'NostrProfileBadge',
  tags: ['autodocs'],
  render: args => {
    const html = generateCode(args);
    // Create a template element to avoid HTML encoding
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true);
  },
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: {
      description: {
        component: 'A web component for displaying Nostr profile information in a compact badge format. Supports npub, nip05, and raw pubkey inputs with light/dark theme support and optional features like npub display and follow button integration.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ====================================
// PUBLIC DEMO STORIES
// ====================================

export const Fiatjaf: Story = {
  name: 'Fiatjaf - Default',
  args: TEST_CASES.fiatjaf.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.fiatjaf.description,
      },
    },
  },
};

export const Odell: Story = {
  name: 'Odell - Dark theme',
  args: {
    ...TEST_CASES.odell.args,
    wrapperDataTheme: TEST_CASES.odell.wrapperDataTheme,
  },
  parameters: {
    docs: {
      description: {
        story: `${TEST_CASES.odell.description}

**New Theme System Usage:**
\`\`\`html
<link rel="stylesheet" href="dist/themes.css">

<div data-theme="dark">
  <nostr-profile-badge npub="${TEST_CASES.odell.args.npub}"></nostr-profile-badge>
</div>
\`\`\`

The component now uses the new \`data-theme="dark"\` approach instead of the \`theme\` prop.`,
      },
    },
  },
};

export const OceanGlass: Story = {
  name: 'Ocean Glass',
  args: {
    nip05: 'saiy2k@iris.to',
    ...THEME_PRESETS['Ocean Glass'],
  },
  parameters: {
    docs: {
      description: { story: 'Profile badge with Ocean Glass theme applied via CSS variables.' },
    },
  },
};


export const Holographic: Story = {
  name: 'Holographic',
  args: {
    nip05: 'saiy2k@iris.to',
    ...THEME_PRESETS['Holographic'],
  },
  parameters: {
    docs: {
      description: { story: 'Profile badge with Holographic theme applied via CSS variables.' },
    },
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    nip05: 'saiy2k@iris.to',
    ...THEME_PRESETS['Neo Matrix'],
  },
  parameters: {
    docs: {
      description: { story: 'Profile badge with Neo Matrix theme applied via CSS variables.' },
    },
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    nip05: 'saiy2k@iris.to',
    ...THEME_PRESETS['Bitcoin Orange'],
  },
  parameters: {
    docs: {
      description: { story: 'Profile badge with Bitcoin Orange theme applied via CSS variables.' },
    },
  },
};

export const Lyn: Story = {
  name: 'Lyn Alden - nip05',
  args: TEST_CASES.lyn.args,
  parameters: {
    docs: {
      description: {
        story: TEST_CASES.lyn.description,
      },
    },
  },
};