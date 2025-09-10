// SPDX-License-Identifier: MIT

import { Theme } from './types';

/**
 * Centralized Design Token System for Nostr Components
 * ===================================================
 * 
 * This file contains all the common design tokens used across components.
 * Developers can override these tokens globally or per-component to customize
 * the appearance of all Nostr components.
 * 
 * Usage:
 * 1. Import and use in component styles: import { getDesignTokens } from '../common/design-tokens'
 * 2. Override tokens globally: Set CSS custom properties on :root or specific components
 * 3. Component-specific overrides: Set tokens on individual component hosts
 */

export interface DesignTokens {
  // === COLORS ===
  colors: {
    // Background colors
    background: {
      light: string;
      dark: string;
    };
    // Text colors
    text: {
      primary: { light: string; dark: string };
      secondary: { light: string; dark: string };
      muted: { light: string; dark: string };
    };
    // Border colors
    border: {
      light: string;
      dark: string;
    };
    // Error colors
    error: {
      background: string;
      text: string;
      icon: string;
    };
    // Accent colors
    accent: string;
  };
  
  // === TYPOGRAPHY ===
  typography: {
    fontFamily: {
      primary: string;
      mono: string;
    };
    fontSize: {
      base: string;
      small: string;
      large: string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      bold: number;
    };
  };
  
  // === SPACING ===
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  
  // === BORDERS ===
  borders: {
    radius: {
      sm: string;
      md: string;
      lg: string;
      full: string;
    };
    width: string;
  };
  
  // === SKELETON LOADING ===
  skeleton: {
    colors: {
      light: { min: string; max: string };
      dark: { min: string; max: string };
    };
    animation: {
      duration: string;
      timing: string;
    };
  };
  
  // === TRANSITIONS ===
  transitions: {
    duration: string;
    timing: string;
  };
}

/**
 * Default design tokens for Nostr Components
 */
export const defaultDesignTokens: DesignTokens = {
  colors: {
    background: {
      light: '#ffffff',
      dark: '#1a1a1a',
    },
    text: {
      primary: {
        light: '#111111',
        dark: '#ffffff',
      },
      secondary: {
        light: '#444444',
        dark: '#ffffff',
      },
      muted: {
        light: '#808080',
        dark: '#a0a0a0',
      },
    },
    border: {
      light: '#e0e0e0',
      dark: '#333333',
    },
    error: {
      background: '#ffebee',
      text: '#d32f2f',
      icon: '#d32f2f',
    },
    accent: '#ca077c',
  },
  
  typography: {
    fontFamily: {
      primary: 'Inter, sans-serif',
      mono: 'monospace',
    },
    fontSize: {
      base: '1em',
      small: '0.8em',
      large: '1.2em',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 700,
    },
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  
  borders: {
    radius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      full: '50%',
    },
    width: '1px',
  },
  
  skeleton: {
    colors: {
      light: {
        min: '#f0f0f0',
        max: '#e0e0e0',
      },
      dark: {
        min: '#333333',
        max: '#2a2a2a',
      },
    },
    animation: {
      duration: '1.5s',
      timing: 'infinite',
    },
  },
  
  transitions: {
    duration: '0.2s',
    timing: 'ease',
  },
};

/**
 * Generates CSS custom properties for design tokens
 * This creates the CSS variables that components can use
 */
