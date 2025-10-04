import { fn } from 'storybook/test';
import type { ArgTypes, Meta, StoryObj } from '@storybook/web-components-vite';
import { DEFAULT_RELAYS } from '../../src/common/constants.ts';
const PARAMETERS = [
  {
    variable: 'npub',
    description: `Nostr public key but in bech32 format`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'nip05',
    description: `Nostr NIP-05 URI`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'pubkey',
    description: `Raw pubkey provided by Nostr`,
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
    variable: 'icon-width',
    description: `Used to control the width of ostrich and success icon/animations inside the button`,
    defaultValue: '25',
    control: 'number',
  },
  {
    variable: 'icon-height',
    description: `Used to control the height of ostrich and success icon/animations inside the button`,
    defaultValue: '25',
    control: 'number',
  },
];

const CSS_VARIABLES = [
  {
    variable: '--nostrc-follow-btn-padding',
    description: `Horizontal and vertical padding of the button`,
    defaultValue: '8px 12px',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-font-size',
    description: 'Size of the font inside the button',
    defaultValue: '1em',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-border-radius',
    description: 'Border radius of the button',
    defaultValue: '8px',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-border',
    description: 'Border style of the button',
    defaultValue: '1px solid var(--nostrc-color-border)',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-bg',
    description: 'Background color of the button',
    defaultValue: 'var(--nostrc-color-background)',
    control: 'color',
  },
  {
    variable: '--nostrc-follow-btn-hover-bg',
    description: 'Background color of the button on hover',
    defaultValue: 'var(--nostrc-color-hover-background)',
    control: 'color',
  },
  {
    variable: '--nostrc-follow-btn-color',
    description: 'Text color of the button',
    defaultValue: 'var(--nostrc-color-text-primary)',
    control: 'color',
  },
  {
    variable: '--nostrc-follow-btn-min-height',
    description: 'Minimum height of the button',
    defaultValue: 'auto',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-width',
    description: 'Width of the button',
    defaultValue: 'auto',
    control: 'text',
  },
  {
    variable: '--nostrc-follow-btn-horizontal-alignment',
    description: 'Horizontal alignment of the button content',
    defaultValue: 'center',
    control: 'text',
  },
];

// Special theme presets for Storybook controls
const THEME_PRESETS = {
  'Ocean Glass': {
    '--nostrc-follow-btn-bg': 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(135deg, #0b486b, #f56217)',
    '--nostrc-follow-btn-color': '#e8fbff',
    '--nostrc-follow-btn-border': '1px solid rgba(232,251,255,0.35)',
    '--nostrc-follow-btn-hover-bg': 'rgba(232, 251, 255, 0.15)',
  },
  'Holographic': {
    '--nostrc-follow-btn-bg': 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 30%, #84fab0 60%, #8fd3f4 100%)',
    '--nostrc-follow-btn-color': '#1b2a2f',
    '--nostrc-follow-btn-border': '1px solid rgba(27,42,47,0.25)',
    '--nostrc-follow-btn-hover-bg': 'rgba(27, 42, 47, 0.1)',
  },
  'Neo Matrix': {
    '--nostrc-follow-btn-bg': '#061a12',
    '--nostrc-follow-btn-color': '#00ff88',
    '--nostrc-follow-btn-border': '2px solid #00ff66',
    '--nostrc-follow-btn-hover-bg': 'rgba(0, 255, 136, 0.1)',
  },
  'Bitcoin Orange': {
    '--nostrc-follow-btn-bg': '#F7931A',
    '--nostrc-follow-btn-color': '#1a1a1a',
    '--nostrc-follow-btn-border': '1px solid #cc6f00',
    '--nostrc-follow-btn-hover-bg': 'rgba(26, 26, 26, 0.1)',
  },
};

const generateCode = args => {
  const attributes = [
    args.npub ? `npub="${args.npub}"` : '',
    args.nip05 ? `nip05="${args.nip05}"` : '',
    args.pubkey ? `pubkey="${args.pubkey}"` : '',
    args.relays ? `relays="${args.relays}"` : '',
    args['icon-width'] ? `icon-width="${args['icon-width']}"` : '',
    args['icon-height'] ? `icon-height="${args['icon-height']}"` : '',
  ]
    .filter(Boolean) // Remove empty strings
    .join('\n  ');

  const bundleScript = `<script type="module" src="/nostr-components.es.js"></script>`;

  const cssVariables = CSS_VARIABLES.map(cssVariable => {
    // console.log(args[cssVariable.variable]);
    return args[cssVariable.variable]
      ? `${cssVariable.variable}: ${args[cssVariable.variable]};`
      : '';
  })
    .filter(Boolean)
    .join('\n    ');

  let styles = '';

  if (cssVariables.length > 0) {
    styles += `<style>\n  nostr-follow-button {\n    ${cssVariables}\n  }\n</style>`;
  }

  let component = '';
  component += `To follow saiy2k: <br/><nostr-follow-button\n  ${attributes}\n></nostr-follow-button>`;

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
  title: 'NostrFollowButton',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: argTypes,
  args: { onClick: fn() },
  parameters: {
    docs: {
      source: {
        transform: (code, storyContext) => generateCode(storyContext.args),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: 'Default',
  argTypes: {
    npub: { control: 'text' },
  },
  args: {
    nip05: 'saiy2k@iris.to',
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
      description: {
        story: 'Follow button with Ocean Glass theme applied via CSS variables.',
      },
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
      description: {
        story: 'Follow button with Holographic theme applied via CSS variables.',
      },
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
      description: {
        story: 'Follow button with Neo Matrix theme applied via CSS variables.',
      },
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
      description: {
        story: 'Follow button with Bitcoin Orange theme applied via CSS variables.',
      },
    },
  },
};

