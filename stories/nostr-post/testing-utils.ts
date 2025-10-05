import type { ArgTypes, Meta } from '@storybook/web-components-vite';
import { DEFAULT_RELAYS } from '../../src/common/constants.ts';
import { POST_DATA, getAllInputTypes } from '../post-data.ts';

// Theme presets for CSS variable-based theming
export const THEME_PRESETS = {
  'Ocean Glass': {
    '--nostrc-post-bg': 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(135deg, #0b486b, #f56217)',
    '--nostrc-post-text-primary': '#e8fbff',
    '--nostrc-post-text-secondary': '#c8e6f0',
    '--nostrc-post-border': '1px solid rgba(232,251,255,0.35)',
    '--nostrc-post-accent': '#e8fbff',
  },
  'Holographic': {
    '--nostrc-post-bg': 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 30%, #84fab0 60%, #8fd3f4 100%)',
    '--nostrc-post-text-primary': '#1b2a2f',
    '--nostrc-post-text-secondary': '#2a3a3f',
    '--nostrc-post-border': '1px solid rgba(27,42,47,0.25)',
    '--nostrc-post-accent': '#1b2a2f',
  },
  'Neo Matrix': {
    '--nostrc-post-bg': '#061a12',
    '--nostrc-post-text-primary': '#00ff88',
    '--nostrc-post-text-secondary': '#00cc66',
    '--nostrc-post-border': '2px solid #00ff66',
    '--nostrc-post-accent': '#00ff88',
  },
  'Bitcoin Orange': {
    '--nostrc-post-bg': '#F7931A',
    '--nostrc-post-text-primary': '#1a1a1a',
    '--nostrc-post-text-secondary': '#333333',
    '--nostrc-post-border': '1px solid #cc6f00',
    '--nostrc-post-accent': '#1a1a1a',
  },
};

// Constants
export const DEFAULT_WIDTH = 600;
export const BUNDLE_SCRIPT = '<script type="module" src="/nostr-components.es.js"></script>';

export const PARAMETERS = [
  {
    variable: 'noteid',
    description: 'Valid raw Nostr ID or valid Bech32 note ID',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'hex',
    description: 'Valid hex format Nostr event ID',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'eventid',
    description: 'Valid event ID format (nevent)',
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
    variable: 'show-stats',
    description: `Whether need to show the stats of the post or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'onClick',
    description: `Function name to call when post is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'onAuthorClick',
    description: `Function name to call when author is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'onMentionClick',
    description: `Function name to call when mention is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
];

export const CSS_VARIABLES = [
  // Post-specific variables
  {
    variable: '--nostrc-post-bg',
    description: 'Post background color',
    defaultValue: 'var(--nostrc-theme-bg, var(--nostrc-color-background))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-text-primary',
    description: 'Post primary text color',
    defaultValue: 'var(--nostrc-theme-text-primary, var(--nostrc-color-text-primary))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-text-secondary',
    description: 'Post secondary text color',
    defaultValue: 'var(--nostrc-theme-text-secondary, var(--nostrc-color-text-secondary))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-border',
    description: 'Post border color',
    defaultValue: 'var(--nostrc-theme-border, var(--nostrc-color-border))',
    control: 'color',
  },
  {
    variable: '--nostrc-post-border-width',
    description: 'Post border width',
    defaultValue: 'var(--nostrc-theme-border-width, var(--nostrc-border-width))',
    control: 'text',
  },
  {
    variable: '--nostrc-post-accent',
    description: 'Post accent color (used for mentions, links, etc.)',
    defaultValue: 'var(--nostrc-color-accent)',
    control: 'color',
  },
];

export const generateCode = (args: any, forCodeGen = false) => {
  const { width, onClick, onAuthorClick, onMentionClick, wrapperDataTheme, ...otherArgs } = args;
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
  return `<nostr-post style="width: ${width}px;${cssVarsString}"${componentAttributes ? `\n  ${componentAttributes}` : ''}>
  </nostr-post>`.trim();
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
          <nostr-post ${attributes}></nostr-post>
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
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
  parameters: {
    docs: { disable: true },
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
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
