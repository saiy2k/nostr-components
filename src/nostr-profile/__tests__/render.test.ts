// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { renderProfile } from '../render';

describe('renderProfile', () => {
  it('escapes malicious display names and error strings', () => {
    const html = renderProfile({
      isLoading: false,
      isError: false,
      errorMessage: '',
      npub: 'npub1test',
      userProfile: {
        displayName: '<img src=x onerror=alert(1)>',
        name: '',
        nip05: 'alice@example.com',
        picture: 'https://example.com/avatar.png',
        about: 'Hello',
        website: 'https://example.com',
        banner: 'https://example.com/banner.png',
      },
      isStatsLoading: false,
      isStatsFollowersLoading: false,
      isStatsFollowsLoading: false,
      isZapsLoading: false,
      stats: {
        notes: 1,
        replies: 2,
        follows: 3,
        followers: 4,
        zaps: 5,
        relays: 0,
      },
      showFollow: false,
      showNpub: false,
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');

    const errorHtml = renderProfile({
      isLoading: false,
      isError: true,
      errorMessage: '<script>alert(1)</script>',
      npub: '',
      userProfile: {} as any,
      isStatsLoading: false,
      isStatsFollowersLoading: false,
      isStatsFollowsLoading: false,
      isZapsLoading: false,
      stats: {
        notes: 0,
        replies: 0,
        follows: 0,
        followers: 0,
        zaps: 0,
        relays: 0,
      },
      showFollow: false,
      showNpub: false,
    });

    expect(errorHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(errorHtml).not.toContain('<script>alert(1)</script>');
  });

  it('omits invalid banner, avatar, and website URLs from the output', () => {
    const html = renderProfile({
      isLoading: false,
      isError: false,
      errorMessage: '',
      npub: 'npub1test',
      userProfile: {
        displayName: 'Alice',
        name: 'Alice',
        nip05: 'alice@example.com',
        picture: 'javascript:alert(1)',
        about: 'Hello',
        website: 'javascript:alert(1)',
        banner: 'data:text/html,boom',
      },
      isStatsLoading: false,
      isStatsFollowersLoading: false,
      isStatsFollowsLoading: false,
      isZapsLoading: false,
      stats: {
        notes: 0,
        replies: 0,
        follows: 0,
        followers: 0,
        zaps: 0,
        relays: 0,
      },
      showFollow: false,
      showNpub: false,
    });

    expect(html).toContain('banner-placeholder');
    expect(html).toContain('avatar-placeholder');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('src="javascript:alert(1)"');
    expect(html).not.toContain('src="data:text/html,boom"');
  });

  it('renders valid https website links', () => {
    const html = renderProfile({
      isLoading: false,
      isError: false,
      errorMessage: '',
      npub: 'npub1test',
      userProfile: {
        displayName: 'Alice',
        name: 'Alice',
        nip05: 'alice@example.com',
        picture: 'https://example.com/avatar.png',
        about: 'Hello',
        website: 'https://example.com',
        banner: 'https://example.com/banner.png',
      },
      isStatsLoading: false,
      isStatsFollowersLoading: false,
      isStatsFollowsLoading: false,
      isZapsLoading: false,
      stats: {
        notes: 0,
        replies: 0,
        follows: 0,
        followers: 0,
        zaps: 0,
        relays: 0,
      },
      showFollow: false,
      showNpub: false,
    });

    expect(html).toContain('href="https://example.com/"');
  });
});
