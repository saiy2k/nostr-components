// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  computeWotScores,
  extractDirectoryInputs,
  extractTweetId,
  lightningAddressToLnurlp,
  normalizeTwitterHandle,
} from './relay-directory-crawler.mjs';

const PUBKEY = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
const NPUB = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg';

describe('normalizeTwitterHandle', () => {
  it('normalizes handles and X/Twitter profile URLs', () => {
    expect(normalizeTwitterHandle('@Jack')).toBe('jack');
    expect(normalizeTwitterHandle('https://x.com/Bebop2077_')).toBe('bebop2077_');
    expect(normalizeTwitterHandle('https://twitter.com/alice/status/123')).toBe('alice');
  });

  it('rejects invalid handles', () => {
    expect(normalizeTwitterHandle('this-has-dashes')).toBeNull();
    expect(normalizeTwitterHandle('waytoolongtwitterhandle')).toBeNull();
    expect(normalizeTwitterHandle('https://x.com/i/communities/1747149501561778581')).toBeNull();
  });
});

describe('extractTweetId', () => {
  it('extracts a numeric tweet id from URLs or raw ids', () => {
    expect(extractTweetId('2064733905014440088')).toBe('2064733905014440088');
    expect(extractTweetId('https://x.com/alice/status/2064733905014440088?s=20')).toBe(
      '2064733905014440088'
    );
    expect(extractTweetId('AldenCo18783')).toBeNull();
  });
});

describe('extractDirectoryInputs', () => {
  it('extracts verifiable NIP-39 candidates and claimed-only leads', () => {
    const { candidates, claimed, metadataByPubkey } = extractDirectoryInputs([
      {
        id: 'evt1',
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1,
        content: '',
        tags: [['i', 'twitter:Alice', 'https://x.com/Alice/status/2064733905014440088']],
      },
      {
        id: 'evt2',
        kind: 0,
        pubkey: PUBKEY,
        created_at: 2,
        content: JSON.stringify({
          name: 'Alice',
          lud16: 'alice@getalby.com',
          about: 'X: https://x.com/alice',
        }),
        tags: [],
      },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        handle: 'alice',
        npub: NPUB,
        proofTweetId: '2064733905014440088',
        sourceKind: 10011,
      }),
    ]);
    expect(claimed).toEqual([
      expect.objectContaining({
        handle: 'alice',
        identityStatus: 'claimed',
        source: 'kind0.about',
      }),
    ]);
    expect(metadataByPubkey.get(PUBKEY).lud16).toBe('alice@getalby.com');
  });
});

describe('lightningAddressToLnurlp', () => {
  it('converts lud16 to a LNURL-pay metadata endpoint', () => {
    expect(lightningAddressToLnurlp('alice@getalby.com')).toBe(
      'https://getalby.com/.well-known/lnurlp/alice'
    );
  });
});

describe('computeWotScores', () => {
  it('adds ranking signals without changing identity status or auto-zap policy', () => {
    const claimed = {
      handle: 'alice',
      pubkey: PUBKEY,
      identityStatus: 'claimed',
      autoZapAllowed: false,
    };

    const scored = computeWotScores([claimed], [
      {
        id: 'follow',
        kind: 3,
        pubkey: '1111111111111111111111111111111111111111111111111111111111111111',
        created_at: 1,
        content: '',
        tags: [['p', PUBKEY]],
        sig: 'invalid-for-test',
      },
    ]);

    expect(scored[0].identityStatus).toBe('claimed');
    expect(scored[0].autoZapAllowed).toBe(false);
    expect(scored[0].wot.note).toContain('not identity proof');
  });
});
