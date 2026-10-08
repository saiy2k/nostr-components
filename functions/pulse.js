// SPDX-License-Identifier: MIT

const DAY_SECONDS = 24 * 60 * 60;
const TABLE_LIMIT = 50;
const TABLE_READ = 200;
const ACTIVITY_LIMIT = 30;
const SCAN_PAGES = 20;
const HIDDEN_CACHE_MS = 5 * 60 * 1000;
const DOMAIN_PATTERN = /^[a-z0-9.-]+$/;

const TOTAL_FIELDS = [
  "likeCount",
  "dislikeCount",
  "emojiCount",
  "reactionCount",
  "zapCount",
  "zapMsats",
];

const OVERVIEW_SORTS = {
  zapmsats: "zapMsats",
  sats: "zapMsats",
  zapcount: "zapCount",
  zaps: "zapCount",
  reactioncount: "reactionCount",
  reactions: "reactionCount",
  dislikecount: "dislikeCount",
  dislikes: "dislikeCount",
  emojicount: "emojiCount",
  emoji: "emojiCount",
  lastactivityat: "lastActivityAt",
  lastactive: "lastActivityAt",
};

const URL_SORTS = {
  zapmsats: "zapMsats",
  sats: "zapMsats",
  zapcount: "zapCount",
  zaps: "zapCount",
  reactioncount: "reactionCount",
  reactions: "reactionCount",
  lastactivityat: "lastActivityAt",
  lastactive: "lastActivityAt",
};

const sharedHiddenCache = { at: 0, domains: new Set(), urlKeys: new Set() };

