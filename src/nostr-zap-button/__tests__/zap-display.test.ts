// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import type { ZapDetails } from '../zap-utils';
import {
  applyRelayZapResult,
  creditPaidZap,
  displayedZapDetails,
  displayedZapTotal,
  emptyZapDisplay,
  RECEIPT_MATCH_SKEW_MS,
  resetZapDisplay,
  type PendingZapCredit,
  type ZapDisplayState,
} from '../zap-display';

const paidAt = new Date('2026-10-03T12:00:00.000Z');

function payment(overrides: Partial<PendingZapCredit> = {}): PendingZapCredit {
  return {
    invoice: 'lnbc21',
    amountSats: 21,
    comment: 'nice',
    authorPubkey: 'sender',
    paidAt,
    ...overrides,
  };
}

function relayZap(amount: number, authorPubkey = 'other', date = new Date('2026-10-01T00:00:00.000Z')): ZapDetails {
  return {
    amount,
    date,
    authorPubkey,
    comment: '',
  };
}

function paidReceipt(amount: number, authorPubkey = 'sender', skewMs = 0): ZapDetails {
  return relayZap(amount, authorPubkey, new Date(paidAt.getTime() - skewMs));
}

function withRelay(total: number, details: ZapDetails[] = [relayZap(total)]): ZapDisplayState {
  return {
    relayTotal: total,
    relayDetails: details,
    pending: [],
  };
}

