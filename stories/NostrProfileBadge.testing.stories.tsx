import React from 'react';

import type { ArgTypes, Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_RELAYS } from '../src/common/constants.ts';

// Constants
const DEFAULT_WIDTH = 300;
const BUNDLE_SCRIPT = '<script type="module" src="/nostr-components.es.js"></script>';

const PARAMETERS = [
  {
    variable: 'npub',
    description:
      'Nostr public key but in bech32 format.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'nip05',
    description: 'Nostr NIP-05 URI.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'pubkey',
    description:
      'Raw pubkey provided by Nostr.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'relays',
    description: `Comma separated list of valid relays urls in the wss:// protocol\n\nCan be used to customize the list of relays`,
    defaultValue: DEFAULT_RELAYS.join(',\n'),
    control: 'text',
  },
  {
    variable: 'theme',
    description: `Color theme of the component. Only supports two values - light and dark`,
    defaultValue: 'light',
    control: 'select',
    options: ['light', 'dark'],
  },
  {
    variable: 'show-npub',
    description: `Whether need to show the npub in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description:
      'Whether need to show the follow button in the profile badge or not\n\n<b style="background-color: orange; color: white; padding: 0 4px; border-radius: 4px">NOTE:</b> To show the follow button, you need to include the &lt;nostr-follow-button&gt; component from the CDN.\n\nInclude like this,\n&lt;script type="module" src="./dist/nostr-follow-button.js"&gt;&lt;/script&gt;',
    defaultValue: 'false',
    control: 'boolean',
  },
];

const CSS_VARIABLES = [
  {
    variable: '--nstrc-profile-badge-background-light',
    description: `Background color of the badge in the light mode`,
    defaultValue: '#F5F5F5',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-background-dark',
    description: 'Background color of the badge in the dark mode',
    defaultValue: '#121212',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-name-color-light',
    description: 'Color of the name text in light mode',
    defaultValue: '#444',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-name-color-dark',
    description: 'Color of the name text in dark mode',
    defaultValue: '#CCC',
    control: 'color',
  },
];

const generateCode = (args, forCodeGen = false) => {
  const attributes = [
    args.npub ? `npub="${args.npub}"` : '',
    args.nip05 ? `nip05="${args.nip05}"` : '',
    args.pubkey ? `pubkey="${args.pubkey}"` : '',
    args.relays ? `relays="${args.relays}"` : '',
    args.theme ? `theme="${args.theme}"` : '',
    args['show-npub'] ? `show-npub="${args['show-npub']}"` : '',
    args['show-follow'] ? `show-follow="${args['show-follow']}"` : '',
  ]
    .filter(Boolean)
    .join('\n  ');

  const cssVariables = CSS_VARIABLES.map(cssVariable => {
    return args[cssVariable.variable]
      ? `${cssVariable.variable}: ${args[cssVariable.variable]} !important;`
      : '';
  })
    .filter(Boolean)
    .join('\n    ');

  let styles = '';

  if (cssVariables.length > 0) {
    styles += `<style>\n  :root {\n    ${cssVariables}\n  }\n</style>`;
  }

  const bundleScript = BUNDLE_SCRIPT;
  let component = '';

  component += `<div style="width: ${args.width ? `${args.width}px` : DEFAULT_WIDTH}px">\n`;

  component += `<nostr-profile-badge\n  ${attributes}\n></nostr-profile-badge>`;

  component += '\n</div>';

  return `${bundleScript}${styles ? `\n\n${styles}` : ''}\n\n${component}`.trim();
};

const argTypes: Partial<ArgTypes> = {};

PARAMETERS.forEach(parameter => {
  argTypes[parameter.variable] = {
    description: parameter.description,
    type: parameter.control as any,
    table: {
      defaultValue: {
        summary: parameter.defaultValue,
      },
    },
    control: parameter.control as any,
    options: parameter.options || [],
  };
});

CSS_VARIABLES.forEach(cssVariable => {
  argTypes[cssVariable.variable] = {
    description: cssVariable.description,
    type: 'string',
    table: {
      category: 'CSS Variables',
      defaultValue: {
        summary: cssVariable.defaultValue,
      },
    },
    control: {
      type: cssVariable.control as any,
    },
  };
});

const meta: Meta = {
  title: 'NostrProfileBadge/Testing',
  tags: ['test', 'dev'], // Hidden from public Storybook
  render: args => generateCode(args),
  argTypes: argTypes,
  args: { onClick: () => {} },
  parameters: {
    // Storybook 9 feature: Component testing configuration
    test: {
      // Enable component testing
      enabled: true,
      // Accessibility testing
      a11y: {
        element: 'nostr-profile-badge',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ====================================
// INVALID INPUT TESTS
// ====================================

export const InvalidNPub: Story = {
  name: '❌ Invalid NPub Format',
  tags: ['test', 'error-handling'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'invalid-npub-format-xyz123',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests how the component handles malformed npub input.',
      },
    },
  },
};

export const InvalidNip05: Story = {
  name: '❌ Invalid NIP-05',
  tags: ['test', 'error-handling'],
  args: {
    width: DEFAULT_WIDTH,
    nip05: 'malformed@invalid@domain.com',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests how the component handles malformed NIP-05 format.',
      },
    },
  },
};

export const EmptyInputs: Story = {
  name: '🔄 Empty/Null Inputs',
  tags: ['test', 'edge-cases'],
  args: {
    width: DEFAULT_WIDTH,
    npub: '',
    nip05: '',
    pubkey: '',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component behavior with empty or null values.',
      },
    },
  },
};

export const NetworkFailure: Story = {
  name: '🌐 Network/Relay Failure',
  tags: ['test', 'network'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    relays: 'wss://invalid-relay.nonexistent',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component resilience with unreachable relays.',
      },
    },
  },
};

// ====================================
// FEATURE COMBINATION TESTS
// ====================================

export const ShowNPub: Story = {
  name: '📋 Show NPub Feature',
  tags: ['test', 'features'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    'show-npub': true,
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests the show-npub feature display and copy functionality.',
      },
    },
  },
};

export const ShowFollow: Story = {
  name: '👥 Show Follow Button',
  tags: ['test', 'features'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
    'show-follow': true,
    theme: 'dark',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests the follow button integration and functionality.',
      },
    },
  },
};

export const PubkeyInput: Story = {
  name: '🔑 Raw Pubkey Input',
  tags: ['test', 'input-types'],
  args: {
    width: DEFAULT_WIDTH,
    pubkey: '1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component with raw hex pubkey instead of npub.',
      },
    },
  },
};


// ====================================
// EDGE CASE TESTS
// ====================================

export const NarrowWidth: Story = {
  name: '📏 Narrow Width',
  tags: ['test', 'responsive'],
  args: {
    width: 200,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component responsiveness at narrow widths.',
      },
    },
  },
};

export const ExtremelyWideWidth: Story = {
  name: '📐 Extremely Wide Width',
  tags: ['test', 'responsive'],
  args: {
    width: 1200,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests component behavior at very wide widths.',
      },
    },
  },
};

export const InvalidTheme: Story = {
  name: '🎨 Invalid Theme Value',
  tags: ['test', 'error-handling'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'rainbow', // Invalid theme
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests fallback behavior with invalid theme values.',
      },
    },
  },
};


// ====================================
// ACCESSIBILITY TESTS
// ====================================


export const HighContrastTest: Story = {
  name: '🔍 High Contrast Test',
  tags: ['test', 'a11y'],
  args: {
    width: DEFAULT_WIDTH,
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    theme: 'dark',
    '--nstrc-profile-badge-background-dark': '#000000',
    '--nstrc-profile-badge-name-color-dark': '#FFFFFF',
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests high contrast mode for visually impaired users.',
      },
    },
  },
};

// ====================================
// COMPREHENSIVE TESTING DASHBOARD
// ====================================

export const TestingDashboard: Story = {
  name: '🧪 Complete Testing Dashboard',
  tags: ['test', 'dashboard'],
  render: () => `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px; background: #f5f5f5;">
      
      <!-- Header -->
      <div style="grid-column: 1 / -1; text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #333;">NostrProfileBadge Testing Dashboard</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Essential test cases for component validation</p>
      </div>

      <!-- Valid Cases -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
        <h3 style="margin: 0 0 10px 0; color: #16a34a;">✅ Valid Inputs</h3>
        <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"></nostr-profile-badge>
      </div>

      <!-- Invalid Cases -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
        <h3 style="margin: 0 0 10px 0; color: #dc2626;">❌ Invalid NPub</h3>
        <nostr-profile-badge npub="invalid-npub-format"></nostr-profile-badge>
      </div>

      <!-- Empty Cases -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <h3 style="margin: 0 0 10px 0; color: #d97706;">🔄 Empty Input</h3>
        <nostr-profile-badge npub=""></nostr-profile-badge>
      </div>

      <!-- Feature Tests -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <h3 style="margin: 0 0 10px 0; color: #2563eb;">📋 Show NPub</h3>
        <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" show-npub="true"></nostr-profile-badge>
      </div>

      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
        <h3 style="margin: 0 0 10px 0; color: #7c3aed;">👥 Show Follow</h3>
        <nostr-profile-badge npub="npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx" show-follow="true"></nostr-profile-badge>
      </div>

      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #06b6d4;">
        <h3 style="margin: 0 0 10px 0; color: #0891b2;">🔗 All Features</h3>
        <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" show-npub="true" show-follow="true"></nostr-profile-badge>
      </div>

      <!-- Dark Theme -->
      <div style="background: #1f2937; padding: 15px; border-radius: 8px; border-left: 4px solid #6b7280;">
        <h3 style="margin: 0 0 10px 0; color: #e5e7eb;">🌙 Dark Theme</h3>
        <nostr-profile-badge npub="npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx" theme="dark"></nostr-profile-badge>
      </div>

      <!-- Responsive Test -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ec4899;">
        <h3 style="margin: 0 0 10px 0; color: #db2777;">📱 Narrow Width</h3>
        <div style="width: 200px;">
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"></nostr-profile-badge>
        </div>
      </div>

      <!-- Network Failure -->
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316;">
        <h3 style="margin: 0 0 10px 0; color: #ea580c;">🌐 Network Failure</h3>
        <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" relays="wss://invalid-relay.com"></nostr-profile-badge>
      </div>

    </div>
  `,
  parameters: {
    layout: 'fullscreen',
  },
};