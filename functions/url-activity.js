// SPDX-License-Identifier: MIT

const HEX_64 = /^[0-9a-f]{64}$/;
const ITEM_LIMIT = 20;
const EVENT_LIMIT = 50;
const VIEWER_LIMIT = 500;
const MAX_BODY_BYTES = 64 * 1024;
const RELAY_CHECK_MS = 3000;
const PROFILE_BUDGET_MS = 3000;
const URL_KINDS = new Set([17, 9735]);

function queryValues(value) {
  if (Array.isArray(value)) return value.flatMap(queryValues);
  if (value === undefined || value === null) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function hex64(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return HEX_64.test(normalized) ? normalized : null;
}

function countOf(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function satsFromMsats(value) {
  return countOf(value) / 1000;
}

export function parseActivityItem(value) {
  const text = String(value || "").trim().toLowerCase();
  const colon = text.indexOf(":");
  if (colon === -1) {
    const urlKey = hex64(text);
    return urlKey ? { urlKey, recipient: null } : null;
  }
  const urlKey = hex64(text.slice(0, colon));
  const recipient = hex64(text.slice(colon + 1));
  if (!urlKey || !recipient) return null;
  return { urlKey, recipient };
}

export function parseActivityItems(value) {
  const tokens = queryValues(value);
  if (!tokens.length) return { error: "invalid_item" };
  if (tokens.length > ITEM_LIMIT) return { error: "too_many_items" };
  const items = [];
  for (const token of tokens) {
    const item = parseActivityItem(token);
    if (!item) return { error: "invalid_item" };
    items.push(item);
  }
  return { items };
}

async function readDoc(ref) {
  const snap = await ref.get();
  return snap.exists ? snap.data() || {} : null;
}

function activityRow(item, url, recipient) {
  const row = {
    urlKey: item.urlKey,
    recipient: item.recipient,
    likes: countOf(url?.likeCount),
    dislikes: countOf(url?.dislikeCount),
    activityAt: Number.isFinite(Number(url?.lastActivityAt)) ? Number(url.lastActivityAt) : null,
    zapCount: null,
    sats: null,
  };
  if (item.recipient) {
    row.zapCount = countOf(recipient?.count);
    row.sats = satsFromMsats(recipient?.msats);
  }
  return row;
}

export async function getUrlActivity(db, parameters = {}) {
  const parsed = parseActivityItems(parameters.item);
  if (parsed.error) return { status: 400, body: { error: parsed.error } };
  const items = await Promise.all(
    parsed.items.map(async (item) => {
      const urlRef = db.collection("nostrUrlActivity").doc(item.urlKey);
      const url = await readDoc(urlRef);
      const recipient = item.recipient
        ? await readDoc(urlRef.collection("recipients").doc(item.recipient))
        : null;
      return activityRow(item, url, recipient);
    }),
  );
  return { status: 200, body: { items } };
}

function eventLimit(value) {
  if (value === undefined || value === "") return EVENT_LIMIT;
  if (Array.isArray(value) || !/^\d+$/.test(String(value))) {
    throw new TypeError("invalid_limit");
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > EVENT_LIMIT) throw new TypeError("invalid_limit");
  return parsed;
}

function zapRow(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    sats: satsFromMsats(data.amountMsats),
    createdAt: Number.isFinite(Number(data.createdAt)) ? Number(data.createdAt) : null,
    senderPubkey: typeof data.senderPubkey === "string" ? data.senderPubkey : null,
    comment: typeof data.comment === "string" ? data.comment : "",
  };
}

function reactionRow(doc) {
  const data = doc.data() || {};
  return {
    pubkey: hex64(data.pubkey) || hex64(doc.id),
    reaction: typeof data.reaction === "string" ? data.reaction : null,
    content: typeof data.content === "string" ? data.content : "",
    eventId: hex64(data.eventId),
    createdAt: Number.isFinite(Number(data.createdAt)) ? Number(data.createdAt) : null,
    urlKey: hex64(data.urlKey),
  };
}

export async function listUrlEvents(db, parameters = {}) {
  const key = hex64(parameters.key);
  if (!key) return { status: 400, body: { error: "invalid_key" } };
  const recipient =
    parameters.recipient === undefined || parameters.recipient === ""
      ? null
      : hex64(parameters.recipient);
  if (parameters.recipient && !recipient) {
    return { status: 400, body: { error: "invalid_recipient" } };
  }
  let limit;
  try {
    limit = eventLimit(parameters.limit);
  } catch {
    return { status: 400, body: { error: "invalid_limit" } };
  }

  let zaps = db.collection("nostrUrlZaps").where("urlKey", "==", key);
  if (recipient) zaps = zaps.where("recipientPubkey", "==", recipient);
  const [zapSnap, reactionSnap] = await Promise.all([
    zaps.orderBy("createdAt", "desc").limit(limit).get(),
    db
      .collection("nostrUrlActivity")
      .doc(key)
      .collection("reactions")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get(),
  ]);
  return {
    status: 200,
    body: {
      zaps: zapSnap.docs.map(zapRow),
      reactions: reactionSnap.docs.map(reactionRow),
    },
  };
}

export async function listViewerReactions(db, parameters = {}) {
  const pubkey = hex64(parameters.pubkey);
  if (!pubkey) return { status: 400, body: { error: "invalid_pubkey" } };
  const snap = await db
    .collectionGroup("reactions")
    .where("pubkey", "==", pubkey)
    .orderBy("createdAt", "desc")
    .limit(VIEWER_LIMIT)
    .get();
  return {
    status: 200,
    body: { reactions: snap.docs.map(reactionRow) },
  };
}

function postedEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!URL_KINDS.has(value.kind)) return null;
  const id = hex64(value.id);
  if (!id) return null;
  return { ...value, id };
}

