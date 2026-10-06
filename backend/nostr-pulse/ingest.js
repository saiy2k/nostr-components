// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { validateEvent, verifyEvent } from "nostr-tools";
import { canonicalUrl, urlKey as urlKeyFor } from "./url-key.js";
import { validateZapReceipt } from "./zap-receipt.js";
import {
  PROFILE_COLLECTION,
  refreshProfiles,
} from "../nostr-atlas/profile-store.js";
import { isHexPubkey } from "../nostr-atlas/utils.js";

export const URL_ACTIVITY_COLLECTION = "nostrUrlActivity";
export const URL_ZAPS_COLLECTION = "nostrUrlZaps";
export const PROVIDER_FRESH_MS = 24 * 60 * 60 * 1000;
export const INGEST_SOURCES = new Set(["push", "sweep", "web-pulse-import"]);

const COUNT_FIELD = {
  like: "likeCount",
  dislike: "dislikeCount",
  emoji: "emojiCount",
};

const URL_A_KIND = "39735";

export function reactionBucket(content) {
  if (content === "+" || content === "") return "like";
  if (content === "-") return "dislike";
  return "emoji";
}

/**
 * Higher created_at wins. A tie goes to the higher id.
 * Same rule as netLikesByPubkey.
 */
export function preferNewerReaction(current, candidate) {
  if (!current) return candidate || null;
  if (!candidate) return current;
  if (candidate.created_at > current.created_at) return candidate;
  if (candidate.created_at < current.created_at) return current;
  return candidate.id > current.id ? candidate : current;
}

export function domainFromCanonical(canonical) {
  return new URL(canonical).hostname.replace(/^www\./, "");
}

export function providerIsFresh(zap, nowMs, maxAgeMs = PROVIDER_FRESH_MS) {
  if (!zap || typeof zap.zappable !== "boolean") return false;
  if (zap.zappable === true && !isHexPubkey(zap.nostrPubkey)) return false;
  const checked = Date.parse(zap.checkedAt || "");
  return Number.isFinite(checked) && nowMs >= checked && nowMs - checked < maxAgeMs;
}

export function applyReactionChange(totals, previousBucket, nextBucket) {
  const next = {
    likeCount: numberOrZero(totals?.likeCount),
    dislikeCount: numberOrZero(totals?.dislikeCount),
    emojiCount: numberOrZero(totals?.emojiCount),
  };
  if (previousBucket && previousBucket !== nextBucket && COUNT_FIELD[previousBucket]) {
    next[COUNT_FIELD[previousBucket]] = Math.max(
      0,
      next[COUNT_FIELD[previousBucket]] - 1,
    );
  }
  if ((!previousBucket || previousBucket !== nextBucket) && COUNT_FIELD[nextBucket]) {
    next[COUNT_FIELD[nextBucket]] += 1;
  }
  next.reactionCount = next.likeCount + next.dislikeCount + next.emojiCount;
  return next;
}

/**
 * Store one kind 17 or kind 9735 URL event.
 * Returns the URL activity afterwards. A repeat is a no-op.
 * `updatedAt` is a server timestamp so a later rollup can page in commit order.
 */
export async function ingestUrlEvent(db, event, meta = {}, options = {}) {
  if (!INGEST_SOURCES.has(meta.source)) {
    return rejected("invalid-source");
  }
  if (event?.kind === 17) return ingestReaction(db, event, meta);
  if (event?.kind === 9735) return ingestReceipt(db, event, meta, options);
  return rejected("unsupported-kind");
}

async function ingestReaction(db, event, meta) {
  if (!signatureOk(event)) return rejected("event-sig");
  const parsed = parseWebReaction(event);
  if (!parsed.ok) return rejected(parsed.reason);
  const pubkey = event.pubkey.toLowerCase();
  const bucket = reactionBucket(event.content);
  const urlRef = db.collection(URL_ACTIVITY_COLLECTION).doc(parsed.urlKey);
  const reactionRef = urlRef.collection("reactions").doc(pubkey);
  return db.runTransaction(async (tx) => {
    const urlSnap = await tx.get(urlRef);
    const reactionSnap = await tx.get(reactionRef);
    const currentUrl = urlSnap.exists ? urlSnap.data() || {} : {};
    const current = reactionSnap.exists ? reactionSnap.data() || {} : null;
    const candidate = { id: event.id, created_at: event.created_at };
    const stored = current
      ? { id: current.eventId, created_at: current.createdAt }
      : null;
    if (preferNewerReaction(stored, candidate) !== candidate) {
      return {
        ok: true,
        stored: false,
        reason: null,
        retry: false,
        activity: activityView(parsed, currentUrl),
      };
    }
    const counts = applyReactionChange(currentUrl, current?.reaction || null, bucket);
    const lastActivityAt = nextActivityAt(currentUrl.lastActivityAt, event.created_at);
    const written = urlDocument(parsed, {
      ...counts,
      zapCount: numberOrZero(currentUrl.zapCount),
      zapMsats: numberOrZero(currentUrl.zapMsats),
      lastActivityAt,
    });
    tx.set(urlRef, written, { merge: true });
    tx.set(reactionRef, {
      eventId: event.id,
      content: event.content,
      reaction: bucket,
      createdAt: event.created_at,
      eventJson: eventJson(event),
      source: meta.source,
      url: parsed.url,
      urlKey: parsed.urlKey,
      domain: parsed.domain,
    });
    return {
      ok: true,
      stored: true,
      reason: null,
      retry: false,
      activity: activityView(parsed, written),
    };
  });
}

