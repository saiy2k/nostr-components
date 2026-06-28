// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import {
  buildProofText,
  buildTweetIntentUrl,
  extractTweetId,
  buildIdentityTag,
  mergeIdentityTag,
} from '../verify-utils';

describe('buildProofText', () => {
  it('embeds the npub in the canonical NIP-39 twitter proof text', () => {
    const npub = 'npub1w0umll2y078jl6c5cdkvrtzc0wxtn2d0vm2dp6kd7l6hfxze82lst8wdzu';
    const text = buildProofText(npub);
    expect(text).toContain(npub);
    expect(text).toContain('Verifying my account on nostr');
  });
});

describe('buildTweetIntentUrl', () => {
  it('URL-encodes the proof text into an X intent link', () => {
    const url = buildTweetIntentUrl('npub1abc');
    expect(url.startsWith('https://twitter.com/intent/tweet?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent('npub1abc'));
  });
});

describe('extractTweetId', () => {
  it('accepts a bare numeric id', () => {
    expect(extractTweetId('1946594057863450689')).toBe('1946594057863450689');
  });

  it('extracts the id from a twitter.com status URL', () => {
    expect(extractTweetId('https://twitter.com/Bebop2077_/status/1946594057863450689')).toBe(
      '1946594057863450689'
    );
  });

  it('extracts the id from an x.com URL with query params', () => {
    expect(extractTweetId('https://x.com/jack/status/123456789012345?s=20')).toBe(
      '123456789012345'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(extractTweetId('  987654321098765  ')).toBe('987654321098765');
  });

  it('returns null for non-tweet input', () => {
    expect(extractTweetId('not a url')).toBeNull();
    expect(extractTweetId('https://example.com/foo')).toBeNull();
    expect(extractTweetId('')).toBeNull();
  });
});

describe('buildIdentityTag', () => {
  it('builds a NIP-39 i tag with a lowercased handle', () => {
    expect(buildIdentityTag('twitter', 'Bebop2077_', '1946594057863450689')).toEqual([
      'i',
      'twitter:bebop2077_',
      '1946594057863450689',
    ]);
  });
});

describe('mergeIdentityTag', () => {
  it('appends when no matching identity exists', () => {
    const existing = [['name', 'x'], ['i', 'github:alice', 'gist123']];
    const tag = buildIdentityTag('twitter', 'alice', 'tweet1');
    const merged = mergeIdentityTag(existing, tag);
    expect(merged).toContainEqual(['i', 'github:alice', 'gist123']);
    expect(merged).toContainEqual(['i', 'twitter:alice', 'tweet1']);
    expect(merged).toContainEqual(['name', 'x']);
  });

  it('replaces an existing claim for the same platform:handle (dedup)', () => {
    const existing = [['i', 'twitter:alice', 'oldTweet']];
    const tag = buildIdentityTag('twitter', 'Alice', 'newTweet');
    const merged = mergeIdentityTag(existing, tag);
    const twitterTags = merged.filter((t) => t[0] === 'i' && t[1] === 'twitter:alice');
    expect(twitterTags).toHaveLength(1);
    expect(twitterTags[0][2]).toBe('newTweet');
  });

  it('preserves unrelated tags and other-platform identities', () => {
    const existing = [
      ['i', 'twitter:alice', 'oldTweet'],
      ['i', 'github:alice', 'gist123'],
      ['client', 'nostr-components'],
    ];
    const merged = mergeIdentityTag(existing, buildIdentityTag('twitter', 'alice', 'newTweet'));
    expect(merged).toContainEqual(['i', 'github:alice', 'gist123']);
    expect(merged).toContainEqual(['client', 'nostr-components']);
    expect(merged.filter((t) => t[1] === 'twitter:alice')).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const existing = [['i', 'twitter:alice', 'oldTweet']];
    const copy = JSON.parse(JSON.stringify(existing));
    mergeIdentityTag(existing, buildIdentityTag('twitter', 'alice', 'newTweet'));
    expect(existing).toEqual(copy);
  });
});
