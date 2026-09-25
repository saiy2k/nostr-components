// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { buildReplyItem, formatReplyText } from '../reply-utils';

describe('reply-utils', () => {
  describe('formatReplyText', () => {
    it('returns empty string when input is empty or nullish', () => {
      expect(formatReplyText('')).toBe('');
      // @ts-expect-error testing runtime nullish input
      expect(formatReplyText(undefined)).toBe('');
      // @ts-expect-error testing runtime nullish input
      expect(formatReplyText(null)).toBe('');
    });

    it('returns plain text without modification', () => {
      expect(formatReplyText('Hello world!')).toBe('Hello world!');
    });

    it('escapes HTML special characters to prevent XSS injection', () => {
      expect(formatReplyText('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(formatReplyText('Tom & Jerry > Sylvester < Tweety')).toBe(
        'Tom &amp; Jerry &gt; Sylvester &lt; Tweety'
      );
      expect(formatReplyText(`It's "quoted"`)).toBe('It&#39;s &quot;quoted&quot;');
    });

    it('converts Unix newlines (\\n) to <br />', () => {
      expect(formatReplyText('line1\nline2')).toBe('line1<br />line2');
      expect(formatReplyText('line1\n\nline2')).toBe('line1<br /><br />line2');
    });

    it('converts Windows CRLF newlines (\\r\\n) to <br /> without trailing \\r', () => {
      expect(formatReplyText('line1\r\nline2')).toBe('line1<br />line2');
      expect(formatReplyText('line1\r\n\r\nline2')).toBe('line1<br /><br />line2');
    });

    it('converts lone carriage returns (\\r) to <br />', () => {
      expect(formatReplyText('line1\rline2')).toBe('line1<br />line2');
      expect(formatReplyText('line1\r\rline2')).toBe('line1<br /><br />line2');
    });

    it('handles mixed newlines correctly', () => {
      expect(formatReplyText('line1\r\nline2\nline3\rline4')).toBe(
        'line1<br />line2<br />line3<br />line4'
      );
    });
  });

  describe('buildReplyItem', () => {
    const defaultPubkey = 'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52';
    const mockReply = (overrides?: Partial<NDKEvent>): NDKEvent =>
      ({
        id: 'reply-event-id-1',
        pubkey: defaultPubkey,
        content: 'Replying to post\nwith details',
        ...overrides,
      } as unknown as NDKEvent);

    it('builds a reply item with full profile using displayName as primary name', () => {
      const reply = mockReply();
      const profile: NDKUserProfile = {
        displayName: 'Alice In Wonderland',
        name: 'alice',
        nip05: 'alice@example.com',
        picture: 'https://example.com/avatar.png',
      };

      const result = buildReplyItem(reply, profile);

      expect(result).toEqual({
        id: 'reply-event-id-1',
        authorKey: defaultPubkey,
        authorName: 'Alice In Wonderland',
        authorImage: 'https://example.com/avatar.png',
        contentHtml: 'Replying to post<br />with details',
      });
    });

    it('falls back to name when displayName is not provided', () => {
      const reply = mockReply();
      const profile: NDKUserProfile = {
        name: 'bob_builder',
        nip05: 'bob@example.com',
      };

      const result = buildReplyItem(reply, profile);

      expect(result.authorName).toBe('bob_builder');
    });

    it('falls back to nip05 when displayName and name are missing', () => {
      const reply = mockReply();
      const profile: NDKUserProfile = {
        nip05: 'charlie@example.com',
      };

      const result = buildReplyItem(reply, profile);

      expect(result.authorName).toBe('charlie@example.com');
    });

    it('falls back to author.npub when profile is null and npub is available', () => {
      const npub = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
      const reply = mockReply({
        author: { npub } as any,
      });

      const result = buildReplyItem(reply, null);

      expect(result.authorName).toBe(npub);
    });

    it('falls back to first 12 characters of pubkey when profile and npub are missing', () => {
      const reply = mockReply();

      const result = buildReplyItem(reply, undefined);

      expect(result.authorName).toBe(defaultPubkey.slice(0, 12));
    });

    it('filters invalid avatar URLs and keeps valid URLs', () => {
      const reply = mockReply();

      // Valid HTTPS
      expect(
        buildReplyItem(reply, { picture: 'https://example.com/pic.jpg' }).authorImage
      ).toBe('https://example.com/pic.jpg');

      // Valid HTTP
      expect(
        buildReplyItem(reply, { picture: 'http://example.com/pic.jpg' }).authorImage
      ).toBe('http://example.com/pic.jpg');

      // Invalid: javascript scheme
      expect(
        buildReplyItem(reply, { picture: 'javascript:alert(1)' }).authorImage
      ).toBe('');

      // Invalid: relative path
      expect(
        buildReplyItem(reply, { picture: '/images/avatar.png' }).authorImage
      ).toBe('');

      // Invalid: arbitrary string
      expect(
        buildReplyItem(reply, { picture: 'not-a-valid-url' }).authorImage
      ).toBe('');

      // Empty picture
      expect(
        buildReplyItem(reply, { picture: '' }).authorImage
      ).toBe('');
    });

    it('handles empty or missing content safely', () => {
      const reply = mockReply({ content: '' });

      const result = buildReplyItem(reply, null);

      expect(result.contentHtml).toBe('');
    });
  });
});
