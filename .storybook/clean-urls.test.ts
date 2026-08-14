import { describe, expect, it } from 'vitest';
import {
  buildCleanPathMaps,
  cleanPathToStorybookPath,
  entryToCleanPath,
  parseStorybookPath,
  resolveCleanPath,
  rewriteUrlToClean,
  rewriteUrlToStorybook,
  sanitize,
  storybookPathToCleanPath,
  titleToPathSegments,
} from './clean-urls';

describe('sanitize', () => {
  it('slugifies titles like Storybook CSF', () => {
    expect(sanitize('Zap Button')).toBe('zap-button');
    expect(sanitize('URL-Based Zap')).toBe('url-based-zap');
    expect(sanitize('Ocean Glass Theme')).toBe('ocean-glass-theme');
  });
});

describe('entryToCleanPath', () => {
  it('maps component docs to a single segment', () => {
    expect(
      entryToCleanPath({
        id: 'zap-button--docs',
        title: 'Zap Button',
        name: 'Docs',
        type: 'docs',
      })
    ).toBe('/zap-button');
  });

  it('maps intro docs to root', () => {
    expect(
      entryToCleanPath({
        id: 'nostr-components--docs',
        title: 'Nostr Components',
        name: 'Docs',
        type: 'docs',
      })
    ).toBe('/');
  });

  it('maps nested stories to hierarchical paths', () => {
    expect(
      entryToCleanPath({
        id: 'zap-button--nip05',
        title: 'Zap Button',
        name: 'Nip05',
        type: 'story',
      })
    ).toBe('/zap-button/nip05');

    expect(
      entryToCleanPath({
        id: 'zap-button--url-based-zap',
        title: 'Zap Button',
        name: 'URL-Based Zap',
        type: 'story',
      })
    ).toBe('/zap-button/url-based-zap');

    expect(
      entryToCleanPath({
        id: 'zap-button-styling--ocean-glass-theme',
        title: 'Zap Button/Styling',
        name: 'Ocean Glass Theme',
        type: 'story',
      })
    ).toBe('/zap-button/styling/ocean-glass-theme');
  });
});

describe('cleanPathToStorybookPath', () => {
  it('maps the issue examples to Storybook paths', () => {
    expect(cleanPathToStorybookPath('/zap-button')).toEqual({
      viewMode: 'docs',
      storyId: 'zap-button--docs',
    });
    expect(cleanPathToStorybookPath('/zap-button/nip-05')).toEqual({
      viewMode: 'story',
      storyId: 'zap-button--nip-05',
    });
    expect(cleanPathToStorybookPath('/zap-button/url-based-zap')).toEqual({
      viewMode: 'story',
      storyId: 'zap-button--url-based-zap',
    });
    expect(cleanPathToStorybookPath('/zap-button/styling/ocean-glass')).toEqual({
      viewMode: 'story',
      storyId: 'zap-button-styling--ocean-glass',
    });
  });

  it('ignores static asset paths', () => {
    expect(cleanPathToStorybookPath('/images/logo.png')).toBeNull();
    expect(cleanPathToStorybookPath('/index.json')).toBeNull();
    expect(cleanPathToStorybookPath('/sb-addons/foo.js')).toBeNull();
    expect(cleanPathToStorybookPath('/iframe.html')).toBeNull();
    expect(cleanPathToStorybookPath('/iframe')).toBeNull();
  });
});

describe('buildCleanPathMaps + resolve', () => {
  const entries = [
    {
      id: 'nostr-components--docs',
      title: 'Nostr Components',
      name: 'Docs',
      type: 'docs' as const,
    },
    {
      id: 'zap-button--docs',
      title: 'Zap Button',
      name: 'Docs',
      type: 'docs' as const,
    },
    {
      id: 'zap-button--nip05',
      title: 'Zap Button',
      name: 'Nip05',
      type: 'story' as const,
    },
    {
      id: 'zap-button-styling--ocean-glass-theme',
      title: 'Zap Button/Styling',
      name: 'Ocean Glass Theme',
      type: 'story' as const,
    },
  ];

  it('round-trips clean paths through the story index', () => {
    const { idToClean, cleanToStorybook } = buildCleanPathMaps(entries);

    expect(idToClean.get('zap-button--docs')).toBe('/zap-button');
    expect(idToClean.get('zap-button-styling--ocean-glass-theme')).toBe(
      '/zap-button/styling/ocean-glass-theme'
    );
    expect(cleanToStorybook.get('/zap-button')).toEqual({
      viewMode: 'docs',
      storyId: 'zap-button--docs',
    });
    expect(resolveCleanPath('/zap-button/nip05', cleanToStorybook)).toEqual({
      viewMode: 'story',
      storyId: 'zap-button--nip05',
    });
    expect(resolveCleanPath('/', cleanToStorybook)).toEqual({
      viewMode: 'docs',
      storyId: 'nostr-components--docs',
    });
  });

  it('converts storybook path queries to clean paths via the map', () => {
    const { idToClean } = buildCleanPathMaps(entries);
    expect(storybookPathToCleanPath('/docs/zap-button--docs', idToClean)).toBe(
      '/zap-button'
    );
    expect(
      storybookPathToCleanPath(
        '/story/zap-button-styling--ocean-glass-theme',
        idToClean
      )
    ).toBe('/zap-button/styling/ocean-glass-theme');
  });
});

describe('URL rewrite helpers', () => {
  it('rewrites ?path= URLs to clean pathnames and preserves args', () => {
    expect(
      rewriteUrlToClean('/?path=/docs/zap-button--docs&args=text:Hi')
    ).toBe('/zap-button?args=text:Hi');
    expect(
      rewriteUrlToClean('/?path=/story/zap-button--url-based-zap')
    ).toBe('/zap-button/url-based-zap');
  });

  it('rewrites clean pathnames back to Storybook query URLs', () => {
    expect(rewriteUrlToStorybook('/zap-button/styling/ocean-glass')).toBe(
      '/?path=/story/zap-button-styling--ocean-glass'
    );
    expect(rewriteUrlToStorybook('/zap-button')).toBe(
      '/?path=/docs/zap-button--docs'
    );
  });

  it('parses storybook path queries', () => {
    expect(parseStorybookPath('/docs/zap-button--docs')).toEqual({
      viewMode: 'docs',
      storyId: 'zap-button--docs',
    });
    expect(titleToPathSegments('Zap Button/Styling')).toEqual([
      'zap-button',
      'styling',
    ]);
  });
});
