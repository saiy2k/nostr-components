// SPDX-License-Identifier: MIT

import { FieldPath } from "@google-cloud/firestore";
import { URL_ACTIVITY_COLLECTION } from "./ingest.js";

export const DOMAIN_COLLECTION = "nostrUrlDomains";
export const SWEEP_STATE_COLLECTION = "nostrPulseSweepState";
export const ROLLUP_DOC_ID = "rollup";
export const ROLLUP_PAGE_SIZE = 500;
export const ROLLUP_BATCH_SIZE = 100;
export const ROLLUP_PACE_MS = 1000;

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

async function readCursor(db) {
  const snap = await db.collection(SWEEP_STATE_COLLECTION).doc(ROLLUP_DOC_ID).get();
  if (!snap.exists) return { cursorUpdatedAt: null, cursorId: null };
  const data = snap.data() || {};
  return {
    cursorUpdatedAt: data.cursorUpdatedAt ?? null,
    cursorId: data.cursorId || null,
  };
}

async function readUrlPage(db, cursor, limit) {
  let query = db
    .collection(URL_ACTIVITY_COLLECTION)
    .orderBy("updatedAt")
    .orderBy(FieldPath.documentId())
    .limit(limit);
  if (cursor?.cursorId) {
    query = query.startAfter(cursor.cursorUpdatedAt, cursor.cursorId);
  }
  const snap = await query.get();
  return (snap.docs || []).map((doc) => ({
    id: doc.id,
    updatedAt: doc.data()?.updatedAt ?? null,
  }));
}

async function commitBatch(db, page, cursor) {
  const urlCollection = db.collection(URL_ACTIVITY_COLLECTION);
  const domainCollection = db.collection(DOMAIN_COLLECTION);
  const siteRef = db.collection(SWEEP_STATE_COLLECTION).doc(ROLLUP_DOC_ID);
  return db.runTransaction(async (tx) => {
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
    tx.set(siteRef, stored, { merge: true });
    return stored;
  });
}

/**
 * Fold URL documents changed since the last cursor into domain and site totals.
 * Ingest owns `updatedAt`, so this never writes it. One batch per second keeps
 * a busy domain under Firestore's single-document write rate.
 */
export async function runRollup(db, options = {}) {
  const pageSize = options.pageSize ?? ROLLUP_PAGE_SIZE;
  const batchSize = options.batchSize ?? ROLLUP_BATCH_SIZE;
  const paceMs = options.paceMs ?? ROLLUP_PACE_MS;
  const wait = options.sleep || sleep;
  let cursor = await readCursor(db);
  let batches = 0;
  let urls = 0;
  let paced = false;
  while (true) {
    const page = await readUrlPage(db, cursor, pageSize);
    if (!page.length) break;
    for (let index = 0; index < page.length; index += batchSize) {
      const batch = page.slice(index, index + batchSize);
      if (paced && paceMs > 0) await wait(paceMs);
      const last = batch[batch.length - 1];
      cursor = await commitBatch(db, batch, {
        cursorUpdatedAt: last.updatedAt,
        cursorId: last.id,
      });
      batches += 1;
      urls += batch.length;
      paced = true;
    }
    if (page.length < pageSize) break;
  }
  return { ...cursor, batches, urls };
}
