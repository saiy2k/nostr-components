import React from 'react';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_WIDTH, BUNDLE_SCRIPT, generateCode, generateCodeWithScript, generateArgTypes } from './testing-utils.ts';
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
    ...TEST_CASES.oceanGlass.args,
    wrapperDataTheme: TEST_CASES.oceanGlass.wrapperDataTheme,
  },
  parameters: {
    docs: {
      description: { story: TEST_CASES.oceanGlass.description },
    },
  },
};


export const Holographic: Story = {
  name: 'Holographic',
  args: {
    ...TEST_CASES.holographic.args,
    wrapperDataTheme: TEST_CASES.holographic.wrapperDataTheme,
  },
  parameters: {
    docs: {
      description: { story: TEST_CASES.holographic.description },
    },
  },
};

export const NeoMatrix: Story = {
  name: 'Neo Matrix',
  args: {
    ...TEST_CASES.neoMatrix.args,
    wrapperDataTheme: TEST_CASES.neoMatrix.wrapperDataTheme,
  },
  parameters: {
    docs: {
      description: { story: TEST_CASES.neoMatrix.description },
    },
  },
};

export const BitcoinOrange: Story = {
  name: 'Bitcoin Orange',
  args: {
    ...TEST_CASES.bitcoinOrange.args,
    wrapperDataTheme: TEST_CASES.bitcoinOrange.wrapperDataTheme,
  },
  parameters: {
    docs: {
      description: { story: TEST_CASES.bitcoinOrange.description },
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