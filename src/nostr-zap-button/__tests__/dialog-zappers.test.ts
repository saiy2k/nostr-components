// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { renderZapEntry } from '../render-zap-entry';

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
    expect(html).not.toContain('<img src=x onerror="alert(\'xss\')">');
    expect(html).not.toContain('src="javascript:alert(1)"');
  });
});
