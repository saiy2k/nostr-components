// SPDX-License-Identifier: MIT

export function getProfileBadgeCSSVars(): string {
  return `
    /* === PROFILE BADGE CSS VARIABLES === */
    --nostrc-profile-badge-background-light: var(--nstrc-profile-badge-background-light, var(--nostrc-color-background-light));
    --nostrc-profile-badge-background-dark: var(--nstrc-profile-badge-background-dark, var(--nostrc-color-background-dark));
    --nostrc-profile-badge-name-color-light: var(--nstrc-profile-badge-name-color-light, var(--nostrc-color-text-primary-light));
    --nostrc-profile-badge-name-color-dark: var(--nstrc-profile-badge-name-color-dark, var(--nostrc-color-text-primary-dark));
    --nostrc-profile-badge-text-secondary-light: var(--nstrc-profile-badge-text-secondary-light, var(--nostrc-color-text-secondary-light));
    --nostrc-profile-badge-text-secondary-dark: var(--nstrc-profile-badge-text-secondary-dark, var(--nostrc-color-text-secondary-dark));
  `;
}

export function getThemeAwareProfileBadgeVars(theme: 'light' | 'dark'): string {
  return `
    /* === THEME-AWARE PROFILE BADGE VARIABLES === */
    --nostrc-profile-badge-background: var(--nostrc-profile-badge-background-${theme}, var(--nostrc-color-background-${theme}));
    --nostrc-profile-badge-name-color: var(--nostrc-profile-badge-name-color-${theme}, var(--nostrc-color-text-primary-${theme}));
    --nostrc-profile-badge-text-secondary: var(--nostrc-profile-badge-text-secondary-${theme}, var(--nostrc-color-text-secondary-${theme}));
  `;
}
