import { describe, expect, it } from 'vitest';
import {
  BUNDLE_SCRIPT,
  CDN_BASE,
  generateBundleScript,
} from './code-generator';

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

  it('does not reference local dist paths', () => {
    expect(BUNDLE_SCRIPT).not.toMatch(/src="\/nostr-components/);
    expect(generateBundleScript('nostr-profile')).not.toMatch(
      /src="\/components\//
    );
  });
});