describe('zap-display', () => {
  it('credits a paid invoice onto the visible total and list', () => {
    const next = creditPaidZap(withRelay(100), payment());

    expect(displayedZapTotal(next)).toBe(121);
    expect(displayedZapDetails(next)).toEqual([
      {
        amount: 21,
        date: paidAt,
        authorPubkey: 'sender',
        comment: 'nice',
      },
      relayZap(100),
    ]);
  });

  it('credits the same invoice only once', () => {
    const once = creditPaidZap(withRelay(100), payment());
    const twice = creditPaidZap(once, payment());

    expect(twice).toBe(once);
    expect(displayedZapTotal(twice)).toBe(121);
  });

  it('credits a second invoice again', () => {
    const first = creditPaidZap(withRelay(100), payment());
    const second = creditPaidZap(first, payment({ invoice: 'lnbc100', amountSats: 100 }));

    expect(displayedZapTotal(second)).toBe(221);
    expect(displayedZapDetails(second).map((zap) => zap.amount)).toEqual([100, 21, 100]);
  });

  it('keeps the credited total when a refresh is still short of it', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 100,
      zapDetails: [relayZap(100)],
    });

    expect(refreshed).toBe(credited);
    expect(displayedZapTotal(refreshed)).toBe(121);
  });

  it('drops the credit once a matching receipt is in the result', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const caughtUp = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21), relayZap(100)],
    });

    expect(displayedZapTotal(caughtUp)).toBe(121);
    expect(caughtUp.pending).toEqual([]);
    expect(displayedZapDetails(caughtUp)).toEqual([
      paidReceipt(21),
      relayZap(100),
    ]);
  });

  it('keeps the credit when an older zap from the same sender raises the total', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [relayZap(21, 'sender'), relayZap(100)],
    });

    expect(refreshed.relayTotal).toBe(121);
    expect(refreshed.pending).toHaveLength(1);
    expect(displayedZapTotal(refreshed)).toBe(142);
  });

  it('keeps the credit when someone else pays the same amount', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21, 'other'), relayZap(100)],
    });

    expect(refreshed.relayTotal).toBe(121);
    expect(refreshed.pending).toHaveLength(1);
    expect(displayedZapTotal(refreshed)).toBe(142);
  });

  it('matches a receipt a few minutes before the client timestamp', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const caughtUp = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21, 'sender', RECEIPT_MATCH_SKEW_MS), relayZap(100)],
    });

    expect(caughtUp.pending).toEqual([]);
    expect(displayedZapTotal(caughtUp)).toBe(121);
  });

  it('does not match a receipt older than the clock skew', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21, 'sender', RECEIPT_MATCH_SKEW_MS + 1), relayZap(100)],
    });

    expect(refreshed.pending).toHaveLength(1);
    expect(displayedZapTotal(refreshed)).toBe(142);
  });

  it('matches the sender pubkey without case sensitivity', () => {
    const credited = creditPaidZap(withRelay(100), payment({ authorPubkey: 'AbC' }));
    const caughtUp = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21, 'abc'), relayZap(100)],
    });

    expect(caughtUp.pending).toEqual([]);
    expect(displayedZapTotal(caughtUp)).toBe(121);
  });

  it('does not clear a new credit against a receipt already on the button', () => {
    const recent = paidReceipt(21, 'sender', 60_000);
    const baseline = withRelay(121, [recent, relayZap(100)]);
    const credited = creditPaidZap(baseline, payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [recent, relayZap(100)],
    });

    expect(refreshed).toBe(credited);
    expect(displayedZapTotal(refreshed)).toBe(142);

    const caughtUp = applyRelayZapResult(credited, {
      totalAmount: 142,
      zapDetails: [paidReceipt(21), recent, relayZap(100)],
    });
    expect(caughtUp.pending).toEqual([]);
    expect(displayedZapTotal(caughtUp)).toBe(142);
  });

  it('drops only the pending credit that has a matching receipt', () => {
    const first = creditPaidZap(withRelay(100), payment());
    const second = creditPaidZap(first, payment({ invoice: 'lnbc21b' }));
    const refreshed = applyRelayZapResult(second, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21), relayZap(100)],
    });

    expect(refreshed.pending).toHaveLength(1);
    expect(displayedZapTotal(refreshed)).toBe(142);
    expect(displayedZapDetails(refreshed).filter((zap) => zap.amount === 21)).toHaveLength(2);
  });

  it('adopts a lower total once the pending payment is in that result', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 71,
      zapDetails: [paidReceipt(21), relayZap(50)],
    });

    expect(refreshed.pending).toEqual([]);
    expect(displayedZapTotal(refreshed)).toBe(71);
  });

  it('ignores a lower total that does not contain the pending payment', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const refreshed = applyRelayZapResult(credited, {
      totalAmount: 80,
      zapDetails: [relayZap(80)],
    });

    expect(refreshed).toBe(credited);
    expect(displayedZapTotal(refreshed)).toBe(121);
  });

  it('keeps a credit that landed before the first count on top of that fetch', () => {
    const credited = creditPaidZap(emptyZapDisplay(), payment());
    expect(displayedZapTotal(credited)).toBe(21);

    const firstFetch = applyRelayZapResult(credited, {
      totalAmount: 100,
      zapDetails: [relayZap(100)],
    });

    expect(firstFetch.relayTotal).toBe(100);
    expect(firstFetch.pending).toHaveLength(1);
    expect(displayedZapTotal(firstFetch)).toBe(121);

    const caughtUp = applyRelayZapResult(firstFetch, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21), relayZap(100)],
    });
    expect(displayedZapTotal(caughtUp)).toBe(121);
    expect(caughtUp.pending).toEqual([]);
  });

  it('does not stack a credit the first count already includes', () => {
    const credited = creditPaidZap(emptyZapDisplay(), payment());
    const firstFetch = applyRelayZapResult(credited, {
      totalAmount: 121,
      zapDetails: [paidReceipt(21), relayZap(100)],
    });

    expect(firstFetch.pending).toEqual([]);
    expect(displayedZapTotal(firstFetch)).toBe(121);
    expect(displayedZapDetails(firstFetch).filter((zap) => zap.amount === 21)).toHaveLength(1);
  });

  it('adopts a relay total when nothing is pending', () => {
    const next = applyRelayZapResult(withRelay(100), {
      totalAmount: 80,
      zapDetails: [relayZap(80)],
    });

    expect(displayedZapTotal(next)).toBe(80);
  });

  it('ignores an empty invoice or a non-positive amount', () => {
    const baseline = withRelay(100);
    expect(creditPaidZap(baseline, payment({ invoice: '' }))).toBe(baseline);
    expect(creditPaidZap(baseline, payment({ amountSats: 0 }))).toBe(baseline);
  });

  it('resets the fetched total and any pending credit', () => {
    const credited = creditPaidZap(withRelay(100), payment());
    const reset = resetZapDisplay();

    expect(displayedZapTotal(reset)).toBeNull();
    expect(displayedZapDetails(reset)).toEqual([]);
    expect(reset.pending).toEqual([]);
    expect(displayedZapTotal(credited)).toBe(121);
  });
});
