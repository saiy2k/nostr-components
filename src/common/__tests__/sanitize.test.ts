// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { sanitizeHttpUrl, sanitizeMultilineText } from '../sanitize';

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
