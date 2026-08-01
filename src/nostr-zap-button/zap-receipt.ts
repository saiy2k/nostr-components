// SPDX-License-Identifier: MIT

import { bech32 } from '@scure/base';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';
import type { Event } from 'nostr-tools';
import { nip57, verifyEvent } from 'nostr-tools';

export interface ZapProviderInfo {
  lnurl: string;
  callback: string;
  nostrPubkey: string;
}

export type ZapReceiptValidationResult =
  | {
      ok: true;
      amountMsats: number;
      zapRequest: Event;
    }
  | {
      ok: false;
      reason: string;
    };

function getTagValue(tags: string[][] | undefined, name: string): string | undefined {
  const tag = tags?.find((t) => t[0] === name && t[1]);
  return tag?.[1];
}

/**
 * Resolve LNURL-pay URL from kind-0 lud06 / lud16 (same rules as nostr-tools nip57).
 * Only HTTPS LNURLs are accepted so nostrPubkey cannot be MITM'd over cleartext.
 */
export function lnurlFromProfileContent(content: string): string | null {
  try {
    const { lud06, lud16 } = JSON.parse(content || '{}');
    if (lud16 && typeof lud16 === 'string') {
      const [name, domain] = lud16.split('@');
      if (!name || !domain) return null;
      return new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
    }
    if (lud06 && typeof lud06 === 'string') {
      const { words } = bech32.decode(lud06, 1000);
      const data = bech32.fromWords(words);
      const decodedUrl = new TextDecoder().decode(Uint8Array.from(data));
      const parsed = new URL(decodedUrl);
      return parsed.protocol === 'https:' ? parsed.toString() : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve the recipient LNURL-pay metadata used for NIP-57 Appendix F checks.
 */
export async function resolveZapProviderInfo(
  profileMetadata: Event,
  fetchImpl: typeof fetch = fetch,
): Promise<ZapProviderInfo | null> {
  try {
    const lnurl = lnurlFromProfileContent(profileMetadata.content || '');
    if (!lnurl) return null;

    const res = await fetchImpl(lnurl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = await res.json();

    if (!body?.allowsNostr || typeof body.nostrPubkey !== 'string' || !body.callback) {
      return null;
    }

    if (!/^[a-f0-9]{64}$/i.test(body.nostrPubkey)) {
      return null;
    }

    const callback = String(body.callback);
    if (!callback.startsWith('https://')) {
      return null;
    }

    return {
      lnurl,
      callback,
      nostrPubkey: String(body.nostrPubkey).toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Normalize a zap-request `lnurl` tag for comparison against the provider LNURL.
 * NIP-57 clients write the bech32-encoded LNURL (lud06 style), but some write the
 * plain https URL; accept both by decoding bech32 and URL-normalizing.
 */
function normalizeLnurlTag(value: string): string | null {
  try {
    let urlString = value;
    if (/^lnurl1/i.test(value)) {
      const { words } = bech32.decode(value.toLowerCase() as `${string}1${string}`, 1000);
      urlString = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(words)));
    }
    return new URL(urlString).toString();
  } catch {
    return null;
  }
}

export function getBolt11AmountMsats(bolt11: string): number | null {
  try {
    const decoded = decodeBolt11(bolt11);
    const amountSection = decoded.sections.find(
      (section) => section.name === 'amount',
    ) as { name: 'amount'; value?: string } | undefined;
    if (!amountSection?.value) return null;
    const amount = Number(amountSection.value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  } catch {
    return null;
  }
}

/**
 * Validate a kind-9735 zap receipt per NIP-57 Appendix F (plus zap-request signature).
 */
export function validateZapReceipt(
  receipt: Event,
  opts: {
    recipientPubkey: string;
    provider: ZapProviderInfo;
  },
): ZapReceiptValidationResult {
  if (receipt.kind !== 9735) {
    return { ok: false, reason: 'not-kind-9735' };
  }

  // Verify the receipt's own signature here rather than relying on the pool/NDK
  // caller's verification config — this function is the fail-closed gate.
  if (!verifyEvent(receipt)) {
    return { ok: false, reason: 'receipt-sig' };
  }

  if (receipt.pubkey.toLowerCase() !== opts.provider.nostrPubkey.toLowerCase()) {
    return { ok: false, reason: 'receipt-pubkey-mismatch' };
  }

  const receiptP = getTagValue(receipt.tags, 'p');
  if (!receiptP || receiptP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: 'receipt-p-mismatch' };
  }

  const description = getTagValue(receipt.tags, 'description');
  if (!description) {
    return { ok: false, reason: 'missing-description' };
  }

  const zapRequestError = nip57.validateZapRequest(description);
  if (zapRequestError) {
    return { ok: false, reason: `invalid-zap-request:${zapRequestError}` };
  }

  let zapRequest: Event;
  try {
    zapRequest = JSON.parse(description);
  } catch {
    return { ok: false, reason: 'description-json' };
  }

  if (!verifyEvent(zapRequest)) {
    return { ok: false, reason: 'zap-request-sig' };
  }

  const requestP = getTagValue(zapRequest.tags, 'p');
  if (!requestP || requestP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: 'zap-request-p-mismatch' };
  }

  const bolt11 = getTagValue(receipt.tags, 'bolt11');
  if (!bolt11) {
    return { ok: false, reason: 'missing-bolt11' };
  }

  const invoiceAmountMsats = getBolt11AmountMsats(bolt11);
  if (invoiceAmountMsats == null) {
    return { ok: false, reason: 'invalid-bolt11-amount' };
  }

  const amountTag = getTagValue(zapRequest.tags, 'amount');
  if (amountTag) {
    const requestAmount = Number(amountTag);
    if (!Number.isFinite(requestAmount) || requestAmount !== invoiceAmountMsats) {
      return { ok: false, reason: 'amount-mismatch' };
    }
  }

  const requestLnurl = getTagValue(zapRequest.tags, 'lnurl');
  if (requestLnurl) {
    const normalized = normalizeLnurlTag(requestLnurl);
    if (!normalized || normalized !== opts.provider.lnurl) {
      return { ok: false, reason: 'lnurl-mismatch' };
    }
  }

  return {
    ok: true,
    amountMsats: invoiceAmountMsats,
    zapRequest,
  };
}
