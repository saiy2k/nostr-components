import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CDN_BASE } from './bundle';

const previewHead = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../.storybook/preview-head.html'),
  'utf8'
);

describe('Storybook bundle scripts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('exposes the jsDelivr CDN_BASE constant', () => {
    expect(CDN_BASE).toBe(
      'https://cdn.jsdelivr.net/npm/nostr-components@latest/dist'
    );
  });

  it('defaults to local dist paths when STORYBOOK_BUNDLE is unset', async () => {
    const { getBundleScript, generateBundleScript } = await import('./code-generator');
    expect(getBundleScript()).toBe(
      '<script type="module" src="/nostr-components.es.js"></script>'
    );
    expect(generateBundleScript('nostr-zap-button')).toBe(
      '<script type="module" src="/components/nostr-zap-button.es.js"></script>'
    );
  });

  it('uses CDN URLs when STORYBOOK_BUNDLE=cdn', async () => {
    vi.stubEnv('STORYBOOK_BUNDLE', 'cdn');
    const { getBundleScript, generateBundleScript } = await import('./code-generator');
    expect(getBundleScript()).toBe(
      `<script type="module" src="${CDN_BASE}/nostr-components.es.js"></script>`
    );
    expect(generateBundleScript('nostr-profile')).toBe(
      `<script type="module" src="${CDN_BASE}/components/nostr-profile.es.js"></script>`
    );
  });

  it('preview-head defers themes/bundle loading to preview.ts', () => {
    expect(previewHead).toContain('STORYBOOK_BUNDLE');
    expect(previewHead).not.toMatch(/href="\/themes\.css"/);
    expect(previewHead).not.toMatch(/src="\/nostr-components\.es\.js"/);
    expect(previewHead).not.toContain(`${CDN_BASE}/themes.css`);
    expect(previewHead).not.toContain(`${CDN_BASE}/nostr-components.es.js`);
  });
});
