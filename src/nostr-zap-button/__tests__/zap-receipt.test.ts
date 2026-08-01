// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, verifiedSymbol } from 'nostr-tools';
import {
  getBolt11AmountMsats,
  lnurlFromProfileContent,
  validateZapReceipt,
  type ZapProviderInfo,
} from '../zap-receipt';

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

// Real invoice from light-bolt11-decoder fixtures: 20u = 2_000_000 msats
const BOLT11_20U =
  'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567';
const BOLT11_AMOUNT_MSATS = 2_000_000;

function makeZapRequest(amountMsats = BOLT11_AMOUNT_MSATS) {
  return finalizeEvent(
    {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      content: 'thanks',
      tags: [
        ['p', RECIPIENT_PK],
        ['amount', String(amountMsats)],
        ['relays', 'wss://relay.example'],
      ],
    },
    SENDER_SK,
  );
}

function makeValidReceipt(
  amountMsats = BOLT11_AMOUNT_MSATS,
  mutateTags?: (tags: string[][]) => string[][],
) {
  const zapRequest = makeZapRequest(amountMsats);
  const baseTags: string[][] = [
    ['p', RECIPIENT_PK],
    ['P', zapRequest.pubkey],
    ['bolt11', BOLT11_20U],
    ['description', JSON.stringify(zapRequest)],
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
});
