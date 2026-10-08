// SPDX-License-Identifier: MIT

import { randomUUID } from "node:crypto";
import { FieldPath } from "@google-cloud/firestore";
import { URL_ACTIVITY_COLLECTION } from "./ingest.js";

export const DOMAIN_COLLECTION = "nostrUrlDomains";
export const SWEEP_STATE_COLLECTION = "nostrPulseSweepState";
export const ROLLUP_DOC_ID = "rollup";
export const ROLLUP_PAGE_SIZE = 500;
export const ROLLUP_BATCH_SIZE = 100;
export const ROLLUP_PACE_MS = 1000;
export const PULSE_LEASE_DOC_ID = "lease";
export const PULSE_LEASE_MS = 10 * 60 * 1000;

export const TOTAL_FIELDS = Object.freeze([
  "likeCount",
  "dislikeCount",
  "emojiCount",
  "reactionCount",
  "zapCount",
  "zapMsats",
]);

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyTotals() {
  return {
    likeCount: 0,
    dislikeCount: 0,
    emojiCount: 0,
    reactionCount: 0,
    zapCount: 0,
    zapMsats: 0,
  };
}

export function totalsOf(data) {
  const totals = emptyTotals();
  for (const field of TOTAL_FIELDS) totals[field] = count(data?.[field]);
  return totals;
}

export function addTotals(left, right) {
  const totals = emptyTotals();
  for (const field of TOTAL_FIELDS) {
    totals[field] = count(left?.[field]) + count(right?.[field]);
  }
  return totals;
}

export function diffTotals(next, previous) {
  const totals = emptyTotals();
  for (const field of TOTAL_FIELDS) {
    totals[field] = count(next?.[field]) - count(previous?.[field]);
  }
  return totals;
}

function activityAt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function newerActivity(current, incoming) {
  if (current == null) return incoming;
  if (incoming == null) return current;
  return Math.max(current, incoming);
}

export function blankDomain(domain) {
  return {
    domain,
    urlCount: 0,
    ...emptyTotals(),
    lastActivityAt: null,
    hidden: false,
    inSiteTotals: false,
  };
}

export function blankSite() {
  return { domainCount: 0, ...emptyTotals() };
}

function domainFromDoc(id, data) {
  return {
    domain: data?.domain || id,
    urlCount: count(data?.urlCount),
    ...totalsOf(data),
    lastActivityAt: activityAt(data?.lastActivityAt),
    hidden: data?.hidden === true,
    inSiteTotals: data?.inSiteTotals === true,
  };
}

function siteFromDoc(data) {
  return {
    domainCount: count(data?.domainCount),
    ...totalsOf(data),
    cursorUpdatedAt: data?.cursorUpdatedAt ?? null,
    cursorId: data?.cursorId || null,
  };
}

/**
 * Move one URL's change since its rolled-up snapshot onto its domain.
 * A hidden URL contributes nothing. A hidden domain keeps the change locally
 * and leaves the site-wide totals alone.
 */
export function projectUrl(domain, site, url) {
  const visible = url?.hidden !== true;
  const current = totalsOf(url);
  const previous = totalsOf(url?.rolledUp);
  const wasCounted = url?.inRollup === true;
  const rolledUp = visible ? current : emptyTotals();
  const counted = visible;
  const nextTotals = addTotals(totalsOf(domain), diffTotals(rolledUp, previous));
  const urlCount = Math.max(0, count(domain?.urlCount) + (counted ? 1 : 0) - (wasCounted ? 1 : 0));
  let lastActivityAt = activityAt(domain?.lastActivityAt);
  if (visible) lastActivityAt = newerActivity(lastActivityAt, activityAt(url?.lastActivityAt));

  const domainHidden = domain?.hidden === true;
  const contributingBefore = domain?.inSiteTotals === true;
  const contributingAfter = !domainHidden && urlCount > 0;
  const beforeSite = contributingBefore ? totalsOf(domain) : emptyTotals();
  const afterSite = contributingAfter ? nextTotals : emptyTotals();
  const nextSite = addTotals(totalsOf(site), diffTotals(afterSite, beforeSite));

  return {
    url: { rolledUp, inRollup: counted },
    domain: {
      domain: domain?.domain,
      urlCount,
      ...nextTotals,
      lastActivityAt,
      hidden: domainHidden,
      inSiteTotals: contributingAfter,
    },
    site: {
      ...nextSite,
      domainCount:
        count(site?.domainCount) + (contributingAfter ? 1 : 0) - (contributingBefore ? 1 : 0),
    },
  };
}

