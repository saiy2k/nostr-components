// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { bech32 } from '@scure/base';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { aggregateZapReceipts } from '../zap-utils';
import { renderZapperEntry } from '../render-zap-entry';
import type { ZapProviderInfo } from '../zap-receipt';
import { BOLT11_20U_AMOUNT_MSATS } from './fixtures';

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

function syntheticBolt11(hrp: string, fill: number): string {
  const words: number[] = [];
  const timestamp = 1_700_000_000;
  for (let index = 6; index >= 0; index -= 1) {
    words.push((timestamp >> (index * 5)) & 31);
  }
  const hash = new Uint8Array(32).fill(fill);
  const dataWords = bech32.toWords(hash);
  const length = dataWords.length;
  words.push(23, (length >> 5) & 31, length & 31, ...dataWords);
  words.push(...bech32.toWords(new Uint8Array(65).fill(fill)));
  return bech32.encode(hrp, words, 2000);
}

function makeZapRequest(
  amountMsats: number,
  content: string,
  createdAt: number,
) {
  return finalizeEvent(
    {
      kind: 9734,
      created_at: createdAt,
      content,
      tags: [
        ['p', RECIPIENT_PK],
        ['amount', String(amountMsats)],
        ['relays', 'wss://relay.example'],
      ],
    },
    SENDER_SK,
  );
}

function makeReceipt(
  zapRequest: ReturnType<typeof makeZapRequest>,
  bolt11: string,
  createdAt: number,
  signer = PROVIDER_SK,
) {
  return finalizeEvent(
    {
      kind: 9735,
      created_at: createdAt,
      content: '',
      tags: [
        ['p', RECIPIENT_PK],
        ['P', zapRequest.pubkey],
        ['bolt11', bolt11],
        ['description', JSON.stringify(zapRequest)],
      ],
    },
    signer,
  );
}

describe('aggregateZapReceipts', () => {
  it('counts one receipt returned by every relay a single time', () => {
    const bolt11 = syntheticBolt11('lnbc20u', 1);
    const request = makeZapRequest(BOLT11_20U_AMOUNT_MSATS, 'hello', 10);
    const receipt = makeReceipt(request, bolt11, 100);
    const copies = Array.from({ length: 9 }, () => receipt);

    const result = aggregateZapReceipts(copies, RECIPIENT_PK, PROVIDER);

    expect(result.totalMsats).toBe(BOLT11_20U_AMOUNT_MSATS);
    expect(result.zapDetails).toHaveLength(1);
    expect(result.zapDetails[0]).toMatchObject({
      amount: BOLT11_20U_AMOUNT_MSATS / 1000,
      comment: 'hello',
      authorPubkey: getPublicKey(SENDER_SK),
    });

    const list = result.zapDetails
      .map((zap, index) => renderZapperEntry(zap, index))
      .join('');
    expect(list.match(/class="zap-entry"/g)).toHaveLength(1);
    expect(list).toContain('hello');
  });

  it('collapses receipts that share a bolt11 or zap request and drops fakes', () => {
    const boltA = syntheticBolt11('lnbc20u', 1);
    const boltB = syntheticBolt11('lnbc20u', 2);
    const boltDistinct = syntheticBolt11('lnbc21u', 3);
    const boltFake = syntheticBolt11('lnbc11u', 4);
    const requestA = makeZapRequest(BOLT11_20U_AMOUNT_MSATS, 'hello', 10);
    const requestC = makeZapRequest(BOLT11_20U_AMOUNT_MSATS, 'other', 11);
    const requestD = makeZapRequest(2_100_000, 'eleven sats', 12);
    const requestFake = makeZapRequest(1_100_000, 'fake', 13);

    const receiptA = makeReceipt(requestA, boltA, 100);
    const receiptB = makeReceipt(requestA, boltB, 200);
    const receiptC = makeReceipt(requestC, boltB, 300);
    const receiptD = makeReceipt(requestD, boltDistinct, 400);
    const fake = makeReceipt(requestFake, boltFake, 50, SENDER_SK);

    const result = aggregateZapReceipts(
      [receiptA, receiptA, receiptA, receiptB, receiptC, fake, receiptD],
      RECIPIENT_PK,
      PROVIDER,
    );

    expect(result.totalMsats).toBe(BOLT11_20U_AMOUNT_MSATS + 2_100_000);
    expect(result.zapDetails).toHaveLength(2);
    expect(result.zapDetails.map((zap) => zap.comment)).toEqual([
      'eleven sats',
      'hello',
    ]);
    expect(result.zapDetails.map((zap) => zap.amount)).toEqual([
      2100,
      BOLT11_20U_AMOUNT_MSATS / 1000,
    ]);
  });
});
