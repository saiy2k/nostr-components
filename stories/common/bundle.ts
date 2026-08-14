// SPDX-License-Identifier: MIT

/**
 * Storybook bundle mode: local branch build vs published CDN.
 *
 * Set STORYBOOK_BUNDLE=cdn|local when running Storybook.
 * Default is local (this branch's dist via staticDirs).
 */

export const CDN_BASE =
  'https://cdn.jsdelivr.net/npm/nostr-components@latest/dist';

export type StorybookBundleMode = 'local' | 'cdn';

export function getStorybookBundleMode(): StorybookBundleMode {
  // Prefer Vite/Storybook import.meta.env; fall back to process.env for Vitest/scripts.
  const fromMeta = import.meta.env?.STORYBOOK_BUNDLE as string | undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env.STORYBOOK_BUNDLE : undefined;
  return (fromMeta || fromProcess) === 'cdn' ? 'cdn' : 'local';
}

/** Empty string for local (root-relative paths); CDN origin for cdn mode. */
export function getAssetBase(): string {
  return getStorybookBundleMode() === 'cdn' ? CDN_BASE : '';
}

/** Build an asset URL for themes / bundles under dist. */
export function assetUrl(assetPath: string): string {
  const clean = assetPath.replace(/^\//, '');
  const base = getAssetBase();
  return base ? `${base}/${clean}` : `/${clean}`;
}
