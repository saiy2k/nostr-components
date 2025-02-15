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
    defaultValue: 'wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net,wss://nos.lol,wss://nostr-pub.wellorder.net,wss://njump.me,wss://relay.primal.net',
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
    variable: 'show-npub',
    description: `Whether need to show the npub in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: 'Whether need to show the follow button in the profile badge or not\n\n<b style="background-color: orange; color: white; padding: 0 4px; border-radius: 4px">NOTE:</b> To show the follow button, you need to include the &lt;nostr-follow-button&gt; component from the CDN.\n\nInclude like this,\n&lt;script type="module" src="./dist/nostr-follow-button.js"&gt;&lt;/script&gt;',
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
  {
    variable: '--nstrc-profile-badge-nip05-color-light',
    description: 'Color of the NIP-05 text in light mode',
    defaultValue: '#808080',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-nip05-color-dark',
    description: 'Color of the NIP-05 text in dark mode',
    defaultValue: '#757575',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-skeleton-min-hsl-light',
    description: 'Minimum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 80%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-badge-skeleton-min-hsl-dark',
    description: 'Minimum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 20%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-badge-skeleton-max-hsl-light',
    description: 'Maximum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 95%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-badge-skeleton-max-hsl-dark',
    description: 'Maximum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 30%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-badge-copy-foreground-color-light',
    description: 'Foreground color of the copy icon in light mode',
    defaultValue: '#222',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-copy-foreground-color-dark',
    description: 'Foreground color of the copy icon in dark mode',
    defaultValue: '#CCC',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-badge-name-font-weight',
    description: 'Font weight of the profile name',
    defaultValue: '700',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-badge-nip05-font-weight',
    description: 'Font weight of the NIP-05 text',
    defaultValue: '400',
    control: 'text',
  },
];

const generateCode = (args, forCodeGen=false) => {
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
    console.log(args[cssVariable.variable])
    return args[cssVariable.variable] ? `${cssVariable.variable}: ${args[cssVariable.variable]} !important;`: ''
  })
  .filter(Boolean)
  .join('\n    ');

  const showFollow = args['show-follow'];

  let styles = '';

  if(cssVariables.length > 0) {
    styles += `<style>\n  :root {\n    ${cssVariables}\n  }\n</style>`;
  }

  const profileBadgeScript = `<script type="module" src="./dist/nostr-profile-badge.js"></script>`;
  const followButtonScript = `<script type="module" src="./dist/nostr-follow-button.js"></script>`;
  let component = '';

  // if(!forCodeGen) {
  //   component += '<div style="width: 350px">\n  ';
  // }

  component += `<div style="width: ${args.width ? `${args.width}px`: "300px"}">\n`;

  component += `<nostr-profile-badge\n  ${attributes}\n></nostr-profile-badge>`;

  component += '\n</div>';

  // if(!forCodeGen) {
  //   component += '\n</div>';
  // }

  return `${showFollow ? `${followButtonScript}\n`: ''}${profileBadgeScript}${styles ? `\n\n${styles}`: ''}\n\n${component}`.trim();
}


const argTypes: Partial<ArgTypes> = {}

PARAMETERS.forEach((parameter) => {
  argTypes[parameter.variable] = {
    description: parameter.description,
    type: parameter.control as any,
    table: {
      defaultValue: {
        summary: parameter.defaultValue
      }
    },

    control: parameter.control as any,
    options: parameter.options || [],
  }
})

CSS_VARIABLES.forEach((cssVariable) => {
  argTypes[cssVariable.variable] = {
    description: cssVariable.description,
    type: 'string',
    table: {
      category: 'CSS Variables',
      defaultValue: {
        summary: cssVariable.defaultValue
      }
    },
    control: {
      type: cssVariable.control as any,
    }
  }
})

const meta: Meta = {
  title: 'NostrProfileBadge',
  tags: ['autodocs'],
  render: (args) => generateCode(args),
  argTypes: argTypes,
  args: { onClick: fn() },
  parameters: {
    docs: {
      source: {
        transform: (code, storyContext) => generateCode(storyContext.args, true)
      },
      page: () => {
        return (
          <>
            <Title />
            <Subtitle />
            <Description />
            <Primary />
            <Controls />
          </>
        );
      }
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: 'Default',
  argTypes: {
    width: { contro: 'number' },
    npub: { control: 'text' },
  },
  args: {
    width: 300,
    npub: 'npub1rtlqca8r6auyaw5n5h3l5422dm4sry5dzfee4696fqe8s6qgudks7djtfs',
    theme: 'light',
  }
};
