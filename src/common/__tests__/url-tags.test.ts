// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it } from 'vitest';
import { likeFilterUrls, pageUrlSpellings, zapTagUrl } from '../url-tags';

const VIDEO = 'https://m.youtube.com/watch?v=abcdefghijk';

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
});

describe('page URL spellings', () => {
  it('keeps the canonical URL and both older spellings of a mobile YouTube link', () => {
    expect(pageUrlSpellings(VIDEO)).toEqual([
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://m.youtube.com/watch?v=abcdefghijk',
      'https://youtube.com/watch?v=abcdefghijk',
    ]);
  });

  it('publishes the canonical zap tag and filters every spelling', () => {
    expect(zapTagUrl(VIDEO)).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(likeFilterUrls(VIDEO)).toEqual(pageUrlSpellings(VIDEO));
  });

  it('keeps a single older spelling while a transport is installed', () => {
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: () => Promise.resolve([]),
        publish: () => Promise.resolve(),
      },
    });
    expect(likeFilterUrls(VIDEO)).toEqual([VIDEO]);
    expect(zapTagUrl('https://m.example.com/a')).toBe('https://example.com/a');
  });
});
