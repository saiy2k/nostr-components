// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, verifiedSymbol } from 'nostr-tools';
import {
  getBolt11AmountMsats,
  lnurlFromProfileContent,
  validateZapReceipt,
  type ZapProviderInfo,
} from '../zap-receipt';
import {
  BOLT11_20U,
  BOLT11_20U_AMOUNT_MSATS as BOLT11_AMOUNT_MSATS,
} from './fixtures';

const RECIPIENT_SK = generateSecretKey();
const RECIPIENT_PK = getPublicKey(RECIPIENT_SK);
const PROVIDER_SK = generateSecretKey();
const PROVIDER_PK = getPublicKey(PROVIDER_SK);
const SENDER_SK = generateSecretKey();

const PROVIDER: ZapProviderInfo = {
  lnurl: 'https://ln.example/.well-known/lnurlp/alice',
  callback: 'https://ln.example/callback',
  nostrPubkey: PROVIDER_PK,
};
const EXPECTED_URL = 'https://x.com/alice/status/42';
const EXPECTED_A_TAG = `39735:${RECIPIENT_PK}:${EXPECTED_URL}`;

function makeZapRequest(
  amountMsats = BOLT11_AMOUNT_MSATS,
  extraTags: string[][] = [],
) {
  return finalizeEvent(
    {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      content: 'thanks',
      tags: [
        ['p', RECIPIENT_PK],
        ['amount', String(amountMsats)],
        ['relays', 'wss://relay.example'],
        ...extraTags,
      ],
    },
    SENDER_SK,
  );
}

function makeValidReceipt(
  amountMsats = BOLT11_AMOUNT_MSATS,
  mutateTags?: (tags: string[][]) => string[][],
  requestExtraTags: string[][] = [],
) {
  const zapRequest = makeZapRequest(amountMsats, requestExtraTags);
  const baseTags: string[][] = [
    ['p', RECIPIENT_PK],
    ['P', zapRequest.pubkey],
    ['bolt11', BOLT11_20U],
    ['description', JSON.stringify(zapRequest)],
    ...requestExtraTags.filter(([name]) => name === 'a'),
  ];
  return finalizeEvent(
    {
      kind: 9735,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: mutateTags ? mutateTags(baseTags) : baseTags,
    },
    PROVIDER_SK,
  );
}

describe('lnurlFromProfileContent', () => {
  it('resolves lud16 to an https lnurlp URL', () => {
    expect(
      lnurlFromProfileContent(JSON.stringify({ lud16: 'alice@ln.example' })),
    ).toBe('https://ln.example/.well-known/lnurlp/alice');
  });

  it('rejects non-https lud06 URLs', async () => {
    const { bech32 } = await import('@scure/base');
    const words = bech32.toWords(new TextEncoder().encode('http://ln.example/lnurlp'));
    const lud06 = bech32.encode('lnurl', words, 1000);
    expect(lnurlFromProfileContent(JSON.stringify({ lud06 }))).toBeNull();
  });

  it('returns null without lud06/lud16', () => {
    expect(lnurlFromProfileContent('{}')).toBeNull();
  });
});

describe('getBolt11AmountMsats', () => {
  it('decodes invoice amount in millisatoshis', () => {
    expect(getBolt11AmountMsats(BOLT11_20U)).toBe(BOLT11_AMOUNT_MSATS);
  });
});

