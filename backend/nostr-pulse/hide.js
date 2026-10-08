#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { canonicalUrl, urlKey } from "./url-key.js";
import { URL_ACTIVITY_COLLECTION, domainFromCanonical } from "./ingest.js";
import {
  createFirestore,
  runMain,
  terminateFirestore,
} from "../nostr-atlas/runtime.js";
import {
  DOMAIN_COLLECTION,
  ROLLUP_DOC_ID,
  SWEEP_STATE_COLLECTION,
  addTotals,
  blankDomain,
  blankSite,
  diffTotals,
  emptyTotals,
  projectDomainVisibility,
  projectUrl,
  PULSE_LEASE_DOC_ID,
  renewedLease,
  totalsOf,
  withPulseLease,
} from "./rollup.js";

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseHideArgs(argv) {
  const unknown = argv.find(
    (arg) => arg.startsWith("--") && arg !== "--" && arg !== "--show" && arg !== "--rebuild",
  );
  if (unknown) return { error: `unknown-flag:${unknown}` };
  const show = argv.includes("--show");
  const rebuild = argv.includes("--rebuild");
  const rest = argv.filter((arg) => arg !== "--" && !arg.startsWith("--"));
  if (show && rebuild) return { error: "rebuild-or-show" };
  if (rest.length !== 1) return { error: "missing-target" };
  return { show, rebuild, target: rest[0] };
}

export function parseHideTarget(raw) {
  const text = String(raw || "").trim();
  if (!text) return { error: "missing-target" };
  if (/^https?:\/\//i.test(text)) {
    const url = canonicalUrl(text);
    if (!url) return { error: "invalid-url" };
    return {
      type: "url",
      url,
      urlKey: urlKey(url),
      domain: domainFromCanonical(url),
    };
  }
  const domain = text.toLowerCase().replace(/^www\./, "");
  if (
    !domain ||
    domain.length > 253 ||
    !/^[a-z0-9.-]+$/.test(domain) ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return { error: "invalid-domain" };
  }
  return { type: "domain", domain };
}

function siteFields(data) {
  return {
    domainCount: count(data?.domainCount),
    ...totalsOf(data),
    cursorUpdatedAt: data?.cursorUpdatedAt ?? null,
    cursorId: data?.cursorId || null,
  };
}

function domainFields(id, data) {
  if (!data) return blankDomain(id);
  return {
    domain: data.domain || id,
    urlCount: count(data.urlCount),
    ...totalsOf(data),
    lastActivityAt: Number.isFinite(Number(data.lastActivityAt)) ? Number(data.lastActivityAt) : null,
    hidden: data.hidden === true,
    inSiteTotals: data.inSiteTotals === true,
  };
}

async function readSite(tx, db) {
  const ref = db.collection(SWEEP_STATE_COLLECTION).doc(ROLLUP_DOC_ID);
  const snap = await tx.get(ref);
  return { ref, data: snap.exists ? siteFields(snap.data() || {}) : { ...blankSite(), cursorUpdatedAt: null, cursorId: null } };
}

function writeSite(tx, ref, previous, site) {
  tx.set(
    ref,
    {
      ...totalsOf(site),
      domainCount: count(site.domainCount),
      cursorUpdatedAt: previous.cursorUpdatedAt ?? null,
      cursorId: previous.cursorId || null,
    },
    { merge: true },
  );
}

async function setTargetHiddenUnlocked(db, target, hidden) {
  if (target?.type === "domain") return setDomainHidden(db, target.domain, hidden);
  if (target?.type === "url") return setUrlHidden(db, target, hidden);
  return { ok: false, reason: "invalid-target" };
}

export async function setTargetHidden(db, target, hidden, options = {}) {
  return withPulseLease(
    db,
    "hide",
    () => setTargetHiddenUnlocked(db, target, hidden),
    {
      attempts: options.attempts ?? 60,
      retryMs: options.retryMs ?? 1000,
      sleep: options.sleep,
      nowMs: options.nowMs,
      leaseMs: options.leaseMs,
    },
  );
}

