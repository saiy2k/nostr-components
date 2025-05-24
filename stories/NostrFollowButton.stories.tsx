import { fn } from '@storybook/test';
import type { ArgTypes, Meta, StoryObj } from '@storybook/web-components';
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
    defaultValue:
      'wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net,wss://nos.lol,wss://nostr-pub.wellorder.net,wss://njump.me,wss://relay.primal.net',
    control: 'text',
  },
  {
    variable: 'theme',
    description: `Color theme of the component. Only supports two values - light and darkt`,
    defaultValue: 'light',
    control: 'select',
    options: ['light', 'dark'],
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
    variable: '--nstrc-follow-btn-padding',
    description: `Horizontal and vertical padding of the button`,
    defaultValue: '10px 16px',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-font-size',
    description: 'Size of the font inside the button',
    defaultValue: '16px',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-background-dark',
    description: 'Background color of the button in the dark mode',
    defaultValue: '#000000',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-background-light',
    description: 'Background color of the button in the light mode',
    defaultValue: '#FFFFFF',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-hover-background-dark',
    description:
      'Background color of the button while hovering in the dark mode',
    defaultValue: '#222222',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-hover-background-light',
    description:
      'Background color of the button while hovering in the light mode',
    defaultValue: '#F9F9F9',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-border-dark',
    description: 'Border style of the button in the dark mode',
    defaultValue: 'none',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-border-light',
    description: 'Border style of the button in the light mode',
    defaultValue: '1px solid #DDDDDD',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-text-color-dark',
    description: 'Color of the text inside the button in dark mode',
    defaultValue: '#FFFFFF',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-text-color-light',
    description: 'Color of the text inside the button in light mode',
    defaultValue: '#000000',
    control: 'color',
  },
  {
    variable: '--nstrc-follow-btn-border-radius',
    description: 'Border radius of the button',
    defaultValue: '8px',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-error-font-size',
    description: 'Font size of the error message',
    defaultValue: '12px',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-error-line-height',
    description: 'Line height of the error message',
    defaultValue: '1em',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-error-max-width',
    description: 'Maximum width the error message should take',
    defaultValue: '250px',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-horizontal-alignment',
    description:
      'Horizontal alignment of the button when the error message is displayed. Accepts the values of justify-content CSS flex property',
    defaultValue: 'start',
    control: 'text',
  },
  {
    variable: '--nstrc-follow-btn-min-height',
    description: 'Minimum height of the button',
    defaultValue: '47px',
    control: 'text',
  },
];

const generateCode = args => {
  const attributes = [
    args.npub ? `npub="${args.npub}"` : '',
    args.nip05 ? `nip05="${args.nip05}"` : '',
    args.pubkey ? `pubkey="${args.pubkey}"` : '',
    args.relays ? `relays="${args.relays}"` : '',
    args.theme ? `theme="${args.theme}"` : '',
    args['icon-width'] ? `icon-width="${args['icon-width']}"` : '',
    args['icon-height'] ? `icon-height="${args['icon-height']}"` : '',
  ]
    .filter(Boolean) // Remove empty strings
    .join('\n  ');

  const bundleScript = `<script type="module" src="/nostr-components.es.js"></script>`;

  const cssVariables = CSS_VARIABLES.map(cssVariable => {
    console.log(args[cssVariable.variable]);
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
    theme: 'light',
  },
};
