// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { bech32 } from "@scure/base";
import { decode as decodeBolt11 } from "light-bolt11-decoder";
import { nip57, verifiedSymbol, verifyEvent } from "nostr-tools";

function getTagEntries(tags, name) {
  return Array.isArray(tags)
    ? tags.filter((tag) => Array.isArray(tag) && tag[0] === name)
    : [];
}

function getUniqueTagValue(tags, name) {
  const matches = getTagEntries(tags, name);
  return matches.length === 1 &&
    typeof matches[0][1] === "string" &&
    matches[0][1].length > 0
    ? matches[0][1]
    : null;
}

/**
 * Verify a symbol-free copy so nostr-tools cannot reuse cached verification
 * state from an object that was mutated after an earlier check.
 */
function cloneVerifiedEvent(value) {
  if (!value || typeof value !== "object") return null;
  const event = value;
  if (
    typeof event.id !== "string" ||
    typeof event.pubkey !== "string" ||
    typeof event.created_at !== "number" ||
    !Number.isInteger(event.created_at) ||
    typeof event.kind !== "number" ||
    !Number.isInteger(event.kind) ||
    typeof event.content !== "string" ||
    typeof event.sig !== "string" ||
    !Array.isArray(event.tags) ||
    event.tags.some(
      (tag) =>
        !Array.isArray(tag) || tag.some((item) => typeof item !== "string"),
    )
  ) {
    return null;
  }

  const candidate = {
    [verifiedSymbol]: undefined,
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  };
  try {
    return verifyEvent(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeLnurlTag(value) {
  try {
    let urlString = value;
    if (/^lnurl1/i.test(value)) {
      const { words } = bech32.decode(value.toLowerCase(), 1000);
      urlString = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(words)));
    }
    return new URL(urlString).toString();
  } catch {
    return null;
  }
}

export function getBolt11AmountMsats(bolt11) {
  try {
    const decoded = decodeBolt11(bolt11);
    const amountSection = decoded.sections.find(
      (section) => section.name === "amount",
    );
    if (!amountSection?.value) return null;
    const amount = Number(amountSection.value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  } catch {
    return null;
  }
}

function descriptionHashMatches(bolt11, description) {
  try {
    const decoded = decodeBolt11(bolt11);
    const section = decoded.sections.find(
      (item) => item.name === "description_hash",
    );
    if (!section?.value || typeof section.value !== "string") return false;
    const hashed = createHash("sha256").update(description).digest("hex");
    return section.value.toLowerCase() === hashed;
  } catch {
    return false;
  }
}

function senderPubkeyFor(zapRequest) {
  return getTagEntries(zapRequest.tags, "anon").length > 0
    ? null
    : zapRequest.pubkey;
}

/**
 * Validate a kind-9735 zap receipt per NIP-57 Appendix F.
 * The bolt11 description hash must equal the sha256 of the raw description
 * tag string. A zap request with an anon tag has no sender.
 */
export function validateZapReceipt(receipt, opts) {
  if (receipt.kind !== 9735) {
    return { ok: false, reason: "not-kind-9735" };
  }

  const verifiedReceipt = cloneVerifiedEvent(receipt);
  if (!verifiedReceipt) {
    return { ok: false, reason: "receipt-sig" };
  }

  if (verifiedReceipt.pubkey.toLowerCase() !== opts.provider.nostrPubkey.toLowerCase()) {
    return { ok: false, reason: "receipt-pubkey-mismatch" };
  }

  const receiptPTags = getTagEntries(verifiedReceipt.tags, "p");
  const receiptP = getUniqueTagValue(verifiedReceipt.tags, "p");
  if (receiptPTags.length > 1) {
    return { ok: false, reason: "duplicate-receipt-p" };
  }
  if (!receiptP || receiptP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: "receipt-p-mismatch" };
  }

  const descriptionTags = getTagEntries(verifiedReceipt.tags, "description");
  const description = getUniqueTagValue(verifiedReceipt.tags, "description");
  if (descriptionTags.length > 1) {
    return { ok: false, reason: "duplicate-description" };
  }
  if (!description) {
    return { ok: false, reason: "missing-description" };
  }

  const zapRequestError = nip57.validateZapRequest(description);
  if (zapRequestError) {
    return { ok: false, reason: `invalid-zap-request:${zapRequestError}` };
  }

  let parsedZapRequest;
  try {
    parsedZapRequest = JSON.parse(description);
  } catch {
    return { ok: false, reason: "description-json" };
  }

  if (parsedZapRequest.kind !== 9734) {
    return { ok: false, reason: "zap-request-kind" };
  }

  const zapRequest = cloneVerifiedEvent(parsedZapRequest);
  if (!zapRequest) {
    return { ok: false, reason: "zap-request-sig" };
  }

  const requestPTags = getTagEntries(zapRequest.tags, "p");
  const requestP = getUniqueTagValue(zapRequest.tags, "p");
  if (requestPTags.length > 1) {
    return { ok: false, reason: "duplicate-zap-request-p" };
  }
  if (!requestP || requestP.toLowerCase() !== opts.recipientPubkey.toLowerCase()) {
    return { ok: false, reason: "zap-request-p-mismatch" };
  }

  const bolt11Tags = getTagEntries(verifiedReceipt.tags, "bolt11");
  const bolt11 = getUniqueTagValue(verifiedReceipt.tags, "bolt11");
  if (bolt11Tags.length > 1) {
    return { ok: false, reason: "duplicate-bolt11" };
  }
  if (!bolt11) {
    return { ok: false, reason: "missing-bolt11" };
  }
  if (opts.expectedBolt11 && bolt11 !== opts.expectedBolt11) {
    return { ok: false, reason: "bolt11-mismatch" };
  }

  const invoiceAmountMsats = getBolt11AmountMsats(bolt11);
  if (invoiceAmountMsats == null) {
    return { ok: false, reason: "invalid-bolt11-amount" };
  }
  if (!descriptionHashMatches(bolt11, description)) {
    return { ok: false, reason: "description-hash" };
  }

  const amountTags = getTagEntries(zapRequest.tags, "amount");
  if (amountTags.length > 1) {
    return { ok: false, reason: "duplicate-amount" };
  }
  const amountTag = getUniqueTagValue(zapRequest.tags, "amount");
  if (amountTags.length === 1 && !amountTag) {
    return { ok: false, reason: "invalid-amount" };
  }
  if (amountTag) {
    const requestAmount = Number(amountTag);
    if (!Number.isFinite(requestAmount) || requestAmount !== invoiceAmountMsats) {
      return { ok: false, reason: "amount-mismatch" };
    }
  }

  const lnurlTags = getTagEntries(zapRequest.tags, "lnurl");
  if (lnurlTags.length > 1) {
    return { ok: false, reason: "duplicate-lnurl" };
  }
  const requestLnurl = getUniqueTagValue(zapRequest.tags, "lnurl");
  if (lnurlTags.length === 1 && !requestLnurl) {
    return { ok: false, reason: "lnurl-mismatch" };
  }
  if (requestLnurl) {
    const normalized = normalizeLnurlTag(requestLnurl);
    if (!normalized || normalized !== opts.provider.lnurl) {
      return { ok: false, reason: "lnurl-mismatch" };
    }
  }

  const receiptATags = getTagEntries(verifiedReceipt.tags, "a");
  const requestATags = getTagEntries(zapRequest.tags, "a");
  if (receiptATags.length > 1 || requestATags.length > 1) {
    return { ok: false, reason: "duplicate-a" };
  }
  const receiptA = getUniqueTagValue(verifiedReceipt.tags, "a");
  const requestA = getUniqueTagValue(zapRequest.tags, "a");
  if (opts.expectedATag) {
    if (receiptA !== opts.expectedATag || requestA !== opts.expectedATag) {
      return { ok: false, reason: "a-mismatch" };
    }
  } else if (receiptATags.length !== requestATags.length || receiptA !== requestA) {
    return { ok: false, reason: "a-mismatch" };
  }

  return {
    ok: true,
    amountMsats: invoiceAmountMsats,
    zapRequest,
    senderPubkey: senderPubkeyFor(zapRequest),
  };
}