async function ingestReceipt(db, event, meta, options) {
  if (!signatureOk(event)) return rejected("receipt-sig");
  const parsed = parseReceiptUrlTag(event);
  if (!parsed.ok) return rejected(parsed.reason);

  const provider = await providerFor(db, parsed.recipientPubkey, options);
  if (provider.retry) {
    return rejected(provider.reason, !options.giveUpOnProvider);
  }
  if (provider.zap?.zappable !== true || !isHexPubkey(provider.zap?.nostrPubkey)) {
    return rejected(provider.reason || "provider-not-zappable");
  }

  const validated = validateZapReceipt(event, {
    provider: {
      nostrPubkey: provider.zap.nostrPubkey,
      lnurl: provider.zap.lnurlp,
    },
    recipientPubkey: parsed.recipientPubkey,
    expectedATag: parsed.aTag,
  });
  if (!validated.ok) return rejected(validated.reason);

  const urlRef = db.collection(URL_ACTIVITY_COLLECTION).doc(parsed.urlKey);
  const recipientRef = urlRef.collection("recipients").doc(parsed.recipientPubkey);
  const zapRef = db.collection(URL_ZAPS_COLLECTION).doc(event.id);
  return db.runTransaction(async (tx) => {
    const zapSnap = await tx.get(zapRef);
    const urlSnap = await tx.get(urlRef);
    const recipientSnap = await tx.get(recipientRef);
    const currentUrl = urlSnap.exists ? urlSnap.data() || {} : {};
    if (zapSnap.exists) {
      return {
        ok: true,
        stored: false,
        reason: null,
        retry: false,
        descriptionHashMismatch: validated.descriptionHashMismatch === true,
        activity: activityView(parsed, currentUrl),
      };
    }
    const previous = recipientSnap.exists ? recipientSnap.data() || {} : {};
    const amount = validated.amountMsats;
    const lastActivityAt = nextActivityAt(currentUrl.lastActivityAt, event.created_at);
    const written = urlDocument(parsed, {
      likeCount: numberOrZero(currentUrl.likeCount),
      dislikeCount: numberOrZero(currentUrl.dislikeCount),
      emojiCount: numberOrZero(currentUrl.emojiCount),
      reactionCount: numberOrZero(currentUrl.reactionCount),
      zapCount: numberOrZero(currentUrl.zapCount) + 1,
      zapMsats: numberOrZero(currentUrl.zapMsats) + amount,
      lastActivityAt,
    });
    tx.set(urlRef, written, { merge: true });
    tx.set(
      recipientRef,
      {
        count: numberOrZero(previous.count) + 1,
        msats: numberOrZero(previous.msats) + amount,
        lastAt: Math.max(numberOrZero(previous.lastAt), event.created_at),
      },
      { merge: true },
    );
    tx.set(zapRef, {
      urlKey: parsed.urlKey,
      url: parsed.url,
      domain: parsed.domain,
      aTag: parsed.aTag,
      recipientPubkey: parsed.recipientPubkey,
      senderPubkey: validated.senderPubkey
        ? validated.senderPubkey.toLowerCase()
        : null,
      amountMsats: amount,
      comment: validated.zapRequest.content || "",
      createdAt: event.created_at,
      providerPubkey: event.pubkey.toLowerCase(),
      receiptJson: eventJson(event),
      source: meta.source,
      relay: meta.relay || null,
    });
    return {
      ok: true,
      stored: true,
      reason: null,
      retry: false,
      descriptionHashMismatch: validated.descriptionHashMismatch === true,
      activity: activityView(parsed, written),
    };
  });
}

export function parseWebReaction(event) {
  const kTag = firstTag(event, "k");
  if (kTag !== "web") return { ok: false, reason: "not-web" };
  const rawUrl = firstTag(event, "i");
  if (!rawUrl) return { ok: false, reason: "missing-i" };
  return pageTarget(rawUrl);
}

