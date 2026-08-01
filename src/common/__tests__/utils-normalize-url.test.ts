// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { normalizeURL } from '../utils';

describe('normalizeURL', () => {
  it('forces https and strips mobile subdomains', () => {
    expect(normalizeURL('http://m.example.com/a')).toBe('https://example.com/a');
    expect(normalizeURL('http://mobile.example.com/a')).toBe('https://example.com/a');
  });

  it('collapses default ports of the original scheme onto the https origin', () => {
    expect(normalizeURL('http://example.com:80/a')).toBe('https://example.com/a');
    expect(normalizeURL('https://example.com:443/a')).toBe('https://example.com/a');
  });

  it('keeps non-default ports, including :80 on an https origin', () => {
    expect(normalizeURL('https://example.com:8080/a')).toBe('https://example.com:8080/a');
    expect(normalizeURL('https://example.com:80/a')).toBe('https://example.com:80/a');
  });

  it('does not corrupt IPv6 literals', () => {
    expect(normalizeURL('http://[::1]:8080/a')).toBe('https://[::1]:8080/a');
    expect(normalizeURL('http://[::80]/a')).toBe('https://[::80]/a');
  });

  it('cleans duplicate and trailing slashes in the path', () => {
    expect(normalizeURL('https://example.com//a///b/')).toBe('https://example.com/a/b');
  });

  it('preserves the query string as part of the identity', () => {
    expect(normalizeURL('https://example.com/a?x=1&y=2')).toBe('https://example.com/a?x=1&y=2');
    expect(normalizeURL('https://example.com/a?x=1')).not.toBe(normalizeURL('https://example.com/a?x=2'));
  });

  it('returns the raw input for invalid URLs', () => {
    expect(normalizeURL('not a url')).toBe('not a url');
  });
});