/** Take a whole domain into or out of the site-wide totals. Its own totals stay. */
export function projectDomainVisibility(domain, site, hidden) {
  const nextHidden = hidden === true;
  const contributingBefore = domain?.inSiteTotals === true;
  const contributingAfter = !nextHidden && count(domain?.urlCount) > 0;
  const beforeSite = contributingBefore ? totalsOf(domain) : emptyTotals();
  const afterSite = contributingAfter ? totalsOf(domain) : emptyTotals();
  const nextSite = addTotals(totalsOf(site), diffTotals(afterSite, beforeSite));
  return {
    domain: {
      ...domainFromDoc(domain?.domain, domain),
      hidden: nextHidden,
      inSiteTotals: contributingAfter,
    },
    site: {
      ...nextSite,
      domainCount:
        count(site?.domainCount) + (contributingAfter ? 1 : 0) - (contributingBefore ? 1 : 0),
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One writer at a time for domain totals. The sweep rollup and hide.js --rebuild
 * both apply URL snapshots, and a rebuild that commits between those steps can
 * count the same URL twice.
 */
function leaseRef(db) {
  return db.collection(SWEEP_STATE_COLLECTION).doc(PULSE_LEASE_DOC_ID);
}

function leaseIsCurrent(data, nowMs) {
  const until = Date.parse(data?.until || "");
  return Boolean(data?.token) && Number.isFinite(until) && until > nowMs;
}

/**
 * Read the lease before any writes in the same transaction. A matching token
 * is renewed. Any other live token aborts, including after this run's lease
 * has expired and someone else has taken it.
 */
export function renewedLease(data, lease, nowMs) {
  if (!lease?.token || data?.token !== lease.token) {
    throw new Error("pulse-lease-lost");
  }
  return {
    owner: lease.owner,
    token: lease.token,
    until: new Date(nowMs + lease.leaseMs).toISOString(),
  };
}

export async function withPulseLease(db, owner, fn, options = {}) {
  const attempts = options.attempts ?? 1;
  const retryMs = options.retryMs ?? 1000;
  const leaseMs = options.leaseMs ?? PULSE_LEASE_MS;
  const wait = options.sleep || sleep;
  const ref = leaseRef(db);
  const lease = {
    owner,
    token: `${owner}:${randomUUID()}`,
    leaseMs,
    now: () => options.nowMs ?? Date.now(),
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const nowMs = lease.now();
    const acquired = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      if (leaseIsCurrent(data, nowMs) && data.token !== lease.token) return false;
      tx.set(
        ref,
        { owner, token: lease.token, until: new Date(nowMs + leaseMs).toISOString() },
        { merge: true },
      );
      return true;
    });
    if (acquired) {
      try {
        return await fn(lease);
      } finally {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists && snap.data()?.token === lease.token) {
            tx.set(ref, { owner: null, token: null, until: null }, { merge: true });
          }
        });
      }
    }
    if (attempt + 1 < attempts) await wait(retryMs);
  }
  throw new Error("pulse-lease-held");
}

async function readCursor(db) {
  const snap = await db.collection(SWEEP_STATE_COLLECTION).doc(ROLLUP_DOC_ID).get();
  if (!snap.exists) return { cursorUpdatedAt: null, cursorId: null };
  const data = snap.data() || {};
  return {
    cursorUpdatedAt: data.cursorUpdatedAt ?? null,
    cursorId: data.cursorId || null,
  };
}

async function readUrlPage(db, cursor, limit, options = {}) {
  let query = db
    .collection(URL_ACTIVITY_COLLECTION)
    .orderBy("updatedAt")
    .orderBy(FieldPath.documentId())
    .limit(limit);
  if (cursor?.cursorId) {
    // Server timestamps are not a strict commit order. A later write can share
    // the saved timestamp and sort before the saved id, so the first page of a
    // resumed run includes that whole timestamp. Later pages stay exclusive.
    query = options.includeCursorTimestamp
      ? query.startAt(cursor.cursorUpdatedAt)
      : query.startAfter(cursor.cursorUpdatedAt, cursor.cursorId);
  }
  const snap = await query.get();
  return (snap.docs || []).map((doc) => ({
    id: doc.id,
    updatedAt: doc.data()?.updatedAt ?? null,
  }));
}