async function loadModule(packaged, fallback, label) {
  try {
    return await import(packaged);
  } catch (packagedError) {
    try {
      return await import(fallback);
    } catch (fallbackError) {
      throw new Error(
        `Could not load ${label}. Packaged copy: ${errorText(packagedError)}. Repo fallback: ${errorText(fallbackError)}`,
      );
    }
  }
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function defaultRelays() {
  const sweep = await loadModule(
    "./nostr-pulse/sweep.js",
    "../backend/nostr-pulse/sweep.js",
    "the sweep relay set",
  );
  return sweep.loadSweepConfig().relays;
}

async function defaultNormalize() {
  const hints = await loadModule(
    "./nostr-atlas/relay-hints.js",
    "../backend/nostr-atlas/relay-hints.js",
    "relay URL checks",
  );
  return hints.normalizeRelayUrl;
}

async function defaultIngest() {
  const pulse = await loadModule(
    "./nostr-pulse/ingest.js",
    "../backend/nostr-pulse/ingest.js",
    "URL ingest",
  );
  return pulse.ingestUrlEvent;
}

async function defaultEventOnRelay(relay, event, timeoutMs) {
  const network = await loadModule(
    "./nostr-atlas/public-network.js",
    "../backend/nostr-atlas/public-network.js",
    "the relay pool",
  );
  const pool = network.createRelayPool();
  try {
    const found = await pool.querySync(
      [relay],
      { ids: [event.id], kinds: [event.kind] },
      { maxWait: timeoutMs },
    );
    return Array.isArray(found) && found.some((item) => item?.id === event.id);
  } catch {
    return false;
  } finally {
    pool.close([relay]);
  }
}

export async function ingestPushedUrlEvent(db, body = {}, options = {}) {
  const event = postedEvent(body.event);
  if (!event) return { status: 400, body: { ok: false, error: "invalid-event" } };
  const normalize = options.normalizeRelayUrl || (await defaultNormalize());
  const relay = normalize(body.relay);
  const allowed = new Set(options.relays || (await defaultRelays()));
  if (!relay || !allowed.has(relay)) {
    return { status: 400, body: { ok: false, error: "relay-not-covered" } };
  }
  const eventOnRelay = options.eventOnRelay || defaultEventOnRelay;
  const seen = await eventOnRelay(relay, event, options.relayTimeoutMs ?? RELAY_CHECK_MS);
  if (!seen) return { status: 400, body: { ok: false, error: "event-not-on-relay" } };
  const ingest = options.ingestUrlEvent || (await defaultIngest());
  const result = await ingest(
    db,
    event,
    { relay, source: "push" },
    { profileTimeoutMs: PROFILE_BUDGET_MS, ...(options.ingestOptions || {}) },
  );
  return { status: result?.ok ? 200 : 400, body: result };
}

function readHandler(work, failure, { cacheSeconds = 0 } = {}) {
  return async function handleRead(request, response) {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.status(405).json({ error: "method_not_allowed" });
      return;
    }
    try {
      const result = await work(request);
      if (result.status === 200 && cacheSeconds > 0) {
        response.set("Cache-Control", `public, max-age=${cacheSeconds}`);
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error(failure, {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ error: "activity_unavailable" });
    }
  };
}

export function createUrlActivityHandler(db) {
  return readHandler(
    (request) => getUrlActivity(db, request.query),
    "URL activity lookup failed",
    { cacheSeconds: 30 },
  );
}

export function createUrlEventsHandler(db) {
  return readHandler(
    (request) => listUrlEvents(db, request.query),
    "URL event list failed",
  );
}

export function createViewerReactionsHandler(db) {
  return readHandler(
    (request) => listViewerReactions(db, request.query),
    "Viewer reaction list failed",
  );
}

export function createIngestUrlEventHandler(options = {}) {
  return async function handleIngestUrlEvent(request, response) {
    if (request.method !== "POST") {
      response.set("Allow", "POST");
      response.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }
    const rawLength = request.rawBody?.length ?? 0;
    if (rawLength > MAX_BODY_BYTES) {
      response.status(413).json({ ok: false, error: "body-too-large" });
      return;
    }
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      response.status(400).json({ ok: false, error: "invalid-body" });
      return;
    }
    try {
      const db = options.db || (await options.createDb());
      const result = await ingestPushedUrlEvent(db, request.body, options);
      response.set("Cache-Control", "no-store");
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error("URL event ingest failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ ok: false, error: "ingest-unavailable" });
    }
  };
}
