import { PROFILE_BADGE_PARAMETERS as PARAMETERS } from './parameters';
import { PROFILE_BADGE_CSS_VARIABLES as CSS_VARIABLES } from './css-variables';
import { generateArgTypes } from '../common/utils';
import { generateCode as generateCodeShared, generateCodeWithScript as generateCodeWithScriptShared, generateDashboardHTML as generateDashboardHTMLShared, BUNDLE_SCRIPT, generateBundleScript, type CodeGeneratorConfig } from '../common/code-generator';

// Component-specific configuration
export const COMPONENT_CONFIG: CodeGeneratorConfig = {
  componentName: 'nostr-profile-badge',
  defaultWidth: 300,
  eventHandlers: ['onClick'],
  gridColumns: 'minmax(300px, 1fr)'
};

// Constants
export const DEFAULT_WIDTH = COMPONENT_CONFIG.defaultWidth;
export { BUNDLE_SCRIPT, generateBundleScript };

// Common function to generate argTypes for stories
export const getArgTypes = () => generateArgTypes(PARAMETERS, CSS_VARIABLES);

export const generateCode = (args: any, forCodeGen = false) => {
  return generateCodeShared({
    args,
    config: COMPONENT_CONFIG,
    cssVariables: CSS_VARIABLES,
    forCodeGen
  });
};

export const generateCodeWithScript = (args: any) => {
  return generateCodeWithScriptShared({
    args,
    config: COMPONENT_CONFIG,
    cssVariables: CSS_VARIABLES
  });
};

// Helper function to generate dashboard HTML from test cases
export const generateDashboardHTML = (testCases: any[], title: string, color: string) => {
  return generateDashboardHTMLShared({
    testCases,
    title,
    color,
    config: COMPONENT_CONFIG
  });
};