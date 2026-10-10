import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CDN_COMPONENT_BUNDLE,
  previewComponentScript,
} from '../../.storybook/preview-script';
import {
  BUNDLE_SCRIPT,
  CDN_BASE,
  generateBundleScript,
} from './code-generator';

const previewHead = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../.storybook/preview-head.html'),
  'utf8'
);

describe('Storybook CDN bundle scripts', () => {
  it('points at the latest published jsDelivr package assets', () => {
    expect(CDN_BASE).toBe(
      'https://cdn.jsdelivr.net/npm/nostr-components@latest/dist'
    );
    expect(BUNDLE_SCRIPT).toBe(
      `<script type="module" src="${CDN_BASE}/nostr-components.es.js"></script>`
    );
    expect(generateBundleScript('nostr-zap-button')).toBe(
      `<script type="module" src="${CDN_BASE}/components/nostr-zap-button.es.js"></script>`
    );
  });

  it('uses workspace source locally and jsDelivr for the hosted build', () => {
    expect(previewComponentScript(undefined)).toBe('/src/index.ts');
    expect(previewComponentScript('production')).toBe(CDN_COMPONENT_BUNDLE);
  });

  it('keeps preview themes on jsDelivr and leaves the component script to main.ts', () => {
    expect(previewHead).toContain(
      `href="${CDN_BASE}/themes.css"`
    );
    expect(previewHead).not.toContain('src="/src/index.ts"');
    expect(previewHead).not.toContain(
      `src="${CDN_BASE}/nostr-components.es.js"`
    );
  });

  it('does not reference local dist paths', () => {
    expect(BUNDLE_SCRIPT).not.toMatch(/src="\/nostr-components/);
    expect(generateBundleScript('nostr-profile')).not.toMatch(
      /src="\/components\//
    );
    expect(previewHead).not.toMatch(/href="\/themes\.css"/);
    expect(previewHead).not.toMatch(/src="\/nostr-components\.es\.js"/);
  });
});
