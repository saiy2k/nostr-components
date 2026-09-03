import { describe, expect, it } from 'vitest';
import {
  buildCleanPathMaps,
  cleanPathToStorybookPath,
  entryToCleanPath,
  hasStorybookPathParam,
  isStaticPath,
  parseStorybookPath,
  resolveCleanPath,
  rewriteUrlToClean,
  rewriteUrlToStorybook,
  sanitize,
  storybookPathToCleanPath,
} from './clean-urls';

const entries = [
  { id: 'nostr-components--docs', title: 'Nostr Components', name: 'Docs', type: 'docs' },
  { id: 'zap-button--docs', title: 'Zap Button', name: 'Docs', type: 'docs' },
  { id: 'zap-button--nip05', title: 'Zap Button', name: 'Nip05', type: 'story' },
  {
    id: 'zap-button-styling--ocean-glass-theme',
    title: 'Zap Button/Styling',
    name: 'Ocean Glass Theme',
    type: 'story',
  },
];

describe('clean Storybook URLs', () => {
  it('slugifies and maps entries to hierarchical paths', () => {
    expect(sanitize('URL-Based Zap')).toBe('url-based-zap');
    expect(entryToCleanPath(entries[1])).toBe('/zap-button');
    expect(entryToCleanPath(entries[0])).toBe('/');
    expect(entryToCleanPath(entries[2])).toBe('/zap-button/nip05');
    expect(entryToCleanPath(entries[3])).toBe('/zap-button/styling/ocean-glass-theme');
  });

  it('round-trips issue #108 URL examples', () => {
    expect(cleanPathToStorybookPath('/zap-button')).toEqual({
      viewMode: 'docs',
      storyId: 'zap-button--docs',
    });
    expect(cleanPathToStorybookPath('/zap-button/nip-05')).toEqual({
      viewMode: 'story',
      storyId: 'zap-button--nip-05',
    });
    expect(cleanPathToStorybookPath('/zap-button/styling/ocean-glass')).toEqual({
      viewMode: 'story',
      storyId: 'zap-button-styling--ocean-glass',
    });
    expect(cleanPathToStorybookPath('/')).toEqual({
      viewMode: 'docs',
      storyId: 'nostr-components--docs',
    });
    expect(cleanPathToStorybookPath('/images/logo.png')).toBeNull();
    expect(cleanPathToStorybookPath('/iframe')).toBeNull();
    expect(rewriteUrlToClean('/?path=/')).toBe('/');
    expect(rewriteUrlToClean('/?path=/docs/nostr-components--docs')).toBe('/');

    const { idToClean, cleanToSb } = buildCleanPathMaps(entries);
    expect(idToClean.get('zap-button-styling--ocean-glass-theme')).toBe(
      '/zap-button/styling/ocean-glass-theme'
    );
    expect(resolveCleanPath('/', cleanToSb)?.storyId).toBe('nostr-components--docs');
    expect(storybookPathToCleanPath('/docs/zap-button--docs', idToClean)).toBe('/zap-button');
    expect(parseStorybookPath('/docs/zap-button--docs')?.storyId).toBe('zap-button--docs');
  });

  it('rewrites full URLs both ways', () => {
    expect(rewriteUrlToClean('/?path=/docs/zap-button--docs&args=text:Hi')).toBe(
      '/zap-button?args=text:Hi'
    );
    expect(rewriteUrlToClean('/?path=/story/zap-button--url-based-zap')).toBe(
      '/zap-button/url-based-zap'
    );
    expect(rewriteUrlToStorybook('/zap-button/styling/ocean-glass')).toBe(
      '/?path=/story/zap-button-styling--ocean-glass'
    );
    expect(rewriteUrlToStorybook('/zap-button')).toBe('/?path=/docs/zap-button--docs');
  });

  it('handles CodeRabbit edge cases', () => {
    expect(hasStorybookPathParam('?basepath=/x')).toBe(false);
    expect(hasStorybookPathParam('?path=/docs/zap-button--docs')).toBe(true);
    expect(isStaticPath('/nostr-components')).toBe(false);
    expect(isStaticPath('/nunito-sans')).toBe(true);
    expect(cleanPathToStorybookPath('/nostr-components')).toEqual({
      viewMode: 'docs',
      storyId: 'nostr-components--docs',
    });
    expect(rewriteUrlToStorybook('/nostr-components')).toBe(
      '/?path=/docs/nostr-components--docs'
    );
    // Decoded "&" in args must not become a new query delimiter.
    expect(
      rewriteUrlToClean('/?path=/docs/zap-button--docs&args=text:a%26b')
    ).toBe('/zap-button?args=text:a%26b');
    // Single-pass iterables still get intro aliases.
    function* once() {
      yield entries[0];
      yield entries[1];
    }
    const { cleanToSb } = buildCleanPathMaps(once());
    expect(cleanToSb.get('/')?.storyId).toBe('nostr-components--docs');
    // Hydrated maps are authoritative: unknown paths must not invent story IDs.
    expect(resolveCleanPath('/unknown-page', cleanToSb)).toBeNull();
    expect(rewriteUrlToStorybook('/unknown-page', cleanToSb)).toBeNull();
    expect(resolveCleanPath('/unknown-page')).toEqual({
      viewMode: 'docs',
      storyId: 'unknown-page--docs',
    });
    expect(resolveCleanPath('/unknown-page', new Map())).toEqual({
      viewMode: 'docs',
      storyId: 'unknown-page--docs',
    });
    expect(resolveCleanPath('/zap-button', cleanToSb)?.storyId).toBe('zap-button--docs');
  });
});
