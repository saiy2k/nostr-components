// SPDX-License-Identifier: MIT

/** Published bundle. The hosted Storybook build loads this. */
export const CDN_COMPONENT_BUNDLE =
  'https://cdn.jsdelivr.net/npm/nostr-components@latest/dist/nostr-components.es.js';

/** Local `storybook dev` loads workspace source. `storybook build` keeps jsDelivr. */
export function previewComponentScript(env = process.env.STORYBOOK_ENV): string {
  return env === 'production' ? CDN_COMPONENT_BUNDLE : '/src/index.ts';
}
