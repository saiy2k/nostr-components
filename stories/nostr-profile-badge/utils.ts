import { PROFILE_BADGE_PARAMETERS as PARAMETERS } from './parameters';
import { PROFILE_BADGE_CSS_VARIABLES as CSS_VARIABLES } from './css-variables';
import { generateArgTypes } from '../common/utils';

// Constants
export const DEFAULT_WIDTH = 300;
export const BUNDLE_SCRIPT = '<script type="module" src="/nostr-components.es.js"></script>';

// Common function to generate argTypes for stories
export const getArgTypes = () => generateArgTypes(PARAMETERS, CSS_VARIABLES);

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
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        ${testCaseHTML}
      </div>
    </div>`;
};