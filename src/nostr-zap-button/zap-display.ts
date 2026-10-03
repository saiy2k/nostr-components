// SPDX-License-Identifier: MIT

import type { ZapDetails } from './zap-utils';

export interface PendingZapCredit {
  invoice: string;
  amountSats: number;
  comment: string;
  authorPubkey: string;
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
 * Adopt a relay total when it already includes every pending payment.
 * A lower result is stale (the receipt is not indexed yet, or a cache
 * answered with the pre-zap summary) and must not replace the credit.
 * With no baseline yet, keep the credit on top of this first fetch.
 */
export function applyRelayZapResult(
  state: ZapDisplayState,
  result: RelayZapResult,
): ZapDisplayState {
  if (!isUsableTotal(result.totalAmount)) return state;

  const credit = pendingCreditSats(state.pending);
  if (credit === 0) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: [],
    };
  }

  if (state.relayTotal === null) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: state.pending,
    };
  }

  if (result.totalAmount >= state.relayTotal + credit) {
    return {
      relayTotal: result.totalAmount,
      relayDetails: result.zapDetails,
      pending: [],
    };
  }

  return state;
}

function pendingCreditSats(pending: PendingZapCredit[]): number {
  return pending.reduce((sum, zap) => sum + zap.amountSats, 0);
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
