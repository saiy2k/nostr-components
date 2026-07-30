// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  sanitizeHttpUrl,
  sanitizeMultilineText,
  sanitizePostInlineFragment,
} from '../sanitize';
import {
  createProfileMentionToken,
  renderPostInlineText,
} from '../../nostr-post/inline-fragment';

describe('sanitizeHttpUrl', () => {
  it('accepts valid https and http URLs', () => {
    expect(sanitizeHttpUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(sanitizeHttpUrl('http://example.com/path')).toBe(
      'http://example.com/path',
    );
  });

  it('rejects javascript, data, malformed, and empty URLs', () => {
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(
      '',
    );
    expect(sanitizeHttpUrl('not a real url')).toBe('');
    expect(sanitizeHttpUrl('')).toBe('');
    expect(sanitizeHttpUrl(null)).toBe('');
    expect(sanitizeHttpUrl(undefined)).toBe('');
  });

  it('returns attribute-safe escaped output', () => {
    expect(sanitizeHttpUrl('https://example.com/search?q="zap"&next=1')).toBe(
      'https://example.com/search?q=%22zap%22&amp;next=1',
    );
  });
});

describe('sanitizeMultilineText', () => {
  it('escapes HTML special characters and preserves line breaks', () => {
    expect(
      sanitizeMultilineText(`<img src=x onerror="alert('xss')">\nnext`),
    ).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;<br />next',
    );
  });
});

describe('sanitizePostInlineFragment', () => {
  it('preserves trusted mention markup in non-browser environments', () => {
    const trusted =
      '<a href="https://njump.me/npub1test" target="_blank" rel="noopener noreferrer">@Alice</a> ' +
      '<span class="nostr-mention" data-username="bob">@bob</span>';

    expect(sanitizePostInlineFragment(trusted)).toBe(trusted);
  });
});

describe('renderPostInlineText', () => {
  it('escapes script payloads and preserves line breaks', () => {
    const html = renderPostInlineText(
      `<script>alert(1)</script>\nhello`,
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br />hello');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders profile mentions when display names contain parentheses', () => {
    const token = createProfileMentionToken(
      'https://njump.me/npub1test',
      'Alice (work)',
    );
    const html = renderPostInlineText(`${token} hi`);

    expect(html).toContain(
      '<a href="https://njump.me/npub1test" target="_blank" rel="noopener noreferrer">@Alice (work)</a>',
    );
    expect(html).not.toContain('__NOSTRC_PROFILE_MENTION__');
  });
});