export function rollupMarkerForRebuild(snapshot, current) {
  if ((snapshot?.hidden === true) !== (current?.hidden === true)) return null;
  const visible = current?.hidden !== true;
  return {
    rolledUp: visible ? totalsOf(snapshot) : emptyTotals(),
    inRollup: visible,
  };
}

function latestVisibleActivity(urls, exceptId) {
  let latest = null;
  for (const url of urls) {
    if (url.id === exceptId || url.hidden === true) continue;
    const at = Number(url.lastActivityAt);
    if (!Number.isFinite(at)) continue;
    latest = latest == null ? at : Math.max(latest, at);
  }
  return latest;
}

async function setUrlHidden(db, target, hidden) {
  const siblings = hidden === true ? await urlsForDomain(db, target.domain) : [];
  const urlRef = db.collection(URL_ACTIVITY_COLLECTION).doc(target.urlKey);
  const domainRef = db.collection(DOMAIN_COLLECTION).doc(target.domain);
  return db.runTransaction(async (tx) => {
    const urlSnap = await tx.get(urlRef);
    if (!urlSnap.exists) return { ok: false, reason: "not-found" };
    const domainSnap = await tx.get(domainRef);
    const site = await readSite(tx, db);
    const url = { id: target.urlKey, ...(urlSnap.data() || {}), hidden: hidden === true };
    const domain = domainSnap.exists
      ? domainFields(target.domain, domainSnap.data() || {})
      : blankDomain(target.domain);
    const projected = projectUrl(domain, site.data, url);
    if (hidden === true) {
      projected.domain.lastActivityAt = latestVisibleActivity(siblings, target.urlKey);
    }
    tx.set(
      urlRef,
      { hidden: hidden === true, rolledUp: projected.url.rolledUp, inRollup: projected.url.inRollup },
      { merge: true },
    );
    tx.set(domainRef, projected.domain, { merge: true });
    writeSite(tx, site.ref, site.data, projected.site);
    return {
      ok: true,
      hidden: hidden === true,
      urlKey: target.urlKey,
      domain: target.domain,
      ...projected.site,
    };
  });
}

async function setDomainHidden(db, domain, hidden) {
  const domainRef = db.collection(DOMAIN_COLLECTION).doc(domain);
  return db.runTransaction(async (tx) => {
    const domainSnap = await tx.get(domainRef);
    if (!domainSnap.exists) return { ok: false, reason: "not-found" };
    const site = await readSite(tx, db);
    const current = domainFields(domain, domainSnap.data() || {});
    const projected = projectDomainVisibility(current, site.data, hidden === true);
    tx.set(domainRef, projected.domain, { merge: true });
    writeSite(tx, site.ref, site.data, projected.site);
    return { ok: true, hidden: hidden === true, domain, ...projected.site };
  });
}

async function urlsForDomain(db, domain) {
  const snap = await db.collection(URL_ACTIVITY_COLLECTION).where("domain", "==", domain).get();
  return (snap.docs || []).map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

/**
 * Recompute one domain from its visible URLs and correct the site-wide totals
 * by the difference. Holds the pulse lease so a sweep rollup cannot commit
 * between the read and the rollup-marker writes.
 */
async function rebuildUnlocked(db, name, lease) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await rebuildPass(db, name, lease);
    } catch (error) {
      lastError = error;
      if (error?.message === "pulse-lease-lost") throw error;
    }
  }
  throw lastError;
}

