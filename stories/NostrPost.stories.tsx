import React from 'react';

import { fn } from '@storybook/test';
import type { ArgTypes, Meta, StoryObj } from '@storybook/web-components';
import {
  Title,
  Subtitle,
  Description,
  Primary,
  Controls,
} from '@storybook/addon-docs';

const PARAMETERS = [
  {
    variable: 'id',
    description: `Valid raw Nostr ID or valid Bech32 note ID`,
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
    variable: 'show-stats',
    description: `Whether need to show the stats of the post or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
];

const CSS_VARIABLES = [
  {
    variable: '--nstrc-post-background-light',
    description: `Background color of the post in the light mode`,
    defaultValue: '#F5F5F5',
    control: 'color',
  },
  {
    variable: '--nstrc-post-background-dark',
    description: 'Background color of the profile in the dark mode',
    defaultValue: '#000000',
    control: 'color',
  },
  {
    variable: '--nstrc-post-name-color-light',
    description: `Color of the author name in light mode`,
    defaultValue: '#444444',
    control: 'color',
  },
  {
    variable: '--nstrc-post-name-color-dark',
    description: `Color of the author name in dark mode`,
    defaultValue: '#CCCCCC',
    control: 'color',
  },
  {
    variable: '--nstrc-post-nip05-color-light',
    description: `Color of the author NIP-05 text in light mode`,
    defaultValue: '#808080',
    control: 'color',
  },
  {
    variable: '--nstrc-post-nip05-color-dark',
    description: `Color of the author NIP-05 text in dark mode`,
    defaultValue: '#757575',
    control: 'color',
  },
  {
    variable: '--nstrc-post-skeleton-min-hsl-light',
    description: 'Minimum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 80%',
    control: 'text',
  },
  {
    variable: '--nstrc-post-skeleton-min-hsl-dark',
    description: 'Minimum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 20%',
    control: 'text',
  },
  {
    variable: '--nstrc-post-skeleton-max-hsl-light',
    description: 'Maximum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 95%',
    control: 'text',
  },
  {
    variable: '--nstrc-post-skeleton-max-hsl-dark',
    description: 'Maximum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 30%',
    control: 'text',
  },
  {
    variable: '--nstrc-post-text-color-light',
    description: 'Color the text in the post in light mode',
    defaultValue: '#222222',
    control: 'color',
  },
  {
    variable: '--nstrc-post-text-color-dark',
    description: 'Color the text in the post in dark mode',
    defaultValue: '#D4D4D4',
    control: 'color',
  },
  {
    variable: '--nstrc-post-stat-text-color-light',
    description: 'Color of the stat text in light mode',
    defaultValue: '#222222',
    control: 'color',
  },
  {
    variable: '--nstrc-post-stat-text-color-dark',
    description: 'Color of the stat text in dark mode',
    defaultValue: '#D0D0D0',
    control: 'color',
  },
  {
    variable: '--nstrc-post-name-font-weight',
    description: 'Font weight of the author name',
    defaultValue: '700',
    control: 'number',
  },
  {
    variable: '--nstrc-post-nip05-font-weight',
    description: 'Font weight of the author NIP-05',
    defaultValue: '400',
    control: 'number',
  },
];

const generateCode = (args, forCodeGen = false) => {
  const attributes = [
    args.id ? `id="${args.id}"` : '',
    args.relays ? `relays="${args.relays}"` : '',
    args.theme ? `theme="${args.theme}"` : '',
    args['show-stats'] ? `show-stats="${args['show-stats']}"` : '',
  ]
    .filter(Boolean)
    .join('\n  ');

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

  const bundleScript = `<script type="module" src="/nostr-components.es.js"></script>`;
  let component = '';

  // if(!forCodeGen) {
  //   component += '<div style="width: 350px">\n  ';
  // }

  component += `<div style="width: ${args.width ? `${args.width}px` : '600px'}">\n`;

  component += `<nostr-post\n  ${attributes}\n></nostr-post>`;

  component += '\n</div>';

  // if(!forCodeGen) {
  //   component += '\n</div>';
  // }

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
  title: 'NostrPost',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: argTypes,
  args: { onClick: fn(), onAuthorClick: fn() },
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

export const Default: Story = {
  name: 'Default',
  argTypes: {
    width: { contro: 'number' },
    id: { control: 'text' },
  },
  args: {
    width: 600,
    id: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
    'show-stats': true,
  },
};

export const UTXO: Story = {
  name: 'Utxo - Dark theme',
  argTypes: {
    width: { contro: 'number' },
    id: { control: 'text' },
  },
  args: {
    width: 600,
    id: 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc',
    theme: 'dark',
    'show-stats': true,
  },
};

export const Nvk: Story = {
  name: 'Nvk - No Stats',
  argTypes: {
    width: { contro: 'number' },
    id: { control: 'text' },
  },
  args: {
    width: 600,
    id: 'note1u6pg7p09y7w9x3n9yqeutzx9pqfc80w3dst3h6x3m2550s4w4j9sgn5wga',
  },
};