async function commitBatch(db, page, cursor, lease) {
  const urlCollection = db.collection(URL_ACTIVITY_COLLECTION);
  const domainCollection = db.collection(DOMAIN_COLLECTION);
  const siteRef = db.collection(SWEEP_STATE_COLLECTION).doc(ROLLUP_DOC_ID);
  const held = leaseRef(db);
  return db.runTransaction(async (tx) => {
    const heldSnap = await tx.get(held);
    const urls = [];
    for (const row of page) {
      const snap = await tx.get(urlCollection.doc(row.id));
      urls.push({
        id: row.id,
        exists: snap.exists,
        ...(snap.exists ? snap.data() || {} : {}),
      });
    }
    const domainIds = [...new Set(urls.filter((url) => url.exists && url.domain).map((url) => url.domain))];
    const domainSnaps = new Map();
    for (const domain of domainIds) {
      domainSnaps.set(domain, await tx.get(domainCollection.doc(domain)));
    }
    const siteSnap = await tx.get(siteRef);
    let site = siteSnap.exists ? siteFromDoc(siteSnap.data() || {}) : blankSite();
    const domains = new Map(
      domainIds.map((domain) => {
        const snap = domainSnaps.get(domain);
        return [domain, snap.exists ? domainFromDoc(domain, snap.data() || {}) : blankDomain(domain)];
      }),
    );
    const renewed = renewedLease(
      heldSnap.exists ? heldSnap.data() : {},
      lease,
      lease.now(),
    );
    const urlWrites = [];
    for (const url of urls) {
      if (!url.exists || !url.domain) continue;
      const projected = projectUrl(domains.get(url.domain), site, url);
      domains.set(url.domain, projected.domain);
      site = { ...site, ...projected.site, cursorUpdatedAt: site.cursorUpdatedAt, cursorId: site.cursorId };
      urlWrites.push({ id: url.id, ...projected.url });
    }
    for (const write of urlWrites) {
      tx.set(
        urlCollection.doc(write.id),
        { rolledUp: write.rolledUp, inRollup: write.inRollup },
        { merge: true },
      );
    }
    for (const [domain, data] of domains) {
      tx.set(domainCollection.doc(domain), data, { merge: true });
    }
    const stored = {
      ...totalsOf(site),
      domainCount: count(site.domainCount),
      cursorUpdatedAt: cursor.cursorUpdatedAt ?? null,
      cursorId: cursor.cursorId || null,
    };
    tx.set(held, renewed, { merge: true });
    tx.set(siteRef, stored, { merge: true });
    return stored;
  });
}

/**
 * Fold URL documents changed since the last cursor into domain and site totals.
 * Ingest owns `updatedAt`, so this never writes it. One batch per second keeps
 * a busy domain under Firestore's single-document write rate.
 */
async function rollupUnlocked(db, options, lease) {
  const pageSize = options.pageSize ?? ROLLUP_PAGE_SIZE;
  const batchSize = options.batchSize ?? ROLLUP_BATCH_SIZE;
  const paceMs = options.paceMs ?? ROLLUP_PACE_MS;
  const wait = options.sleep || sleep;
  let cursor = await readCursor(db);
  let batches = 0;
  let urls = 0;
  let paced = false;
  let includeCursorTimestamp = Boolean(cursor?.cursorId);
  while (true) {
    const page = await readUrlPage(db, cursor, pageSize, { includeCursorTimestamp });
    includeCursorTimestamp = false;
    if (!page.length) break;
    for (let index = 0; index < page.length; index += batchSize) {
      const batch = page.slice(index, index + batchSize);
      if (paced && paceMs > 0) await wait(paceMs);
      const last = batch[batch.length - 1];
      cursor = await commitBatch(
        db,
        batch,
        {
          cursorUpdatedAt: last.updatedAt,
          cursorId: last.id,
        },
        lease,
      );
      batches += 1;
      urls += batch.length;
      paced = true;
    }
    if (page.length < pageSize) break;
  }
  return { ...cursor, batches, urls };
}

export async function runRollup(db, options = {}) {
  try {
    return await withPulseLease(db, "rollup", (lease) => rollupUnlocked(db, options, lease), {
      nowMs: options.nowMs,
      leaseMs: options.leaseMs,
      attempts: options.leaseAttempts ?? 1,
      retryMs: options.leaseRetryMs ?? 0,
      sleep: options.sleep,
    });
  } catch (error) {
    if (error?.message !== "pulse-lease-held" && error?.message !== "pulse-lease-lost") {
      throw error;
    }
    console.log(JSON.stringify({
      severity: "WARNING",
      message: "rollup_skipped",
      reason: error.message,
    }));
    return { skipped: true, reason: error.message, urls: 0, batches: 0 };
  }
}