async function rebuildPass(db, name, lease) {
  const urls = await urlsForDomain(db, name);
  const visible = urls.filter((url) => url.hidden !== true);
  const summed = visible.reduce((totals, url) => addTotals(totals, totalsOf(url)), emptyTotals());
  let lastActivityAt = null;
  for (const url of visible) {
    const at = Number(url.lastActivityAt);
    if (!Number.isFinite(at)) continue;
    lastActivityAt = lastActivityAt == null ? at : Math.max(lastActivityAt, at);
  }
  const domainRef = db.collection(DOMAIN_COLLECTION).doc(name);
  const held = db.collection(SWEEP_STATE_COLLECTION).doc(PULSE_LEASE_DOC_ID);
  const chunk = 100;
  for (let index = 0; index < urls.length; index += chunk) {
    const slice = urls.slice(index, index + chunk);
    await db.runTransaction(async (tx) => {
      const heldSnap = await tx.get(held);
      const fresh = [];
      for (const url of slice) {
        const ref = db.collection(URL_ACTIVITY_COLLECTION).doc(url.id);
        fresh.push({ url, ref, snap: await tx.get(ref) });
      }
      const renewed = renewedLease(heldSnap.exists ? heldSnap.data() : {}, lease, lease.now());
      tx.set(held, renewed, { merge: true });
      for (const row of fresh) {
        if (!row.snap.exists) continue;
        const marker = rollupMarkerForRebuild(row.url, row.snap.data() || {});
        if (!marker) continue;
        tx.set(row.ref, marker, { merge: true });
      }
    });
  }
  const result = await db.runTransaction(async (tx) => {
    const heldSnap = await tx.get(held);
    const domainSnap = await tx.get(domainRef);
    const site = await readSite(tx, db);
    const current = domainSnap.exists ? domainFields(name, domainSnap.data() || {}) : blankDomain(name);
    const contributingBefore = current.inSiteTotals === true;
    const contributingAfter = current.hidden !== true && visible.length > 0;
    const beforeSite = contributingBefore ? totalsOf(current) : emptyTotals();
    const afterSite = contributingAfter ? summed : emptyTotals();
    const nextSite = addTotals(totalsOf(site.data), diffTotals(afterSite, beforeSite));
    const nextDomain = {
      domain: name,
      urlCount: visible.length,
      ...summed,
      lastActivityAt,
      hidden: current.hidden === true,
      inSiteTotals: contributingAfter,
    };
    const storedSite = {
      ...nextSite,
      domainCount:
        count(site.data.domainCount) + (contributingAfter ? 1 : 0) - (contributingBefore ? 1 : 0),
    };
    const renewed = renewedLease(
      heldSnap.exists ? heldSnap.data() : {},
      lease,
      lease.now(),
    );
    tx.set(held, renewed, { merge: true });
    tx.set(domainRef, nextDomain, { merge: true });
    writeSite(tx, site.ref, site.data, storedSite);
    return { ok: true, domain: name, urls: urls.length, ...storedSite };
  });
  return result;
}

export async function rebuildDomain(db, domain, options = {}) {
  const parsed = parseHideTarget(domain);
  const name = parsed.type === "domain" ? parsed.domain : null;
  if (!name) return { ok: false, reason: parsed.error || "rebuild-needs-domain" };
  return withPulseLease(db, "rebuild", (lease) => rebuildUnlocked(db, name, lease), {
    attempts: options.attempts ?? 60,
    retryMs: options.retryMs ?? 1000,
    sleep: options.sleep,
    nowMs: options.nowMs,
    leaseMs: options.leaseMs,
  });
}

function firestoreTarget() {
  const firestoreProject =
    process.env.FIRESTORE_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    null;
  if (!firestoreProject) {
    throw new Error("FIRESTORE_PROJECT or GOOGLE_CLOUD_PROJECT is required.");
  }
  return {
    firestoreProject,
    firestoreDatabase: process.env.FIRESTORE_DATABASE || "(default)",
  };
}

runMain(import.meta.url, async () => {
  const args = parseHideArgs(process.argv.slice(2));
  if (args.error) throw new Error(args.error);
  const target = parseHideTarget(args.target);
  if (target.error) throw new Error(target.error);
  if (args.rebuild && target.type !== "domain") {
    throw new Error("rebuild-needs-domain");
  }
  const db = await createFirestore(firestoreTarget());
  try {
    const result = args.rebuild
      ? await rebuildDomain(db, target.domain)
      : await setTargetHidden(db, target, !args.show);
    if (!result.ok) throw new Error(result.reason || "hide-failed");
    console.log(JSON.stringify({ severity: "INFO", message: "pulse_hide", ...result }));
  } finally {
    await terminateFirestore(db);
  }
});
