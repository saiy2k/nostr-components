// SPDX-License-Identifier: MIT

import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { bech32 } from '@scure/base';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';
import type { Event } from 'nostr-tools';
import { nip57 } from 'nostr-tools';
import { cloneVerifiedEvent } from '../common/nostr-event';
import { httpGetJson } from '../common/relay-transport';

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
      /** Null when the zap request carries an `anon` tag, including one with no value. */
      senderPubkey: string | null;
      /** Set when the bolt11 description hash does not match the raw description. Never a rejection. */
      descriptionHashMismatch?: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

function getTagEntries(
  tags: string[][] | undefined,
  name: string,
): string[][] {
  return Array.isArray(tags)
    ? tags.filter((tag) => Array.isArray(tag) && tag[0] === name)
    : [];
}

function getUniqueTagValue(
  tags: string[][] | undefined,
  name: string,
): string | null {
  const matches = getTagEntries(tags, name);
  return matches.length === 1 &&
    typeof matches[0][1] === 'string' &&
    matches[0][1].length > 0
    ? matches[0][1]
    : null;
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
  fetchImpl?: typeof fetch,
): Promise<ZapProviderInfo | null> {
  try {
    const verifiedProfile = cloneVerifiedEvent(profileMetadata);
    if (!verifiedProfile || verifiedProfile.kind !== 0) {
      return null;
    }
    const lnurl = lnurlFromProfileContent(verifiedProfile.content || '');
    if (!lnurl) return null;

    let body: any;
    if (fetchImpl) {
      const res = await fetchImpl(lnurl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      body = await res.json();
    } else {
      const result = await httpGetJson(lnurl);
      if (result.status < 200 || result.status >= 300 || result.json == null) {
        return null;
      }
      body = result.json;
    }

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

function descriptionHashMatches(bolt11: string, description: string): boolean {
  try {
    const decoded = decodeBolt11(bolt11);
    const sections = decoded.sections as Array<{ name: string; value?: string }>;
    const section = sections.find((item) => item.name === 'description_hash');
    if (!section?.value || typeof section.value !== 'string') return false;
    const hashed = bytesToHex(sha256(new TextEncoder().encode(description)));
    return section.value.toLowerCase() === hashed;
  } catch {
    return false;
  }
}

function senderPubkeyFor(zapRequest: Event): string | null {
  return getTagEntries(zapRequest.tags, 'anon').length > 0
    ? null
    : zapRequest.pubkey;
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
    expectedATag?: string | string[];
    expectedBolt11?: string;
  },
): ZapReceiptValidationResult {
  if (receipt.kind !== 9735) {
    return { ok: false, reason: 'not-kind-9735' };
  }

  // Verify the receipt's own signature here rather than relying on the pool/NDK
  // caller's verification config — this function is the fail-closed gate.
  const verifiedReceipt = cloneVerifiedEvent(receipt);
  if (!verifiedReceipt) {
    return { ok: false, reason: 'receipt-sig' };
  }

  if (verifiedReceipt.pubkey.toLowerCase() !== opts.provider.nostrPubkey.toLowerCase()) {
    return { ok: false, reason: 'receipt-pubkey-mismatch' };
  }

  const receiptPTags = getTagEntries(verifiedReceipt.tags, 'p');
  const receiptP = getUniqueTagValue(verifiedReceipt.tags, 'p');
  if (receiptPTags.length > 1) {
    return { ok: false, reason: 'duplicate-receipt-p' };
  }
  if (!receiptP || receiptP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: 'receipt-p-mismatch' };
  }

  const descriptionTags = getTagEntries(
    verifiedReceipt.tags,
    'description',
  );
  const description = getUniqueTagValue(
    verifiedReceipt.tags,
    'description',
  );
  if (descriptionTags.length > 1) {
    return { ok: false, reason: 'duplicate-description' };
  }
  if (!description) {
    return { ok: false, reason: 'missing-description' };
  }

  const zapRequestError = nip57.validateZapRequest(description);
  if (zapRequestError) {
    return { ok: false, reason: `invalid-zap-request:${zapRequestError}` };
  }

  let parsedZapRequest: Event;
  try {
    parsedZapRequest = JSON.parse(description);
  } catch {
    return { ok: false, reason: 'description-json' };
  }

  // nip57.validateZapRequest does not check the kind; NIP-57 zap requests are 9734.
  if (parsedZapRequest.kind !== 9734) {
    return { ok: false, reason: 'zap-request-kind' };
  }

  const zapRequest = cloneVerifiedEvent(parsedZapRequest);
  if (!zapRequest) {
    return { ok: false, reason: 'zap-request-sig' };
  }

  const requestPTags = getTagEntries(zapRequest.tags, 'p');
  const requestP = getUniqueTagValue(zapRequest.tags, 'p');
  if (requestPTags.length > 1) {
    return { ok: false, reason: 'duplicate-zap-request-p' };
  }
  if (!requestP || requestP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: 'zap-request-p-mismatch' };
  }

  const bolt11Tags = getTagEntries(verifiedReceipt.tags, 'bolt11');
  const bolt11 = getUniqueTagValue(verifiedReceipt.tags, 'bolt11');
  if (bolt11Tags.length > 1) {
    return { ok: false, reason: 'duplicate-bolt11' };
  }
  if (!bolt11) {
    return { ok: false, reason: 'missing-bolt11' };
  }
  if (opts.expectedBolt11 && bolt11 !== opts.expectedBolt11) {
    return { ok: false, reason: 'bolt11-mismatch' };
  }

  const invoiceAmountMsats = getBolt11AmountMsats(bolt11);
  if (invoiceAmountMsats == null) {
    return { ok: false, reason: 'invalid-bolt11-amount' };
  }
  const descriptionHashMismatch = !descriptionHashMatches(bolt11, description);

  const amountTags = getTagEntries(zapRequest.tags, 'amount');
  if (amountTags.length > 1) {
    return { ok: false, reason: 'duplicate-amount' };
  }
  const amountTag = getUniqueTagValue(zapRequest.tags, 'amount');
  if (amountTags.length === 1 && !amountTag) {
    return { ok: false, reason: 'invalid-amount' };
  }
  if (amountTag) {
    const requestAmount = Number(amountTag);
    if (!Number.isFinite(requestAmount) || requestAmount !== invoiceAmountMsats) {
      return { ok: false, reason: 'amount-mismatch' };
    }
  }

  const lnurlTags = getTagEntries(zapRequest.tags, 'lnurl');
  if (lnurlTags.length > 1) {
    return { ok: false, reason: 'duplicate-lnurl' };
  }
  const requestLnurl = getUniqueTagValue(zapRequest.tags, 'lnurl');
  if (lnurlTags.length === 1 && !requestLnurl) {
    return { ok: false, reason: 'lnurl-mismatch' };
  }
  if (requestLnurl) {
    const normalized = normalizeLnurlTag(requestLnurl);
    if (!normalized || normalized !== opts.provider.lnurl) {
      return { ok: false, reason: 'lnurl-mismatch' };
    }
  }

  const receiptATags = getTagEntries(verifiedReceipt.tags, 'a');
  const requestATags = getTagEntries(zapRequest.tags, 'a');
  if (receiptATags.length > 1 || requestATags.length > 1) {
    return { ok: false, reason: 'duplicate-a' };
  }
  const receiptA = getUniqueTagValue(verifiedReceipt.tags, 'a');
  const requestA = getUniqueTagValue(zapRequest.tags, 'a');
  if (opts.expectedATag) {
    const allowed = Array.isArray(opts.expectedATag)
      ? opts.expectedATag
      : [opts.expectedATag];
    if (
      !receiptA ||
      !requestA ||
      receiptA !== requestA ||
      !allowed.includes(receiptA)
    ) {
      return { ok: false, reason: 'a-mismatch' };
    }
  } else if (
    receiptATags.length !== requestATags.length ||
    receiptA !== requestA
  ) {
    return { ok: false, reason: 'a-mismatch' };
  }

  const result: ZapReceiptValidationResult = {
    ok: true,
    amountMsats: invoiceAmountMsats,
    zapRequest,
    senderPubkey: senderPubkeyFor(zapRequest),
  };
  if (result.ok && descriptionHashMismatch) {
    result.descriptionHashMismatch = true;
  }
  return result;
}
