// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { hexToNpub, shortNpub } from '../../common/utils';
import { renderZapEntry, renderZapperEntry } from '../render-zap-entry';

describe('renderZapEntry', () => {
  it('renders zap comments as escaped plain text with preserved line breaks', () => {
    const html = renderZapEntry(
      {
        authorPubkey: 'f'.repeat(64),
        authorName: 'Alice',
        authorNpub: 'npub1invalid',
        authorPicture: 'javascript:alert(1)',
        amount: 21,
        comment: `<img src=x onerror="alert('xss')">\nhello`,
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
    );

    expect(html).toContain(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;<br />hello',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('src="javascript:alert(1)"');
  });

  it('escapes author names and author pubkey attributes', () => {
    const html = renderZapEntry(
      {
        authorPubkey: 'abc"<>def',
        authorName: '<script>alert(1)</script>',
        authorNpub: 'npub1invalid',
        authorPicture: '',
        amount: 21,
        comment: '',
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
    );

    expect(html).toContain('data-author-pubkey="abc&quot;&lt;&gt;def"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('shows the zap comment as safe text on a zappers list row', () => {
    const html = renderZapperEntry(
      {
        authorPubkey: 'ab'.repeat(32),
        amount: 21,
        comment: `<img src=x onerror="alert('xss')">\nthanks`,
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
    );

    expect(html).toContain(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;<br />thanks',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('class="zap-comment"');
  });

  it('falls back to a short npub when the profile has no name', () => {
    const pubkey = 'cd'.repeat(32);
    const html = renderZapperEntry(
      {
        authorPubkey: pubkey,
        amount: 11,
        comment: 'gm',
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
      { display_name: '  ', name: '' },
    );
    const full = hexToNpub(pubkey);
    const short = shortNpub(full);
    const linkText = html.match(/class="zap-author-link">\s*([^<]+?)\s*<\/a>/)?.[1];

    expect(linkText).toBe(short);
    expect(linkText).not.toBe(full);
    expect(short.length).toBeLessThan(full.length);
    expect(html).toContain('gm');
    expect(html).toContain('zap-author-picture-default');
  });

  it('uses the profile display name and https avatar', () => {
    const html = renderZapperEntry(
      {
        authorPubkey: 'ef'.repeat(32),
        amount: 21,
        comment: 'nice',
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
      {
        display_name: 'Sai',
        name: 'saiy2k',
        picture: 'https://cdn.example/a.png',
      },
    );

    expect(html).toContain('Sai');
    expect(html).not.toContain('saiy2k');
    expect(html).toContain('src="https://cdn.example/a.png"');
    expect(html).toContain('nice');
    expect(html).not.toContain('http://');
  });

  it('shows an anonymous zap without a profile link', () => {
    const html = renderZapEntry(
      {
        authorPubkey: null,
        amount: 21,
        comment: 'thanks',
        date: new Date('2024-01-01T00:00:00.000Z'),
      },
      0,
    );
    expect(html).toContain('Anonymous');
    expect(html).not.toContain('njump.me');
    expect(html).toContain('thanks');
  });
});
