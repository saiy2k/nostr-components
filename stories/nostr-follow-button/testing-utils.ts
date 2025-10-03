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
    variable: 'theme',
    description: `Color theme of the component. Only supports two values - light and dark`,
    defaultValue: 'light',
    control: 'select',
    options: ['light', 'dark'],
  },
];

export const CSS_VARIABLES = [
  {
    variable: '--nostrc-icon-height',
    description: 'Height of the icon in the follow button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-icon-width',
    description: 'Width of the icon in the follow button',
    defaultValue: '25px',
    control: 'text',
  },
  {
    variable: '--nostrc-spacing-md',
    description: 'Medium spacing for gaps between elements',
    defaultValue: '12px',
    control: 'text',
  },
];

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
  return `<div style="width: ${width}px;${cssVarsString}">
  <nostr-follow-button${attributes ? `\n    ${attributes}` : ''}>
  </nostr-follow-button>
</div>`.trim();
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
          <nostr-follow-button ${attributes}></nostr-follow-button>
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
        element: 'nostr-follow-button',
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
