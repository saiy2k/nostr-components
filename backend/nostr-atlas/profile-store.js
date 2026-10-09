// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FieldPath, FieldValue } from "@google-cloud/firestore";
import {
  isValidSignedEvent,
  queryRelay as defaultQueryRelay,
} from "./ingestion.js";
import {
  isOlderKind0,
  kind0ProfileMetadata,
  kind0Timestamp,
} from "./handle-state.js";
import {
  fetchXAvatarUrl,
  httpsPictureUrl,
  upgradeTwitterAvatarUrl,
} from "./picture-url.js";
import { fetchPublicHttps } from "./public-network.js";
import { mergeRelayHints, normalizeRelayUrl } from "./relay-hints.js";
import { DEFAULT_COLLECTIONS, stripUndefined } from "./runtime.js";
import { isHexPubkey } from "./utils.js";

const here = dirname(fileURLToPath(import.meta.url));

export const PROFILE_COLLECTION = "nostrProfiles";
export const RELAY_HEALTH_COLLECTION = "nostrRelayHealth";
export const PROFILE_CURSOR_ID = "profile-refresh";
export const FUTURE_SKEW_SECONDS = 15 * 60;
export const REPLACEABLE_EVENT_CAP = 2000;
export const UNHEALTHY_FAILURES = 3;
export const DIRECTORY_REFRESH_MS = 24 * 60 * 60 * 1000;
export const OTHER_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const UNSETTLED_RETRY_MS = 15 * 60 * 1000;
export const WRITE_RELAY_LIMIT = 3;
export const X_AVATAR_CONCURRENCY = 2;
export const PROFILE_QUERY_TIMEOUT_MS = 8000;

const ROLE_REFRESH_MS = {
  directory: DIRECTORY_REFRESH_MS,
  "url-recipient": OTHER_REFRESH_MS,
  "url-actor": OTHER_REFRESH_MS,
  lookup: OTHER_REFRESH_MS,
};

const LISTING_FIELDS = [
  "name",
  "nip05",
  "picture",
  "lud16",
  "lud06",
  "website",
  "about",
];