describe('validateZapReceipt', () => {
  it('accepts a receipt that satisfies NIP-57 Appendix F checks', () => {
    const receipt = makeValidReceipt();
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountMsats).toBe(BOLT11_AMOUNT_MSATS);
      expect(result.zapRequest.pubkey).toBe(getPublicKey(SENDER_SK));
    }
  });

  it('rejects receipts not signed by the LNURL nostrPubkey', () => {
    const zapRequest = makeZapRequest();
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify(zapRequest)],
        ],
      },
      SENDER_SK,
    );

    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('receipt-pubkey-mismatch');
  });

  it('rejects when zap request amount does not match bolt11 amount', () => {
    const receipt = makeValidReceipt(999_000);
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('amount-mismatch');
  });

  it('rejects a receipt whose tags were tampered with after signing', () => {
    const receipt = makeValidReceipt();
    receipt.tags = receipt.tags.filter(([t]) => t !== 'description');
    // finalizeEvent marks events with verifiedSymbol; strip it so verifyEvent
    // actually recomputes the hash, as it would for an event read from a relay.
    delete (receipt as any)[verifiedSymbol];
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('receipt-sig');
  });

  it('rejects missing description', () => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
      tags.filter(([t]) => t !== 'description'),
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing-description');
  });

  it('rejects a missing receipt p tag', () => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
      tags.filter(([name]) => name !== 'p'),
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: 'receipt-p-mismatch' });
  });

  it.each([
    ['p', 'duplicate-receipt-p'],
    ['description', 'duplicate-description'],
    ['bolt11', 'duplicate-bolt11'],
  ])('rejects duplicate receipt %s tags', (name, reason) => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) => {
      const duplicate = tags.find(([tagName]) => tagName === name)!;
      return [...tags, [...duplicate]];
    });
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason });
  });

  it('rejects duplicate embedded zap-request p tags', () => {
    const receipt = makeValidReceipt(
      BOLT11_AMOUNT_MSATS,
      undefined,
      [['p', RECIPIENT_PK]],
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'duplicate-zap-request-p',
    });
  });

  it('rejects invalid description JSON', () => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
      tags.map((tag) => (tag[0] === 'description' ? ['description', '{not-json'] : tag)),
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.reason === 'description-json' ||
          result.reason.startsWith('invalid-zap-request:'),
      ).toBe(true);
    }
  });

  it('rejects zap-request p mismatch', () => {
    const wrongP = finalizeEvent(
      {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'thanks',
        tags: [
          ['p', getPublicKey(generateSecretKey())],
          ['amount', String(BOLT11_AMOUNT_MSATS)],
          ['relays', 'wss://relay.example'],
        ],
      },
      SENDER_SK,
    );
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify(wrongP)],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('zap-request-p-mismatch');
  });

  it('rejects an embedded request that is not kind 9734', () => {
    const notAZapRequest = finalizeEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: 'thanks',
        tags: [
          ['p', RECIPIENT_PK],
          ['amount', String(BOLT11_AMOUNT_MSATS)],
          ['relays', 'wss://relay.example'],
        ],
      },
      SENDER_SK,
    );
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify(notAZapRequest)],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('zap-request-kind');
  });

  it('rejects missing bolt11', () => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
      tags.filter(([t]) => t !== 'bolt11'),
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing-bolt11');
  });

  it('requires the exact invoice when validating payment completion', () => {
    const result = validateZapReceipt(makeValidReceipt(), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
      expectedBolt11: 'lnbc1different',
    });
    expect(result).toEqual({ ok: false, reason: 'bolt11-mismatch' });
  });

  it('rejects invalid bolt11 amount', () => {
    const receipt = makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
      tags.map((tag) => (tag[0] === 'bolt11' ? ['bolt11', 'not-a-bolt11'] : tag)),
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-bolt11-amount');
  });

  it('rejects lnurl mismatch when present', () => {
    const zapRequest = finalizeEvent(
      {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'thanks',
        tags: [
          ['p', RECIPIENT_PK],
          ['amount', String(BOLT11_AMOUNT_MSATS)],
          ['relays', 'wss://relay.example'],
          ['lnurl', 'https://other.example/.well-known/lnurlp/bob'],
        ],
      },
      SENDER_SK,
    );
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify(zapRequest)],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('lnurl-mismatch');
  });

  it('accepts a bech32-encoded lnurl tag that decodes to the provider LNURL', async () => {
    const { bech32 } = await import('@scure/base');
    const words = bech32.toWords(new TextEncoder().encode(PROVIDER.lnurl));
    const lnurlTag = bech32.encode('lnurl', words, 1000);

    const zapRequest = finalizeEvent(
      {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'thanks',
        tags: [
          ['p', RECIPIENT_PK],
          ['amount', String(BOLT11_AMOUNT_MSATS)],
          ['relays', 'wss://relay.example'],
          ['lnurl', lnurlTag],
        ],
      },
      SENDER_SK,
    );
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify(zapRequest)],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(true);
  });

  it('cryptographically binds URL zaps to matching receipt and request a tags', () => {
    const result = validateZapReceipt(
      makeValidReceipt(
        BOLT11_AMOUNT_MSATS,
        undefined,
        [['a', EXPECTED_A_TAG]],
      ),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
        expectedATag: EXPECTED_A_TAG,
      },
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ['missing receipt a', (tags: string[][]) =>
      tags.filter(([name]) => name !== 'a'), [['a', EXPECTED_A_TAG]]],
    ['missing request a', (tags: string[][]) =>
      [...tags, ['a', EXPECTED_A_TAG]], []],
    ['mismatched a', undefined, [[
      'a',
      `39735:${RECIPIENT_PK}:https://x.com/alice/status/99`,
    ]]],
    ['duplicate a', undefined, [
      ['a', EXPECTED_A_TAG],
      ['a', EXPECTED_A_TAG],
    ]],
  ])('rejects URL attribution with %s', (_case, mutateTags, requestTags) => {
    const result = validateZapReceipt(
      makeValidReceipt(
        BOLT11_AMOUNT_MSATS,
        mutateTags,
        requestTags,
      ),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
        expectedATag: EXPECTED_A_TAG,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['a-mismatch', 'duplicate-a']).toContain(result.reason);
    }
  });

  it('accepts any older spelling of the same page', () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, undefined, [['a', EXPECTED_A_TAG]]),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
        expectedATag: [
          `39735:${RECIPIENT_PK}:https://x.com/alice/status/99`,
          EXPECTED_A_TAG,
        ],
      },
    );
    expect(result.ok).toBe(true);
  });

  it('has no sender when the zap request carries an anon tag', () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, undefined, [['anon']]),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.senderPubkey).toBeNull();
  });

  it('does not reject a receipt whose description hash does not match', async () => {
    const { createHash } = await import('node:crypto');
    const { bech32 } = await import('@scure/base');
    const zapRequest = makeZapRequest();
    const description = JSON.stringify(zapRequest);
    const hash = createHash('sha256').update('other description').digest();
    const words: number[] = [];
    const timestamp = 1_700_000_000;
    for (let index = 6; index >= 0; index -= 1) {
      words.push((timestamp >> (index * 5)) & 31);
    }
    const dataWords = bech32.toWords(hash);
    const length = dataWords.length;
    words.push(23, (length >> 5) & 31, length & 31, ...dataWords);
    words.push(...bech32.toWords(new Uint8Array(65).fill(2)));
    const bolt11 = bech32.encode('lnbc20u', words, 2000);
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: 1_700_000_100,
        content: '',
        tags: [
          ['p', RECIPIENT_PK],
          ['bolt11', bolt11],
          ['description', description],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.descriptionHashMismatch).toBe(true);
      expect(result.senderPubkey).toBe(getPublicKey(SENDER_SK));
    }
  });
});