export function parseReceiptUrlTag(event) {
  const aTags = tagValues(event, "a");
  if (aTags.length > 1) return { ok: false, reason: "duplicate-a" };
  const aTag = aTags[0];
  if (!aTag || !aTag.startsWith(`${URL_A_KIND}:`)) {
    return { ok: false, reason: "not-url-receipt" };
  }
  const first = aTag.indexOf(":");
  const second = aTag.indexOf(":", first + 1);
  if (second === -1) return { ok: false, reason: "invalid-a-tag" };
  const recipientPubkey = aTag.slice(first + 1, second);
  if (!isHexPubkey(recipientPubkey)) {
    return { ok: false, reason: "invalid-recipient" };
  }
  const target = pageTarget(aTag.slice(second + 1));
  if (!target.ok) return target;
  return {
    ...target,
    aTag,
    recipientPubkey: recipientPubkey.toLowerCase(),
  };
}

async function providerFor(db, pubkey, options) {
  const nowMs = options.nowMs ?? Date.now();
  const existing = await readZap(db, pubkey);
  if (providerIsFresh(existing, nowMs)) return { zap: existing };
  const refresh = options.refreshProfiles || refreshProfiles;
  try {
    await refresh(
      db,
      [{ pubkey, role: "url-recipient" }],
      {
        nowMs,
        queryRelay: options.queryRelay,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.profileTimeoutMs,
        health: options.health,
      },
    );
  } catch {
    return { retry: true, reason: "provider-unavailable" };
  }
  const zap = await readZap(db, pubkey);
  if (zap?.zappable === true && isHexPubkey(zap.nostrPubkey) && zap.transient !== true) {
    return { zap };
  }
  if (zap?.zappable === false && zap.transient !== true) {
    return { reason: "provider-not-zappable" };
  }
  return { retry: true, reason: "provider-unavailable" };
}

async function readZap(db, pubkey) {
  const snap = await db.collection(PROFILE_COLLECTION).doc(pubkey).get();
  if (!snap.exists) return null;
  return snap.data()?.zap || null;
}

function pageTarget(rawUrl) {
  const url = canonicalUrl(rawUrl);
  if (!url) return { ok: false, reason: "invalid-url" };
  return {
    ok: true,
    url,
    urlKey: urlKeyFor(url),
    domain: domainFromCanonical(url),
  };
}

function urlDocument(parsed, fields) {
  return {
    url: parsed.url,
    domain: parsed.domain,
    likeCount: fields.likeCount,
    dislikeCount: fields.dislikeCount,
    emojiCount: fields.emojiCount,
    reactionCount: fields.reactionCount,
    zapCount: fields.zapCount,
    zapMsats: fields.zapMsats,
    lastActivityAt: fields.lastActivityAt,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function activityView(parsed, data) {
  return {
    urlKey: parsed.urlKey,
    url: parsed.url,
    domain: parsed.domain,
    likeCount: numberOrZero(data.likeCount),
    dislikeCount: numberOrZero(data.dislikeCount),
    emojiCount: numberOrZero(data.emojiCount),
    reactionCount: numberOrZero(data.reactionCount),
    zapCount: numberOrZero(data.zapCount),
    zapMsats: numberOrZero(data.zapMsats),
    lastActivityAt: Number.isFinite(Number(data.lastActivityAt))
      ? Number(data.lastActivityAt)
      : null,
  };
}

function rejected(reason, retry = false) {
  return { ok: false, stored: false, reason, retry, activity: null };
}

function nextActivityAt(existing, createdAt) {
  const previous = Number(existing);
  if (!Number.isFinite(previous)) return createdAt;
  return Math.max(previous, createdAt);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function firstTag(event, name) {
  const values = tagValues(event, name);
  return values[0] || null;
}

function tagValues(event, name) {
  if (!Array.isArray(event?.tags)) return [];
  const values = [];
  for (const tag of event.tags) {
    if (Array.isArray(tag) && tag[0] === name && typeof tag[1] === "string" && tag[1]) {
      values.push(tag[1]);
    }
  }
  return values;
}

function signatureOk(event) {
  if (!event || typeof event !== "object") return false;
  const copy = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: Array.isArray(event.tags)
      ? event.tags.map((tag) => (Array.isArray(tag) ? [...tag] : tag))
      : event.tags,
    content: event.content,
    sig: event.sig,
  };
  try {
    return validateEvent(copy) && verifyEvent(copy);
  } catch {
    return false;
  }
}

function eventJson(event) {
  return JSON.stringify({
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.sig,
  });
}
