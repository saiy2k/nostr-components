// SPDX-License-Identifier: MIT

const HEX_64 = /^[0-9a-f]{64}$/;
const PUBKEY_LIMIT = 50;
const FETCH_LIMIT = 10;
const FRESH_MS = 10 * 60 * 1000;
const MISS_MS = 60 * 60 * 1000;
const PROFILE_BUDGET_MS = 3000;

function queryValues(value) {
  if (Array.isArray(value)) return value.flatMap(queryValues);
  if (value === undefined || value === null) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function freshRequested(value) {
  if (Array.isArray(value)) return value.some((item) => item === "1");
  return value === "1";
}

export function parseProfilePubkeys(value) {
  const tokens = queryValues(value);
  if (!tokens.length) return { error: "invalid_pubkey" };
  const pubkeys = [];
  const seen = new Set();
  for (const token of tokens) {
    const pubkey = token.toLowerCase();
    if (!HEX_64.test(pubkey)) return { error: "invalid_pubkey" };
    if (seen.has(pubkey)) continue;
    seen.add(pubkey);
    pubkeys.push(pubkey);
    if (pubkeys.length > PUBKEY_LIMIT) return { error: "too_many_pubkeys" };
  }
  return { pubkeys };
}

function storedEvent(value, kind) {
  if (!value || typeof value !== "string") return null;
  try {
    const event = JSON.parse(value);
    if (!event || typeof event !== "object" || Array.isArray(event)) return null;
    if (event.kind !== kind) return null;
    return event;
  } catch {
    return null;
  }
}

export function profileLookupView(pubkey, data) {
  const zap = data?.zap;
  let zappable = null;
  if (zap?.zappable === true) zappable = true;
  else if (zap?.zappable === false) zappable = false;
  return {
    pubkey,
    profileEvent: storedEvent(data?.kind0Json, 0),
    relayListEvent: storedEvent(data?.relayListJson, 10002),
    zappable,
  };
}

function zapCheckFinished(zap) {
  return zap?.zappable === true || zap?.zappable === false;
}

export function profileNeedsFetch(data, nowMs, fresh) {
  const fetchedAt = Date.parse(data?.fetchedAt || "");
  const ageMs = Number.isFinite(fetchedAt) ? nowMs - fetchedAt : Infinity;
  if (fresh) return ageMs > FRESH_MS;
  if (data?.kind0Json && zapCheckFinished(data.zap)) return false;
  const missingUntil = Date.parse(data?.missingUntil || "");
  const rememberedMiss =
    !data?.kind0Json &&
    Number.isFinite(missingUntil) &&
    missingUntil > nowMs &&
    ageMs <= MISS_MS;
  return !rememberedMiss;
}

async function readProfiles(db, pubkeys, collection) {
  const stored = new Map();
  await Promise.all(
    pubkeys.map(async (pubkey) => {
      const snap = await db.collection(collection).doc(pubkey).get();
      stored.set(pubkey, snap.exists ? snap.data() || {} : null);
    }),
  );
  return stored;
}

async function loadProfileStore() {
  try {
    return await import("./nostr-atlas/profile-store.js");
  } catch (packagedError) {
    try {
      return await import("../backend/nostr-atlas/profile-store.js");
    } catch (fallbackError) {
      throw new Error(
        `Could not load the profile store. Packaged copy: ${errorText(packagedError)}. Repo fallback: ${errorText(fallbackError)}`,
      );
    }
  }
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function lookupNostrProfiles(db, parameters = {}, options = {}) {
  const parsed = parseProfilePubkeys(parameters.pubkeys);
  if (parsed.error) return { status: 400, body: { error: parsed.error } };
  const fresh = freshRequested(parameters.fresh);
  if (fresh && parsed.pubkeys.length !== 1) {
    return { status: 400, body: { error: "fresh_requires_one" } };
  }

  const collection = options.profilesCollection || "nostrProfiles";
  const nowMs = options.nowMs ?? Date.now();
  const stored = await readProfiles(db, parsed.pubkeys, collection);
  const pending = parsed.pubkeys.filter((pubkey) =>
    profileNeedsFetch(stored.get(pubkey), nowMs, fresh),
  );
  const batch = pending.slice(0, FETCH_LIMIT);
  if (batch.length) {
    const refresh =
      options.refreshProfiles || (await loadProfileStore()).refreshProfiles;
    await refresh(
      db,
      batch.map((pubkey) => ({ pubkey, role: "lookup" })),
      {
        timeoutMs: PROFILE_BUDGET_MS,
        nowMs,
        ...(options.refreshOptions || {}),
      },
    );
    const again = await readProfiles(db, batch, collection);
    for (const [pubkey, data] of again) stored.set(pubkey, data);
  }

  return {
    status: 200,
    body: {
      profiles: parsed.pubkeys.map((pubkey) =>
        profileLookupView(pubkey, stored.get(pubkey)),
      ),
    },
  };
}

export function createProfileLookupHandler(options = {}) {
  return async function handleProfileLookup(request, response) {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.status(405).json({ error: "method_not_allowed" });
      return;
    }
    try {
      const db = options.db || (await options.createDb());
      const result = await lookupNostrProfiles(db, request.query, options);
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error("Profile lookup failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ error: "profiles_unavailable" });
    }
  };
}