function count(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function storedCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstQuery(value) {
  if (Array.isArray(value)) return value.length ? value[0] : "";
  return value ?? "";
}

function totalsOf(data) {
  const totals = {};
  for (const field of TOTAL_FIELDS) totals[field] = storedCount(data?.[field]);
  return totals;
}

function activityAt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSort(value, allowed, fallback) {
  const token = String(firstQuery(value)).trim();
  if (!token) return { field: fallback };
  const field = allowed[token.toLowerCase()];
  if (!field) return { error: "invalid_sort" };
  return { field };
}

function parseDomain(value, { required = false } = {}) {
  const domain = String(firstQuery(value)).trim().toLowerCase().replace(/^www\./, "");
  if (!domain) return required ? { error: "invalid_domain" } : { domain: "" };
  if (
    domain.length > 253 ||
    !DOMAIN_PATTERN.test(domain) ||
    domain.startsWith(".") ||
    (required && domain.endsWith(".")) ||
    domain.includes("..")
  ) {
    return { error: required ? "invalid_domain" : "invalid_search" };
  }
  return { domain };
}

function parseDays(value) {
  const token = String(firstQuery(value)).trim();
  if (!["1", "7", "30"].includes(token)) return { error: "invalid_days" };
  return { days: Number(token) };
}

export function createHiddenCache() {
  return { at: 0, domains: new Set(), urlKeys: new Set() };
}

async function hiddenIndex(db, nowMs, cache) {
  if (cache.at && nowMs - cache.at < HIDDEN_CACHE_MS) return cache;
  const [domains, urls] = await Promise.all([
    db.collection("nostrUrlDomains").where("hidden", "==", true).get(),
    db.collection("nostrUrlActivity").where("hidden", "==", true).get(),
  ]);
  cache.at = nowMs;
  cache.domains = new Set((domains.docs || []).map((doc) => doc.id));
  cache.urlKeys = new Set((urls.docs || []).map((doc) => doc.id));
  return cache;
}

function rowsOf(snap) {
  return (snap.docs || []).map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

/**
 * Ordered reads include hidden rows. Keep scanning until the visible page is
 * full. The cap bounds a public request when hidden rows run on.
 */
async function readVisibleRows(loadPage, keep, limit) {
  const visible = [];
  let cursor = null;
  const scanCap = limit * SCAN_PAGES;
  let scanned = 0;
  while (visible.length < limit && scanned < scanCap) {
    const pageSize = Math.min(limit, scanCap - scanned);
    const snap = await loadPage(cursor, pageSize);
    const docs = snap.docs || [];
    if (!docs.length) break;
    scanned += docs.length;
    for (const doc of docs) {
      const row = { id: doc.id, ...(doc.data() || {}) };
      if (keep(row)) visible.push(row);
      if (visible.length >= limit) return visible;
    }
    if (docs.length < pageSize) break;
    cursor = docs[docs.length - 1];
  }
  return visible;
}

function domainHidden(row, hidden) {
  return row.hidden === true || hidden.domains.has(row.domain || row.id);
}

function urlHidden(row, hidden) {
  return row.hidden === true || hidden.urlKeys.has(row.id) || hidden.domains.has(row.domain);
}

function byFieldDesc(field) {
  return (left, right) => {
    const delta = storedCount(right[field]) - storedCount(left[field]);
    if (delta) return delta;
    return String(left.domain || left.id).localeCompare(String(right.domain || right.id));
  };
}

function domainRow(row) {
  return {
    domain: row.domain || row.id,
    urlCount: storedCount(row.urlCount),
    lastActivityAt: activityAt(row.lastActivityAt),
    ...totalsOf(row),
  };
}

function urlRow(row) {
  return {
    url: typeof row.url === "string" ? row.url : "",
    urlKey: row.id,
    lastActivityAt: activityAt(row.lastActivityAt),
    ...totalsOf(row),
  };
}

function zapRow(row) {
  return {
    id: row.id,
    sats: count(row.amountMsats) / 1000,
    createdAt: activityAt(row.createdAt),
    senderPubkey: typeof row.senderPubkey === "string" ? row.senderPubkey : null,
    comment: typeof row.comment === "string" ? row.comment : "",
    url: typeof row.url === "string" ? row.url : "",
    domain: typeof row.domain === "string" ? row.domain : "",
  };
}

function reactionRow(row) {
  return {
    pubkey: typeof row.pubkey === "string" ? row.pubkey : row.id,
    reaction: typeof row.reaction === "string" ? row.reaction : null,
    content: typeof row.content === "string" ? row.content : "",
    createdAt: activityAt(row.createdAt),
    urlKey: typeof row.urlKey === "string" ? row.urlKey : null,
    url: typeof row.url === "string" ? row.url : "",
    domain: typeof row.domain === "string" ? row.domain : "",
  };
}

async function siteTotals(db) {
  const snap = await db.collection("nostrPulseSweepState").doc("rollup").get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    domainCount: storedCount(data.domainCount),
    ...totalsOf(data),
  };
}

export async function getPulseOverview(db, parameters = {}, options = {}) {
  const sort = parseSort(parameters.sort, OVERVIEW_SORTS, "reactionCount");
  if (sort.error) return { status: 400, body: { error: sort.error } };
  const search = parseDomain(parameters.search);
  if (search.error) return { status: 400, body: { error: search.error } };
  const nowMs = options.nowMs ?? Date.now();
  const hidden = await hiddenIndex(db, nowMs, options.hiddenCache || sharedHiddenCache);
  const totals = await siteTotals(db);
  let domains;
  if (search.domain) {
    const end = `${search.domain}\uf8ff`;
    const snap = await db
      .collection("nostrUrlDomains")
      .where("domain", ">=", search.domain)
      .where("domain", "<=", end)
      .orderBy("domain")
      .limit(TABLE_READ)
      .get();
    domains = rowsOf(snap)
      .filter((row) => !domainHidden(row, hidden))
      .sort(byFieldDesc(sort.field))
      .slice(0, TABLE_LIMIT);
  } else {
    domains = await readVisibleRows(
      (cursor, pageSize) => {
        let query = db.collection("nostrUrlDomains").orderBy(sort.field, "desc");
        if (cursor) query = query.startAfter(cursor);
        return query.limit(pageSize).get();
      },
      (row) => !domainHidden(row, hidden),
      TABLE_LIMIT,
    );
  }
  return { status: 200, body: { totals, domains: domains.map(domainRow) } };
}

export async function getPulseDomain(db, parameters = {}, options = {}) {
  const domain = parseDomain(parameters.domain, { required: true });
  if (domain.error) return { status: 400, body: { error: domain.error } };
  const sort = parseSort(parameters.sort, URL_SORTS, "zapMsats");
  if (sort.error) return { status: 400, body: { error: sort.error } };
  const nowMs = options.nowMs ?? Date.now();
  const hidden = await hiddenIndex(db, nowMs, options.hiddenCache || sharedHiddenCache);
  const snap = await db.collection("nostrUrlDomains").doc(domain.domain).get();
  if (!snap.exists || snap.data()?.hidden === true || hidden.domains.has(domain.domain)) {
    return { status: 404, body: { error: "not_found" } };
  }
  const data = snap.data() || {};
  const urls = await readVisibleRows(
    (cursor, pageSize) => {
      let query = db
        .collection("nostrUrlActivity")
        .where("domain", "==", domain.domain)
        .orderBy(sort.field, "desc");
      if (cursor) query = query.startAfter(cursor);
      return query.limit(pageSize).get();
    },
    (row) => !urlHidden(row, hidden),
    TABLE_LIMIT,
  );
  return {
    status: 200,
    body: {
      domain: domain.domain,
      totals: {
        urlCount: storedCount(data.urlCount),
        lastActivityAt: activityAt(data.lastActivityAt),
        ...totalsOf(data),
      },
      urls: urls.map(urlRow),
    },
  };
}

function activityRows(collection, { domain, since }, keep) {
  return readVisibleRows(
    (cursor, pageSize) => {
      let query = collection;
      if (domain) query = query.where("domain", "==", domain);
      query = query.where("createdAt", ">=", since).orderBy("createdAt", "desc");
      if (cursor) query = query.startAfter(cursor);
      return query.limit(pageSize).get();
    },
    keep,
    ACTIVITY_LIMIT,
  );
}

export async function listPulseActivity(db, parameters = {}, options = {}) {
  const days = parseDays(parameters.days);
  if (days.error) return { status: 400, body: { error: days.error } };
  const domain = parseDomain(parameters.domain);
  if (domain.error) return { status: 400, body: { error: "invalid_domain" } };
  const nowMs = options.nowMs ?? Date.now();
  const since = Math.floor(nowMs / 1000) - days.days * DAY_SECONDS;
  const hidden = await hiddenIndex(db, nowMs, options.hiddenCache || sharedHiddenCache);
  if (domain.domain && hidden.domains.has(domain.domain)) {
    return { status: 200, body: { zaps: [], reactions: [] } };
  }
  const keep = (row, kind) => {
    if (row.createdAt == null || row.createdAt < since) return false;
    if (hidden.domains.has(row.domain)) return false;
    if (kind === "zap") return !hidden.urlKeys.has(row.urlKey);
    return !hidden.urlKeys.has(row.urlKey) && row.hidden !== true;
  };
  const [zaps, reactions] = await Promise.all([
    activityRows(
      db.collection("nostrUrlZaps"),
      { domain: domain.domain, since },
      (row) => keep(row, "zap"),
    ),
    activityRows(
      db.collectionGroup("reactions"),
      { domain: domain.domain, since },
      (row) => keep(row, "reaction"),
    ),
  ]);
  return {
    status: 200,
    body: {
      zaps: zaps.map(zapRow),
      reactions: reactions.map(reactionRow),
    },
  };
}

function readHandler(work, failure) {
  return async function handlePulse(request, response) {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.status(405).json({ error: "method_not_allowed" });
      return;
    }
    try {
      const result = await work(request);
      if (result.status === 200) response.set("Cache-Control", "public, max-age=60");
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error(failure, {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ error: "pulse_unavailable" });
    }
  };
}

export function createPulseOverviewHandler(db, options = {}) {
  return readHandler(
    (request) => getPulseOverview(db, request.query, options),
    "Pulse overview failed",
  );
}

export function createPulseDomainHandler(db, options = {}) {
  return readHandler(
    (request) => getPulseDomain(db, request.query, options),
    "Pulse domain failed",
  );
}

export function createPulseActivityHandler(db, options = {}) {
  return readHandler(
    (request) => listPulseActivity(db, request.query, options),
    "Pulse activity failed",
  );
}
