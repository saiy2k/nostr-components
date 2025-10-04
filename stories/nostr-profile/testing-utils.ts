import type { ArgTypes, Meta } from '@storybook/web-components-vite';
import { DEFAULT_RELAYS } from '../../src/common/constants.ts';

// Constants
export const DEFAULT_WIDTH = 600;
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
    description: `Whether need to show the npub in the profile or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: `Whether need to show the follow button in the profile or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
];

export const CSS_VARIABLES = [
  {
    variable: '--nstrc-profile-background-light',
    description: 'Background color for light theme',
    defaultValue: '#F5F5F5',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-background-dark',
    description: 'Background color for dark theme',
    defaultValue: '#000000',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-skeleton-min-hsl-light',
    description: 'Minimum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 80%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-skeleton-min-hsl-dark',
    description: 'Minimum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 20%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-skeleton-max-hsl-light',
    description: 'Maximum CSS HSL value of the skeleton loader in light mode',
    defaultValue: '200, 20%, 95%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-skeleton-max-hsl-dark',
    description: 'Maximum CSS HSL value of the skeleton loader in dark mode',
    defaultValue: '200, 20%, 30%',
    control: 'text',
  },
  {
    variable: '--nstrc-profile-text-primary-light',
    description: 'Primary text color in light mode',
    defaultValue: '#111111',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-text-primary-dark',
    description: 'Primary text color in dark mode',
    defaultValue: '#FFFFFF',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-text-grey-light',
    description: 'Secondary grey text color in light mode',
    defaultValue: '#808080',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-text-grey-dark',
    description: 'Secondary grey text color in dark mode',
    defaultValue: '#666666',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-banner-placeholder-color-light',
    description: 'Banner placeholder color when no image is specified (light mode)',
    defaultValue: '#E5E5E5',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-banner-placeholder-color-dark',
    description: 'Banner placeholder color when no image is specified (dark mode)',
    defaultValue: '#222222',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-copy-foreground-color-light',
    description: 'Foreground color of the copy icon in light mode',
    defaultValue: '#222222',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-copy-foreground-color-dark',
    description: 'Foreground color of the copy icon in dark mode',
    defaultValue: '#CCCCCC',
    control: 'color',
  },
  {
    variable: '--nstrc-profile-accent',
    description: 'Accent color. Used for links, verify tick mark, etc.,',
    defaultValue: '#CA077C',
    control: 'color',
  },
];

export const generateCode = (args: any, forCodeGen = false) => {
  const { width, onClick, wrapperDataTheme, ...otherArgs } = args;
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

  // Handle data-theme attribute on component itself
  let componentAttributes = attributes;
  if (wrapperDataTheme) {
    componentAttributes = `${attributes ? `${attributes}\n    ` : ''}data-theme="${wrapperDataTheme}"`;
  }

  // For Storybook's "Show Code" feature, we want clean HTML without the bundle script
  // The bundle script should only be included in actual usage examples
  return `<nostr-profile style="width: ${width}px;${cssVarsString}"${componentAttributes ? `\n  ${componentAttributes}` : ''}>
  </nostr-profile>`.trim();
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
          <nostr-profile ${attributes}></nostr-profile>
        </div>`;
  }).join('');

  return `
    <div style="padding: 20px; background: #f5f5f5;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: ${color};">${title}</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Test cases showing component behavior</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(600px, 1fr)); gap: 20px;">
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
        element: 'nostr-profile',
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
