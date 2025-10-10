// SPDX-License-Identifier: MIT

/**
 * Common Theme Definitions
 * =======================
 * 
 * This file contains base theme definitions that are shared across all Nostr components.
 * Each theme defines generic CSS custom properties that can be mapped to component-specific variables.
 */

export const COMMON_THEMES = {
  'ocean-glass': {
    '--nostrc-theme-bg': 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(135deg, #0b486b, #f56217)',
    '--nostrc-theme-text-primary': '#e8fbff',
    '--nostrc-theme-text-secondary': '#e8fbff',
    '--nostrc-theme-border': '1px solid rgba(232,251,255,0.35)',
    '--nostrc-theme-hover-bg': 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.12)), linear-gradient(135deg, #0d5a7a, #f7752a)',
    '--nostrc-theme-hover-color': '#e8fbff',
    '--nostrc-theme-hover-border': '1px solid rgba(232,251,255,0.5)',
  },
  'holographic': {
    '--nostrc-theme-bg': 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 30%, #84fab0 60%, #8fd3f4 100%)',
    '--nostrc-theme-text-primary': '#1b2a2f',
    '--nostrc-theme-text-secondary': '#1b2a2f',
    '--nostrc-theme-border': '1px solid rgba(27,42,47,0.25)',
    '--nostrc-theme-hover-bg': 'linear-gradient(120deg, #f4ffa8 0%, #c8f8d0 30%, #b8fdd0 60%, #b8e8ff 100%)',
    '--nostrc-theme-hover-color': '#1b2a2f',
    '--nostrc-theme-hover-border': '1px solid rgba(27,42,47,0.4)',
  },
  'neo-matrix': {
    '--nostrc-theme-bg': '#061a12',
    '--nostrc-theme-text-primary': '#00ff88',
    '--nostrc-theme-text-secondary': '#00ff88',
    '--nostrc-theme-border': '2px solid #00ff66',
    '--nostrc-theme-hover-bg': 'rgba(0, 255, 136, 0.1)',
    '--nostrc-theme-hover-color': '#00ff88',
    '--nostrc-theme-hover-border': '2px solid #00ff66',
  },
  'bitcoin-orange': {
    '--nostrc-theme-bg': '#F7931A',
    '--nostrc-theme-text-primary': '#1a1a1a',
    '--nostrc-theme-text-secondary': '#1a1a1a',
    '--nostrc-theme-border': '1px solid #cc6f00',
    '--nostrc-theme-hover-bg': 'rgba(247, 147, 26, 0.8)',
    '--nostrc-theme-hover-color': '#1a1a1a',
    '--nostrc-theme-hover-border': '1px solid #b35900',
  },
};

/**
 * Theme mapping utilities
 * ======================
 * 
 * Helper functions to create component-specific theme mappings from common themes.
 */

export type ThemeName = keyof typeof COMMON_THEMES;

/**
 * Creates a theme mapping for a component by mapping common theme variables to component-specific variables.
 * 
 * @param componentPrefix - The CSS variable prefix for the component (e.g., 'nostrc-follow-btn')
 * @param themeName - The theme name to map
 * @returns Component-specific theme variables
 */
export function createComponentTheme(
  componentPrefix: string,
  themeName: ThemeName
): Record<string, string> {
  const commonTheme = COMMON_THEMES[themeName];
  
  return {
    [`--${componentPrefix}-bg`]: commonTheme['--nostrc-theme-bg'],
    [`--${componentPrefix}-color`]: commonTheme['--nostrc-theme-text-primary'],
    [`--${componentPrefix}-text-primary`]: commonTheme['--nostrc-theme-text-primary'],
    [`--${componentPrefix}-text-secondary`]: commonTheme['--nostrc-theme-text-secondary'],
    [`--${componentPrefix}-border`]: commonTheme['--nostrc-theme-border'],
    [`--${componentPrefix}-hover-bg`]: commonTheme['--nostrc-theme-hover-bg'],
    [`--${componentPrefix}-hover-color`]: commonTheme['--nostrc-theme-hover-color'],
    [`--${componentPrefix}-hover-border`]: commonTheme['--nostrc-theme-hover-border'],
  };
}

/**
 * Creates theme mappings for all themes for a specific component.
 * 
 * @param componentPrefix - The CSS variable prefix for the component
 * @returns Object with all theme mappings for the component
 */
export function createComponentThemes(componentPrefix: string) {
  const themes: Record<string, Record<string, string>> = {};
  
  for (const themeName of Object.keys(COMMON_THEMES) as ThemeName[]) {
    themes[themeName] = createComponentTheme(componentPrefix, themeName);
  }
  
  return themes;
}