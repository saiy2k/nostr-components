#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Theme configurations
const THEMES = {
  light: {
    '--nostrc-theme-bg': '#ffffff',
    '--nostrc-theme-text-primary': '#333333',
    '--nostrc-theme-text-secondary': '#666666',
    '--nostrc-theme-border': '#e0e0e0',
    '--nostrc-theme-hover-bg': 'rgba(0, 0, 0, 0.05)'
  },
  dark: {
    '--nostrc-theme-bg': '#1a1a1a',
    '--nostrc-theme-text-primary': '#cccccc',
    '--nostrc-theme-text-secondary': '#999999',
    '--nostrc-theme-border': '#333333',
    '--nostrc-theme-hover-bg': '#333333'
  }
};

async function buildThemes() {
  console.log('🎨 Building theme CSS files...');

  // Ensure dist/themes directory exists
  const distDir = path.join(__dirname, '..', 'dist');
  const themesDir = path.join(distDir, 'themes');
  
  try {
    await fs.mkdir(themesDir, { recursive: true });
  } catch (error) {
    console.error('Error creating themes directory:', error);
    process.exit(1);
  }

  // Build each theme CSS file
  for (const [themeName, variables] of Object.entries(THEMES)) {
    const cssContent = `/* SPDX-License-Identifier: MIT */

/* ${themeName.charAt(0).toUpperCase() + themeName.slice(1)} Theme for Nostr Components */
:root {
${Object.entries(variables)
  .map(([property, value]) => `  ${property}: ${value};`)
  .join('\n')}
}`;

    const themeFile = path.join(themesDir, `${themeName}.css`);
    
    try {
      await fs.writeFile(themeFile, cssContent, 'utf8');
      console.log(`✅ Generated ${themeName}.css`);
    } catch (error) {
      console.error(`Error writing ${themeFile}:`, error);
      process.exit(1);
    }
  }

  // Build the unified themes.css file with data-attribute classes
  const generateThemeCSS = (themeName, themeVars) => {
    const capitalizedName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    const variablesCSS = Object.entries(themeVars)
      .map(([property, value]) => `  ${property}: ${value};`)
      .join('\n');
    
    return `/* ${capitalizedName} Theme */
[data-theme="${themeName}"],
:host([data-theme="${themeName}"]) {
${variablesCSS}
}

.theme-${themeName} {
${variablesCSS}
}`;
  };

  const themesCSSContent = `/* SPDX-License-Identifier: MIT */

/*
 * Nostr Components Theme Classes
 * ==============================
 * 
 * Apply themes to individual components using data-theme attributes:
 * 
 * <div data-theme="dark">
 *   <nostr-profile-badge npub="npub123..."></nostr-profile-badge>
 * </div>
 * 
 * <div data-theme="ocean-glass">
 *   <nostr-follow-button pubkey="pk456..."></nostr-follow-button>
 * </div>
 */

${Object.entries(THEMES)
  .map(([themeName, themeVars]) => generateThemeCSS(themeName, themeVars))
  .join('\n\n')}
`;

  const themesCSSFile = path.join(distDir, 'themes.css');
  
  try {
    await fs.writeFile(themesCSSFile, themesCSSContent, 'utf8');
    console.log('✅ Generated themes.css');
  } catch (error) {
    console.error('Error writing themes.css:', error);
    process.exit(1);
  }

  // Also copy to storybook-static for development
  const storybookThemeDir = path.join(__dirname, '..', 'storybook-static', 'themes');
  
  try {
    await fs.mkdir(storybookThemeDir, { recursive: true });
  } catch (error) {
    // Storybook dir might not exist yet, that's ok
  }

  // Copy theme files to storybook directory
  for (const themeName of Object.keys(THEMES)) {
    const sourceThemeFile = path.join(themesDir, `${themeName}.css`);
    const storybookThemeFile = path.join(storybookThemeDir, `${themeName}.css`);
    
    try {
      await fs.copyFile(sourceThemeFile, storybookThemeFile);
      console.log(`📋 Copied ${themeName}.css to storybook-static`);
    } catch (error) {
      console.log(`⚠️  Could not copy to storybook-static (this is ok for initial runs)`);
    }
  }

  console.log(`\n🎉 Theme build complete! Generated ${Object.keys(THEMES).length} theme files.`);
  console.log('📂 Output directory: dist/themes/');
  console.log('\n📖 Usage:');
  Object.keys(THEMES).forEach(themeName => {
    console.log(`  <link rel="stylesheet" href="dist/themes/${themeName}.css">`);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildThemes().catch(error => {
    console.error('Theme build failed:', error);
    process.exit(1);
  });
}

export { buildThemes };
