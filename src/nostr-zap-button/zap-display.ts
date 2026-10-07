// SPDX-License-Identifier: MIT

import type { ZapDetails } from './zap-utils';

export interface PendingZapCredit {
  invoice: string;
  amountSats: number;
  comment: string;
  authorPubkey: string | null;
  paidAt: Date;
}

export interface ZapDisplayState {
  relayTotal: number | null;
  relayDetails: ZapDetails[];
  pending: PendingZapCredit[];
}

export interface RelayZapResult {
  totalAmount: number;
  zapDetails: ZapDetails[];
}

export function emptyZapDisplay(): ZapDisplayState {
  return {
    relayTotal: null,
    relayDetails: [],
    pending: [],
  };
}

export function resetZapDisplay(): ZapDisplayState {
  return emptyZapDisplay();
}

export function hasPendingZapCredit(state: ZapDisplayState): boolean {
  return state.pending.length > 0;
}

/**
 * Receipt `created_at` can precede the client clock: WebLN stamps `paidAt`
 * when the wallet returns, and a QR payment stamps it when the receipt
 * is observed. Ten minutes covers that skew without treating an older
 * zap of the same amount as this payment.
 */
export const RECEIPT_MATCH_SKEW_MS = 10 * 60 * 1000;

export function displayedZapTotal(state: ZapDisplayState): number | null {
  const credit = pendingCreditSats(state.pending);
  if (state.relayTotal === null) {
    return credit > 0 ? credit : null;
  }
  return state.relayTotal + credit;
}

export function displayedZapDetails(state: ZapDisplayState): ZapDetails[] {
  return [
    ...state.pending.map(pendingZapDetails),
    ...state.relayDetails,
  ];
}

export function creditPaidZap(
  state: ZapDisplayState,
  payment: PendingZapCredit,
): ZapDisplayState {
  if (!isCreditablePayment(payment)) return state;
  if (state.pending.some((zap) => zap.invoice === payment.invoice)) return state;

  return {
    relayTotal: state.relayTotal,
    relayDetails: state.relayDetails,
    pending: [payment, ...state.pending],
  };
}

/**
 * Drop a pending credit only when this result contains that payment.
 * A sum that grew by the same amount is not evidence: it may be someone
 * else's zap. A lower result that lacks the receipt is stale and stays off
 * the button. With no baseline yet, keep an unmatched credit on top of the
 * first fetch.
 */
export function applyRelayZapResult(
  state: ZapDisplayState,
  result: RelayZapResult,
): ZapDisplayState {
  if (!isUsableTotal(result.totalAmount)) return state;

  if (state.pending.length === 0) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: [],
    };
  }

  const unmatched = pendingWithoutMatchingReceipts(
    state.pending,
    result.zapDetails,
    state.relayDetails,
  );
  if (unmatched.length !== state.pending.length) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: unmatched,
    };
  }

  if (state.relayTotal === null || result.totalAmount > state.relayTotal) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: state.pending,
    };
  }

  return state;
}

function pendingCreditSats(pending: PendingZapCredit[]): number {
  return pending.reduce((sum, zap) => sum + zap.amountSats, 0);
}

function pendingWithoutMatchingReceipts(
  pending: PendingZapCredit[],
  details: ZapDetails[],
  previousDetails: ZapDetails[],
): PendingZapCredit[] {
  const freshDetails = detailsAbsentFrom(previousDetails, details);
  const used = new Set<number>();
  const unmatched: PendingZapCredit[] = [];
  for (const credit of pending) {
    const index = freshDetails.findIndex((detail, detailIndex) =>
      !used.has(detailIndex) && receiptMatchesCredit(detail, credit),
    );
    if (index === -1) {
      unmatched.push(credit);
    } else {
      used.add(index);
    }
  }
  return unmatched;
}

function detailsAbsentFrom(previous: ZapDetails[], next: ZapDetails[]): ZapDetails[] {
  const remaining = new Map<string, number>();
  for (const detail of previous) {
    const key = receiptKey(detail);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const fresh: ZapDetails[] = [];
  for (const detail of next) {
    const key = receiptKey(detail);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else {
      fresh.push(detail);
    }
  }
  return fresh;
}

function receiptKey(detail: ZapDetails): string {
  const author = detail.authorPubkey?.toLowerCase() ?? '';
  return `${author}|${detail.amount}|${detail.date.getTime()}`;
}

function receiptMatchesCredit(detail: ZapDetails, credit: PendingZapCredit): boolean {
  if (!sameAuthor(detail.authorPubkey, credit.authorPubkey)) return false;
  if (detail.amount !== credit.amountSats) return false;
  return detail.date.getTime() >= credit.paidAt.getTime() - RECEIPT_MATCH_SKEW_MS;
}

function sameAuthor(left: string | null, right: string | null): boolean {
  if (left == null || right == null) return left == null && right == null;
  return left.length > 0 && left.toLowerCase() === right.toLowerCase();
}

function pendingZapDetails(zap: PendingZapCredit): ZapDetails {
  return {
    amount: zap.amountSats,
    date: zap.paidAt,
    authorPubkey: zap.authorPubkey,
    comment: zap.comment,
  };
}

function isCreditablePayment(payment: PendingZapCredit): boolean {
  return (
    typeof payment.invoice === 'string' &&
    payment.invoice.length > 0 &&
    isPositiveAmount(payment.amountSats)
  );
}

function isPositiveAmount(amount: number): boolean {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

function isUsableTotal(amount: number): boolean {
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
}