function loadRelayRoles() {
  const file = join(here, "../relay-roles.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

const relayRoles = loadRelayRoles();
export const INDEXER_RELAYS = Object.freeze([...(relayRoles.indexers || [])]);
export const PROFILE_ARCHIVES = Object.freeze([
  ...(relayRoles.profileArchives || []),
]);

export function relayHealthId(url) {
  const normalized = normalizeRelayUrl(url);
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export function preferNewerReplaceable(
  current,
  event,
  nowSec = Math.floor(Date.now() / 1000),
) {
  if (!event || event.id == null) return current || null;
  const createdAt = Number(event.created_at);
  if (!Number.isFinite(createdAt)) return current || null;
  if (createdAt > nowSec + FUTURE_SKEW_SECONDS) return current || null;
  if (!current) return event;
  const currentAt = Number(current.created_at);
  if (createdAt > currentAt) return event;
  if (createdAt < currentAt) return current;
  return String(event.id) < String(current.id) ? event : current;
}

export function relayListFromEvent(event) {
  const read = [];
  const write = [];
  for (const tag of event?.tags || []) {
    if (!Array.isArray(tag) || tag[0] !== "r") continue;
    const url = normalizeRelayUrl(tag[1]);
    if (!url) continue;
    const marker = tag[2];
    if (marker === "read") read.push(url);
    else if (marker === "write") write.push(url);
    else if (marker == null || marker === "") {
      read.push(url);
      write.push(url);
    }
  }
  return { readRelays: dedupe(read), writeRelays: dedupe(write) };
}

export function relayIsHealthy(health, url) {
  const row = health?.get?.(url);
  if (!row) return true;
  return Number(row.consecutiveFailures || 0) < UNHEALTHY_FAILURES;
}

export function selectKind0Relays({
  readRelays = [],
  writeRelays = [],
  hints = [],
  archives = PROFILE_ARCHIVES,
  health = new Map(),
  limit = WRITE_RELAY_LIMIT,
} = {}) {
  const normalizeList = (values) =>
    dedupe((values || []).map((url) => normalizeRelayUrl(url)).filter(Boolean));
  const healthy = (url) => relayIsHealthy(health, url);
  const markedWrite = normalizeList(writeRelays);
  const writes = markedWrite.filter(healthy).slice(0, limit);
  const reads =
    markedWrite.length === 0
      ? normalizeList(readRelays).filter(healthy).slice(0, limit)
      : [];
  return dedupe([
    ...normalizeList(archives),
    ...writes,
    ...reads,
    ...normalizeList(hints),
  ]);
}

export function refreshIntervalMs(roles) {
  const known = (Array.isArray(roles) ? roles : []).filter(
    (role) => ROLE_REFRESH_MS[role],
  );
  const list = known.length ? known : ["lookup"];
  return Math.min(...list.map((role) => ROLE_REFRESH_MS[role]));
}

export function zapRecordFromCheck(previous, check) {
  if (!check || check.zapCheckTransient === true) {
    const base =
      previous && typeof previous === "object" && !Array.isArray(previous)
        ? { ...previous }
        : {};
    if (base.zappable == null) base.zappable = null;
    return { ...base, transient: true };
  }
  return {
    lud16: check.lud16 ?? null,
    lnurlp: check.lnurlp ?? null,
    nostrPubkey: check.lnurlNostrPubkey ?? null,
    zappable: check.zappable === true,
    reason: check.zapReason || null,
    transient: false,
    checkedAt: check.zapCheckedAt || new Date().toISOString(),
  };
}

export function contentObject(event) {
  if (!event || typeof event.content !== "string") return {};
  try {
    const content = JSON.parse(event.content);
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      return {};
    }
    return content;
  } catch {
    return {};
  }
}

export function listingMetadataFromKind0(pubkey, content, xPicture) {
  const fields = content ? kind0ProfileMetadata(pubkey, content) : null;
  const metadata = {};
  if (fields) {
    for (const key of LISTING_FIELDS) {
      if (fields[key]) metadata[key] = fields[key];
    }
  }
  const picture = upgradeTwitterAvatarUrl(xPicture) || httpsPictureUrl(xPicture);
  if (!metadata.picture && picture) metadata.xPicture = picture;
  return metadata;
}

export function profileIsDue(profile, nowMs) {
  if (!profile) return true;
  const next = Date.parse(profile.nextRefreshAt || "");
  return !Number.isFinite(next) || next <= nowMs;
}

export function nextProfileDocument(existing, input) {
  const nowSec = input.nowSec ?? Math.floor(input.nowMs / 1000);
  const previousKind0 = parseStoredEvent(existing?.kind0Json);
  const previousList = parseStoredEvent(existing?.relayListJson);
  const chosenKind0 = preferNewerReplaceable(
    previousKind0,
    input.kind0Event,
    nowSec,
  );
  const chosenList = preferNewerReplaceable(
    previousList,
    input.relayListEvent,
    nowSec,
  );
  const roles = unionRoles(existing?.tracked, input.role);
  const interval = refreshIntervalMs(roles);
  const foundKind0 = Boolean(chosenKind0);
  let missingUntil = existing?.missingUntil ?? null;
  let nextRefreshAt;
  if (input.kind0Event) {
    missingUntil = null;
    nextRefreshAt = new Date(input.nowMs + interval).toISOString();
  } else if (input.kind0Settled === true && !previousKind0) {
    missingUntil = new Date(input.nowMs + interval).toISOString();
    nextRefreshAt = missingUntil;
  } else if (input.kind0Settled === true) {
    missingUntil = null;
    nextRefreshAt = new Date(input.nowMs + interval).toISOString();
  } else {
    nextRefreshAt = new Date(input.nowMs + UNSETTLED_RETRY_MS).toISOString();
  }
  const relays = chosenList
    ? relayListFromEvent(chosenList)
    : {
        readRelays: existing?.readRelays || [],
        writeRelays: existing?.writeRelays || [],
      };
  const content = chosenKind0 ? contentObject(chosenKind0) : null;
  return stripUndefined({
    pubkey: input.pubkey,
    kind0Json: chosenKind0 ? JSON.stringify(chosenKind0) : undefined,
    kind0CreatedAt: chosenKind0 ? Number(chosenKind0.created_at) : undefined,
    relayListJson: chosenList ? JSON.stringify(chosenList) : undefined,
    readRelays: relays.readRelays,
    writeRelays: relays.writeRelays,
    relayHints: mergeRelayHints(existing?.relayHints, input.hints),
    display: displayFromContent(input.pubkey, content),
    zap: input.zap,
    tracked: roles,
    fetchedAt: new Date(input.nowMs).toISOString(),
    nextRefreshAt,
    missingUntil,
  });
}

export function applyProfileToHandle(handleData, snapshot) {
  const active = handleData?.activeIdentity;
  if (
    !active ||
    String(active.pubkey || "").toLowerCase() !==
      String(snapshot.pubkey || "").toLowerCase()
  ) {
    return { changed: false, reason: "pubkey-mismatch" };
  }
  const older =
    snapshot.kind0Event &&
    isOlderKind0(active.kind0CreatedAt, snapshot.kind0CreatedAt);
  let metadata = active.metadata || undefined;
  let kind0CreatedAt = active.kind0CreatedAt;
  if (snapshot.kind0Event && !older) {
    const xPicture =
      snapshot.xPicture ||
      (!httpsPictureUrl(snapshot.kind0Content?.picture)
        ? active.metadata?.xPicture
        : null);
    metadata = listingMetadataFromKind0(
      active.pubkey,
      snapshot.kind0Content || {},
      xPicture,
    );
    const incomingAt = kind0Timestamp(snapshot.kind0CreatedAt);
    if (incomingAt != null) kind0CreatedAt = incomingAt;
  } else if (
    !httpsPictureUrl(active.metadata?.picture) &&
    snapshot.xPicture &&
    active.metadata?.xPicture !== snapshot.xPicture
  ) {
    metadata = { ...(active.metadata || {}), xPicture: snapshot.xPicture };
  }
  const sameMetadata =
    stable(metadata || null) === stable(active.metadata || null);
  const sameCreatedAt =
    kind0Timestamp(kind0CreatedAt) === kind0Timestamp(active.kind0CreatedAt);
  if (sameMetadata && sameCreatedAt) {
    return { changed: false, reason: "unchanged" };
  }
  const activeIdentity = stripUndefined({
    ...active,
    metadata,
    kind0CreatedAt,
  });
  const claims = Array.isArray(handleData.claims)
    ? handleData.claims.map((claim) =>
        claim?.claimId === active.claimId
          ? stripUndefined({
              ...claim,
              metadata,
              kind0CreatedAt,
            })
          : claim,
      )
    : handleData.claims;
  return {
    changed: true,
    reason: "updated",
    activeIdentity,
    claims,
  };
}

export async function fetchReplaceableGrouped(groups, kind, options = {}) {
  const query = options.queryRelay || defaultQueryRelay;
  const timeoutMs = options.timeoutMs ?? PROFILE_QUERY_TIMEOUT_MS;
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const health = options.health || new Map();
  const found = new Map();
  const failedAuthors = new Set();
  const queriedAuthors = new Set();
  const entries = [...(groups instanceof Map ? groups.entries() : [])].filter(
    ([url, pubkeys]) => normalizeRelayUrl(url) && pubkeys?.length,
  );
  if (!entries.length) {
    return { byPubkey: found, settled: new Set(), health };
  }
  await mapPool(entries, 8, async ([url, pubkeys]) => {
    const relay = normalizeRelayUrl(url);
    const authors = dedupe(
      pubkeys.map((pubkey) => String(pubkey).toLowerCase()).filter(isHexPubkey),
    );
    for (const pubkey of authors) queriedAuthors.add(pubkey);
    const started = Date.now();
    let relaySettled = authors.length > 0;
    const relayFound = new Map();
    for (const chunk of chunkPubkeys(authors, 40)) {
      const chunkTimeout = boundedTimeout(timeoutMs, options.deadlineMs);
      if (chunkTimeout === 0 && Number.isFinite(options.deadlineMs)) {
        relaySettled = false;
        continue;
      }
      let result;
      try {
        result = await query(
          relay,
          { kinds: [kind], authors: chunk },
          { timeoutMs: chunkTimeout, max: REPLACEABLE_EVENT_CAP },
        );
      } catch {
        result = { events: [], reason: "error" };
      }
      if (result?.reason !== "eose") relaySettled = false;
      if (result?.reason === "max") continue;
      for (const event of result?.events || []) {
        const pubkey = String(event?.pubkey || "").toLowerCase();
        if (!chunk.includes(pubkey) || event.kind !== kind) continue;
        if (!isValidSignedEvent(event)) continue;
        const chosen = preferNewerReplaceable(
          relayFound.get(pubkey),
          event,
          nowSec,
        );
        if (chosen) relayFound.set(pubkey, chosen);
      }
    }
    noteRelayHealth(health, relay, relaySettled, Date.now() - started);
    if (!relaySettled) {
      for (const pubkey of authors) failedAuthors.add(pubkey);
    }
    for (const [pubkey, event] of relayFound) {
      const chosen = preferNewerReplaceable(found.get(pubkey), event, nowSec);
      if (chosen) found.set(pubkey, chosen);
    }
  });
  const settled = new Set(
    [...queriedAuthors].filter((pubkey) => !failedAuthors.has(pubkey)),
  );
  return { byPubkey: found, settled, health };
}

export async function refreshProfiles(db, targets, options = {}) {
  if (typeof options.touchLease === "function") await options.touchLease();
  const nowMs = options.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const health = options.health || new Map();
  const timeoutMs = options.timeoutMs ?? PROFILE_QUERY_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl || fetchPublicHttps;
  const normalized = [];
  const seen = new Set();
  for (const target of targets || []) {
    const pubkey = String(target?.pubkey || "").toLowerCase();
    if (!isHexPubkey(pubkey) || seen.has(pubkey)) continue;
    seen.add(pubkey);
    normalized.push({
      ...target,
      pubkey,
      hints: mergeRelayHints(target.hints),
    });
  }
  if (!normalized.length) return { refreshed: 0, health, handlesChanged: 0 };

  const indexerGroups = new Map();
  const hintRelays = dedupe(
    normalized.flatMap((target) => target.hints).map(normalizeRelayUrl).filter(Boolean),
  );
  const indexerRelays = dedupe(
    [...INDEXER_RELAYS.map(normalizeRelayUrl).filter(Boolean), ...hintRelays],
  );
  await seedRelayHealth(db, indexerRelays, health);
  const liveIndexers = indexerRelays.filter((url) => relayIsHealthy(health, url));
  for (const url of liveIndexers) {
    indexerGroups.set(
      url,
      normalized.map((target) => target.pubkey),
    );
  }
  const listTimeout = boundedTimeout(timeoutMs, options.deadlineMs);
  const lists =
    listTimeout === 0 && Number.isFinite(options.deadlineMs)
      ? { byPubkey: new Map(), settled: new Set(), health }
      : await fetchReplaceableGrouped(indexerGroups, 10002, {
          queryRelay: options.queryRelay,
          timeoutMs,
          deadlineMs: options.deadlineMs,
          nowSec,
          health,
        });

  const kind0Groups = new Map();
  const kind0RelaysByPubkey = new Map();
  for (const target of normalized) {
    const listEvent = lists.byPubkey.get(target.pubkey) || null;
    const parsed = listEvent
      ? relayListFromEvent(listEvent)
      : { readRelays: [], writeRelays: [] };
    const relays = selectKind0Relays({
      ...parsed,
      hints: target.hints,
      health,
    });
    kind0RelaysByPubkey.set(target.pubkey, relays);
    for (const url of relays) {
      const authors = kind0Groups.get(url) || [];
      authors.push(target.pubkey);
      kind0Groups.set(url, authors);
    }
  }
  await seedRelayHealth(db, [...kind0Groups.keys()], health);
  const liveKind0 = new Map(
    [...kind0Groups.entries()].filter(([url]) => relayIsHealthy(health, url)),
  );
  const kind0Timeout = boundedTimeout(timeoutMs, options.deadlineMs);
  const profiles =
    kind0Timeout === 0 && Number.isFinite(options.deadlineMs)
      ? { byPubkey: new Map(), settled: new Set(), health }
      : await fetchReplaceableGrouped(liveKind0, 0, {
          queryRelay: options.queryRelay,
          timeoutMs,
          deadlineMs: options.deadlineMs,
          nowSec,
          health,
        });

  const { checkZapSupport } = await import("./projection.js");
  const existing = new Map();
  await mapPool(normalized, 8, async (target) => {
    const snap = await db.collection(PROFILE_COLLECTION).doc(target.pubkey).get();
    existing.set(target.pubkey, snap.exists ? snap.data() || {} : null);
  });

  const zapByPubkey = new Map();
  await mapPool(normalized, 4, async (target) => {
    const prior = existing.get(target.pubkey);
    const zapTimeout = boundedTimeout(timeoutMs, options.deadlineMs);
    if (zapTimeout === 0 && Number.isFinite(options.deadlineMs)) {
      zapByPubkey.set(target.pubkey, {
        ...(prior?.zap || {}),
        zappable: prior?.zap?.zappable ?? null,
        zapCheckTransient: true,
      });
      return;
    }
    const fetched = profiles.byPubkey.get(target.pubkey) || null;
    const event = preferNewerReplaceable(
      parseStoredEvent(prior?.kind0Json),
      fetched,
      nowSec,
    );
    if (!fetched && !profiles.settled.has(target.pubkey)) {
      zapByPubkey.set(target.pubkey, {
        ...(prior?.zap || {}),
        zappable: prior?.zap?.zappable ?? null,
        zapCheckTransient: true,
      });
      return;
    }
    if (!event) {
      zapByPubkey.set(target.pubkey, {
        lud16: null,
        zappable: false,
        zapReason: "missing-lud16",
        zapCheckedAt: new Date(nowMs).toISOString(),
        zapCheckTransient: false,
      });
      return;
    }
    const content = contentObject(event);
    try {
      zapByPubkey.set(
        target.pubkey,
        await checkZapSupport({ pubkey: target.pubkey }, content, zapTimeout, fetchImpl),
      );
    } catch (error) {
      zapByPubkey.set(target.pubkey, {
        pubkey: target.pubkey,
        lud16: content.lud16 || null,
        zappable: false,
        zapReason: "lnurl-fetch-failed",
        zapCheckedAt: new Date(nowMs).toISOString(),
        zapCheckTransient: true,
        error,
      });
    }
  });

  const avatarTimeout = boundedTimeout(timeoutMs, options.deadlineMs);
  const avatars =
    avatarTimeout === 0 && Number.isFinite(options.deadlineMs)
      ? new Map()
      : await fetchMissingAvatars(normalized, {
          existing,
          profiles: profiles.byPubkey,
          fetchImpl,
          timeoutMs: avatarTimeout,
        });

  const profileWrites = [];
  const handlePlans = [];
  for (const target of normalized) {
    const prior = existing.get(target.pubkey);
    const kind0Event = profiles.byPubkey.get(target.pubkey) || null;
    const relayListEvent = lists.byPubkey.get(target.pubkey) || null;
    const zap = zapRecordFromCheck(prior?.zap, zapByPubkey.get(target.pubkey));
    const document = nextProfileDocument(prior, {
      pubkey: target.pubkey,
      nowMs,
      nowSec,
      kind0Event,
      kind0Settled: profiles.settled.has(target.pubkey),
      relayListEvent,
      hints: target.hints,
      role: target.role || "directory",
      zap,
    });
    profileWrites.push({
      collection: PROFILE_COLLECTION,
      id: target.pubkey,
      data: document,
    });
    if (!target.handleId) continue;
    const xPicture = avatars.get(target.pubkey) || null;
    handlePlans.push({
      handleId: target.handleId,
      snapshot: {
        pubkey: target.pubkey,
        kind0Event,
        kind0CreatedAt: kind0Event ? Number(kind0Event.created_at) : null,
        kind0Content: kind0Event ? contentObject(kind0Event) : null,
        xPicture,
      },
    });
  }
  await commitSets(db, profileWrites, options);
  const handlesChanged = await applyHandlePlans(db, handlePlans, options);
  if (options.flushHealth === true) await flushRelayHealth(db, health, options);
  return {
    refreshed: normalized.length,
    handlesChanged,
    health,
  };
}

export async function runDueProfilePass(db, args, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const limit = args.profileRefreshLimit ?? 40;
  const maxScan = args.profileScanLimit ?? 500;
  const pageSize = Math.min(100, maxScan);
  const handles = args.firestoreHandlesCollection || DEFAULT_COLLECTIONS.handles;
  const runs =
    args.firestoreProjectionRunsCollection || DEFAULT_COLLECTIONS.projectionRuns;
  const health = options.health || new Map();
  const skip = options.skipPubkeys || new Set();
  let afterId = await readProfileCursor(db, runs);
  const targets = [];
  let scanned = 0;
  let wrapped = false;
  while (targets.length < limit && scanned < maxScan) {
    if (typeof options.touchLease === "function") await options.touchLease();
    const page = await readHandlePage(db, handles, afterId, pageSize);
    if (!page.length) {
      if (!afterId || wrapped) break;
      afterId = "";
      wrapped = true;
      continue;
    }
    for (const row of page) {
      afterId = row.id;
      scanned += 1;
      const active = row.data?.activeIdentity;
      if (!isVerifiedDirectoryIdentity(active)) continue;
      const pubkey = String(active.pubkey).toLowerCase();
      if (skip.has(pubkey)) continue;
      const snap = await db.collection(PROFILE_COLLECTION).doc(pubkey).get();
      const profile = snap.exists ? snap.data() || {} : null;
      if (!profileIsDue(profile, nowMs)) continue;
      const claim = (row.data?.claims || []).find(
        (item) => item?.claimId === active.claimId,
      );
      targets.push({
        pubkey,
        hints: mergeRelayHints(active.relayHints, claim?.relayHints),
        handleId: row.id,
        handle: row.data?.handle || active.handle,
        role: "directory",
      });
      if (targets.length >= limit || scanned >= maxScan) break;
    }
    if (page.length < pageSize) {
      afterId = "";
      break;
    }
  }
  await writeProfileCursor(db, runs, afterId, options);
  const refreshed = await refreshProfiles(db, targets, {
    ...options,
    health,
    nowMs,
    handlesCollection: handles,
    flushHealth: false,
  });
  return {
    scanned,
    refreshed: refreshed.refreshed,
    handlesChanged: refreshed.handlesChanged,
    health,
  };
}

export async function flushRelayHealth(db, health, options = {}) {
  const writes = [];
  for (const [url, row] of health || []) {
    if (!row?.touched) continue;
    const id = relayHealthId(url);
    if (!id) continue;
    writes.push({
      collection: RELAY_HEALTH_COLLECTION,
      id,
      data: stripUndefined({
        relay: url,
        consecutiveFailures: Number(row.consecutiveFailures || 0),
        lastOkAt: row.lastOkAt || null,
        lastFailAt: row.lastFailAt || null,
        latencyMs: Number.isFinite(row.latencyMs) ? row.latencyMs : null,
      }),
    });
  }
  await commitSets(db, writes, options);
  return writes.length;
}

async function fetchMissingAvatars(targets, { existing, profiles, fetchImpl, timeoutMs }) {
  const avatars = new Map();
  const pending = [];
  for (const target of targets) {
    if (!target.handle) continue;
    const event = profiles.get(target.pubkey);
    const content = event ? contentObject(event) : null;
    if (httpsPictureUrl(content?.picture)) continue;
    const prior = existing.get(target.pubkey);
    const priorPicture = httpsPictureUrl(prior?.display?.picture);
    if (priorPicture) continue;
    pending.push(target);
  }
  await mapPool(pending, X_AVATAR_CONCURRENCY, async (target) => {
    const avatar = await fetchXAvatarUrl(target.handle, {
      fetchImpl,
      timeoutMs,
    });
    if (avatar) avatars.set(target.pubkey, avatar);
  });
  return avatars;
}

async function applyHandlePlans(db, plans, options) {
  const collection =
    options.handlesCollection || DEFAULT_COLLECTIONS.handles;
  let changed = 0;
  for (const plan of plans) {
    const ref = db.collection(collection).doc(plan.handleId);
    const wrote = await db.runTransaction(async (tx) => {
      const leaseUpdate = await readLeaseUpdate(tx, options);
      const snap = await tx.get(ref);
      writeLeaseUpdate(tx, leaseUpdate);
      if (!snap.exists) return false;
      const data = snap.data() || {};
      const next = applyProfileToHandle(data, plan.snapshot);
      if (!next.changed) return false;
      tx.set(
        ref,
        stripUndefined({
          activeIdentity: next.activeIdentity,
          claims: next.claims,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true },
      );
      return true;
    });
    if (wrote) changed += 1;
  }
  return changed;
}

async function readHandlePage(db, collectionName, afterId, limit) {
  let query = db
    .collection(collectionName)
    .orderBy(FieldPath.documentId())
    .limit(limit);
  if (afterId) query = query.startAfter(afterId);
  const snap = await query.get();
  return (snap.docs || []).map((doc) => ({
    id: doc.id,
    data: doc.data() || {},
  }));
}

async function readProfileCursor(db, runsCollection) {
  try {
    const snap = await db.collection(runsCollection).doc(PROFILE_CURSOR_ID).get();
    return snap.exists ? String(snap.data()?.afterId || "") : "";
  } catch {
    return "";
  }
}

async function writeProfileCursor(db, runsCollection, afterId, options = {}) {
  await commitSets(db, [
    {
      collection: runsCollection,
      id: PROFILE_CURSOR_ID,
      data: {
        afterId: afterId || "",
        updatedAt: new Date().toISOString(),
      },
    },
  ], options);
}

async function seedRelayHealth(db, urls, health) {
  const missing = dedupe(urls.map(normalizeRelayUrl).filter(Boolean)).filter(
    (url) => !health.has(url),
  );
  await mapPool(missing, 8, async (url) => {
    const id = relayHealthId(url);
    if (!id) return;
    try {
      const snap = await db.collection(RELAY_HEALTH_COLLECTION).doc(id).get();
      if (snap.exists) health.set(url, { ...(snap.data() || {}), relay: url });
    } catch {
      // A missing health read just treats the relay as healthy.
    }
  });
}

function noteRelayHealth(health, url, ok, latencyMs) {
  const prior = health.get(url) || {};
  if (prior.touched && (prior.runOk === false || ok)) return;
  const seeded = prior.seededFailures ?? Number(prior.consecutiveFailures || 0);
  health.set(url, {
    relay: url,
    seededFailures: seeded,
    consecutiveFailures: ok ? 0 : seeded + 1,
    lastOkAt: ok ? new Date().toISOString() : prior.lastOkAt || null,
    lastFailAt: ok ? prior.lastFailAt || null : new Date().toISOString(),
    latencyMs: ok ? latencyMs : prior.latencyMs ?? null,
    touched: true,
    runOk: ok,
  });
}

async function readLeaseUpdate(tx, options) {
  if (typeof options.readLease !== "function") return null;
  return options.readLease(tx);
}

function writeLeaseUpdate(tx, leaseUpdate) {
  if (!leaseUpdate?.ref) return;
  tx.set(leaseUpdate.ref, leaseUpdate.data, { merge: true });
}

async function commitSets(db, writes, options = {}) {
  if (!writes.length) return;
  if (typeof options.readLease === "function") {
    for (let index = 0; index < writes.length; index += 400) {
      const chunk = writes.slice(index, index + 400);
      await db.runTransaction(async (tx) => {
        const leaseUpdate = await readLeaseUpdate(tx, options);
        writeLeaseUpdate(tx, leaseUpdate);
        for (const write of chunk) {
          tx.set(db.collection(write.collection).doc(write.id), write.data, {
            merge: true,
          });
        }
      });
    }
    return;
  }
  if (typeof db.batch === "function") {
    let batch = db.batch();
    let count = 0;
    const commit = async () => {
      if (!count) return;
      await batch.commit();
      batch = db.batch();
      count = 0;
    };
    for (const write of writes) {
      batch.set(db.collection(write.collection).doc(write.id), write.data, {
        merge: true,
      });
      count += 1;
      if (count === 400) await commit();
    }
    await commit();
    return;
  }
  for (const write of writes) {
    const ref = db.collection(write.collection).doc(write.id);
    await db.runTransaction(async (tx) => {
      tx.set(ref, write.data, { merge: true });
    });
  }
}

function parseStoredEvent(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const event = JSON.parse(value);
    return event && typeof event === "object" ? event : null;
  } catch {
    return null;
  }
}

function displayFromContent(pubkey, content) {
  const fields = content ? kind0ProfileMetadata(pubkey, content) : null;
  return {
    name: fields?.name || null,
    picture: fields?.picture || null,
    nip05: fields?.nip05 || null,
  };
}

function unionRoles(current, role) {
  const roles = new Set(
    (Array.isArray(current) ? current : []).filter((item) => ROLE_REFRESH_MS[item]),
  );
  if (role && ROLE_REFRESH_MS[role]) roles.add(role);
  if (!roles.size) roles.add("directory");
  return [...roles];
}

function isVerifiedDirectoryIdentity(identity) {
  return identity?.status === "verified" && isHexPubkey(identity.pubkey);
}

function dedupe(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function chunkPubkeys(pubkeys, size) {
  const chunks = [];
  for (let index = 0; index < pubkeys.length; index += size) {
    chunks.push(pubkeys.slice(index, index + size));
  }
  return chunks;
}

function boundedTimeout(timeoutMs, deadlineMs, now = Date.now()) {
  if (!Number.isFinite(deadlineMs)) return timeoutMs;
  return Math.min(timeoutMs, Math.max(0, deadlineMs - now));
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(Math.max(concurrency, 1), items.length);
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => worker()));
  }
  return results;
}

function stable(value) {
  return JSON.stringify(value ?? null);
}
