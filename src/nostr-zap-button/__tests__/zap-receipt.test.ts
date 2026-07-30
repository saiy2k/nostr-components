// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
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

function makeValidReceipt(amountMsats = BOLT11_AMOUNT_MSATS) {
  const zapRequest = makeZapRequest(amountMsats);
  return finalizeEvent(
    {
      kind: 9735,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['p', RECIPIENT_PK],
        ['P', zapRequest.pubkey],
        ['bolt11', BOLT11_20U],
        ['description', JSON.stringify(zapRequest)],
      ],
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
});
