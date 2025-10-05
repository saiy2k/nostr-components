import type { ArgTypes, Meta } from '@storybook/web-components-vite';
import { DEFAULT_RELAYS } from '../../src/common/constants.ts';

// Constants
export const DEFAULT_WIDTH = 300;
export const BUNDLE_SCRIPT = '<script type="module" src="/nostr-components.es.js"></script>';

export const PARAMETERS = [
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
    variable: 'show-npub',
    description: `Whether need to show the npub in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: `Whether need to show the follow button in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
];

export const CSS_VARIABLES = [
  {
    variable: '--nostrc-profile-badge-bg',
    description: 'Background color of the profile badge',
    defaultValue: 'var(--nostrc-color-background)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-text-primary',
    description: 'Primary text color (name)',
    defaultValue: 'var(--nostrc-color-text-primary)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-text-secondary',
    description: 'Secondary text color (nip05, npub)',
    defaultValue: 'var(--nostrc-color-text-secondary)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-border',
    description: 'Border color of the profile badge',
    defaultValue: 'var(--nostrc-color-border)',
    control: 'color',
  },
  {
    variable: '--nostrc-profile-badge-border-width',
    description: 'Border width of the profile badge',
    defaultValue: 'var(--nostrc-border-width)',
    control: 'text',
  },
];

// Special theme presets for Storybook controls
export const THEME_PRESETS = {
  'Ocean Glass': {
    '--nostrc-profile-badge-bg': 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(135deg, #0b486b, #f56217)',
    '--nostrc-profile-badge-text-primary': '#e8fbff',
    '--nostrc-profile-badge-text-secondary': '#bfeaf4',
    '--nostrc-profile-badge-border': 'rgba(232,251,255,0.35)',
  },
  'Holographic': {
    '--nostrc-profile-badge-bg': 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 30%, #84fab0 60%, #8fd3f4 100%)',
    '--nostrc-profile-badge-text-primary': '#1b2a2f',
    '--nostrc-profile-badge-text-secondary': '#38535a',
    '--nostrc-profile-badge-border': 'rgba(27,42,47,0.25)',
  },
  'Neo Matrix': {
    '--nostrc-profile-badge-bg': '#061a12',
    '--nostrc-profile-badge-text-primary': '#00ff88',
    '--nostrc-profile-badge-text-secondary': '#33ffaa',
    '--nostrc-profile-badge-border': '#00ff66',
    '--nostrc-profile-badge-border-width': '2px',
  },
  'Bitcoin Orange': {
    '--nostrc-profile-badge-bg': '#F7931A',
    '--nostrc-profile-badge-text-primary': '#1a1a1a',
    '--nostrc-profile-badge-text-secondary': '#333333',
    '--nostrc-profile-badge-border': '#cc6f00',
  },
};

export const generateCode = (args: any, forCodeGen = false) => {
  const { width, onClick, ...otherArgs } = args;
  const cssVars = CSS_VARIABLES.map(cssVar => {
    const value = args[cssVar.variable];
    return value ? `${cssVar.variable}: ${value};` : '';
  }).filter(Boolean);

  const cssVarsString = cssVars.length > 0 ? `\n  ${cssVars.join('\n  ')}` : '';

  const attributes = Object.entries(otherArgs)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return value ? key : '';
      }
      return `${key}="${value}"`;
    })
    .filter(Boolean)
    .join('\n  ');
  
  // For Storybook's "Show Code" feature, we want clean HTML without the bundle script
  // The bundle script should only be included in actual usage examples
  return `<nostr-profile-badge style="width: ${width}px;${cssVarsString}"${attributes ? `\n  ${attributes}` : ''}>
</nostr-profile-badge>`.trim();
};

export const generateCodeWithScript = (args: any) => {
  const cleanCode = generateCode(args);
  return `${BUNDLE_SCRIPT}\n\n${cleanCode}`;
};

export const generateArgTypes = (): Partial<ArgTypes> => {
  const argTypes: Partial<ArgTypes> = {};
  
  PARAMETERS.forEach(param => {
    argTypes[param.variable] = {
      description: param.description,
      defaultValue: param.defaultValue,
      control: param.control as any,
    };
  });

  CSS_VARIABLES.forEach(cssVariable => {
    argTypes[cssVariable.variable] = {
      description: cssVariable.description,
      defaultValue: cssVariable.defaultValue,
      control: cssVariable.control as any,
    };
  });

  return argTypes;
};

// Helper function to generate dashboard HTML from test cases
export const generateDashboardHTML = (testCases: any[], title: string, color: string) => {
  const testCaseHTML = testCases.map(testCase => {
    const attributes = Object.entries(testCase.args)
      .filter(([key, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return value ? key : '';
        }
        return `${key}="${value}"`;
      })
      .filter(Boolean)
      .join(' ');

    return `
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${color};">
          <h4 style="margin: 0 0 10px 0; color: ${color};">${testCase.name}</h4>
          <nostr-profile-badge ${attributes}></nostr-profile-badge>
        </div>`;
  }).join('');

  return `
    <div style="padding: 20px; background: #f5f5f5;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: ${color};">${title}</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Test cases showing component behavior</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        ${testCaseHTML}
      </div>
    </div>`;
};

export const createTestingMeta = (title: string, tags: string[]) => ({
  title,
  tags: ['test', ...tags],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: { disable: true },
    test: {
      enabled: true,
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
});
