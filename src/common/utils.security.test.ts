// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeUrl } from './utils';
import { renderFollowButton } from '../nostr-follow-button/render';
import { renderDm } from '../nostr-dm/render';

describe('sanitizeUrl', () => {
  it('allows normal https media URLs', () => {
    expect(sanitizeUrl('https://cdn.example.com/photo.jpg?a=1&b=2')).toBe(
      'https://cdn.example.com/photo.jpg?a=1&amp;b=2'
    );
  });

  it('rejects javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('neutralizes attribute-breakout payloads', () => {
    const payload = 'https://example.com/?q=" onerror="alert(1)';
    const safe = sanitizeUrl(payload);

    expect(safe).not.toContain('" onerror="');
    expect(safe).toContain('%22');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML metacharacters in text nodes', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});

describe('profile banner fallback logic', () => {
  it('treats invalid banner URLs as absent so placeholders can render', () => {
    const invalidBanners = ['javascript:alert(1)', 'not-a-url', '   '];

    for (const banner of invalidBanners) {
      const sanitizedBanner = banner ? sanitizeUrl(banner) : '';
      expect(sanitizedBanner).toBe('');
    }
  });
});

describe('renderFollowButton', () => {
  it('does not render javascript: avatar sources', () => {
    const html = renderFollowButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      isFollowed: false,
      isFollowing: false,
      showAvatar: true,
      user: { npub: 'npub1test' } as any,
      profile: { image: 'javascript:alert(1)', name: 'Alice' } as any,
    });

    expect(html).not.toContain('javascript:alert(1)');
  });
});

describe('renderDm', () => {
  it('escapes recipient metadata and message content', () => {
    const html = renderDm({
      theme: 'light',
      recipientNpub: 'npub1test',
      recipientName: '<img src=x onerror=alert(1)>',
      recipientPicture: 'javascript:alert(1)',
      message: '</textarea><script>alert(1)</script>',
      isLoading: false,
      isFinding: false,
      isError: true,
      errorMessage: '<b>xss</b>',
      isSent: false,
    });

    expect(html).not.toContain('javascript:alert(1)');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('</textarea><script>');
    expect(html).toContain('&lt;b&gt;xss&lt;/b&gt;');
  });
});