export function generateDesignTokenCSS(theme: Theme, tokens: DesignTokens = defaultDesignTokens): string {
  const { colors, typography, spacing, borders, skeleton, transitions } = tokens;
  
  return `
    /* === DESIGN TOKENS === */
    --nostrc-color-background-light: ${colors.background.light};
    --nostrc-color-background-dark: ${colors.background.dark};
    --nostrc-color-background: var(--nostrc-color-background-${theme});
    
    --nostrc-color-text-primary-light: ${colors.text.primary.light};
    --nostrc-color-text-primary-dark: ${colors.text.primary.dark};
    --nostrc-color-text-primary: var(--nostrc-color-text-primary-${theme});
    
    --nostrc-color-text-secondary-light: ${colors.text.secondary.light};
    --nostrc-color-text-secondary-dark: ${colors.text.secondary.dark};
    --nostrc-color-text-secondary: var(--nostrc-color-text-secondary-${theme});
    
    --nostrc-color-text-muted-light: ${colors.text.muted.light};
    --nostrc-color-text-muted-dark: ${colors.text.muted.dark};
    --nostrc-color-text-muted: var(--nostrc-color-text-muted-${theme});
    
    --nostrc-color-border-light: ${colors.border.light};
    --nostrc-color-border-dark: ${colors.border.dark};
    --nostrc-color-border: var(--nostrc-color-border-${theme});
    
    --nostrc-color-error-background: ${colors.error.background};
    --nostrc-color-error-text: ${colors.error.text};
    --nostrc-color-error-icon: ${colors.error.icon};
    
    --nostrc-color-accent: ${colors.accent};
    
    /* === TYPOGRAPHY === */
    --nostrc-font-family-primary: ${typography.fontFamily.primary};
    --nostrc-font-family-mono: ${typography.fontFamily.mono};
    --nostrc-font-size-base: ${typography.fontSize.base};
    --nostrc-font-size-small: ${typography.fontSize.small};
    --nostrc-font-size-large: ${typography.fontSize.large};
    --nostrc-font-weight-normal: ${typography.fontWeight.normal};
    --nostrc-font-weight-medium: ${typography.fontWeight.medium};
    --nostrc-font-weight-bold: ${typography.fontWeight.bold};
    
    /* === SPACING === */
    --nostrc-spacing-xs: ${spacing.xs};
    --nostrc-spacing-sm: ${spacing.sm};
    --nostrc-spacing-md: ${spacing.md};
    --nostrc-spacing-lg: ${spacing.lg};
    --nostrc-spacing-xl: ${spacing.xl};
    
    /* === BORDERS === */
    --nostrc-border-radius-sm: ${borders.radius.sm};
    --nostrc-border-radius-md: ${borders.radius.md};
    --nostrc-border-radius-lg: ${borders.radius.lg};
    --nostrc-border-radius-full: ${borders.radius.full};
    --nostrc-border-width: ${borders.width};
    
    /* === SKELETON === */
    --nostrc-skeleton-color-min-light: ${skeleton.colors.light.min};
    --nostrc-skeleton-color-max-light: ${skeleton.colors.light.max};
    --nostrc-skeleton-color-min-dark: ${skeleton.colors.dark.min};
    --nostrc-skeleton-color-max-dark: ${skeleton.colors.dark.max};
    --nostrc-skeleton-color-min: var(--nostrc-skeleton-color-min-${theme});
    --nostrc-skeleton-color-max: var(--nostrc-skeleton-color-max-${theme});
    --nostrc-skeleton-duration: ${skeleton.animation.duration};
    --nostrc-skeleton-timing: ${skeleton.animation.timing};
    
    /* === TRANSITIONS === */
    --nostrc-transition-duration: ${transitions.duration};
    --nostrc-transition-timing: ${transitions.timing};
  `;
}

/**
 * Common utility functions for generating component-specific styles
 */
export const styleUtils = {
  /**
   * Generates hover state styles
   */
  hover: (property: string, lightValue: string) => `
    &:hover {
      ${property}: var(--nostrc-color-hover-${property}, ${lightValue});
    }
  `,
  
  /**
   * Generates error state styles
   */
  error: () => `
    &.is-error {
      color: var(--nostrc-color-error-text);
    }
  `,
  
  /**
   * Generates skeleton loading styles
   */
  skeleton: () => `
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--nostrc-skeleton-color-min) 0%,
        var(--nostrc-skeleton-color-max) 50%,
        var(--nostrc-skeleton-color-min) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-loading var(--nostrc-skeleton-duration) var(--nostrc-skeleton-timing);
      border-radius: var(--nostrc-border-radius-sm);
    }
    
    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `,
  
  /**
   * Generates copy button styles
   */
  copyButton: () => `
    .copy-button {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      font-size: 1.5em;
      border: none;
      background: var(--nostrc-color-background);
      color: var(--nostrc-color-text-muted);
    }
    
    .copy-button:hover {
      opacity: 1;
    }
    
    .copy-button.copied {
      color: var(--nostrc-color-accent);
    }
  `,
  
  /**
   * Generates error icon styles
   */
  errorIcon: () => `
    .error-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-background);
      color: var(--nostrc-color-error-icon);
      font-size: 2em;
    }
  `,
};
