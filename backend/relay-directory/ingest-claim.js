// SPDX-License-Identifier: MIT

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvent, verifyEvent } from "nostr-tools";
import {
  directoryHandleId,
  extractIdentityClaims,
  planDirectoryHandleWrites,
} from "./directory-state.js";
import { verifyHandleClaims } from "./projection.js";
import {
  applyProjectionResults,
  buildHandleProjectionWrites,
} from "./projection-state.js";
import { commitFirestoreWrites, DEFAULT_COLLECTIONS } from "./runtime.js";
import { normalizeTwitterHandle } from "./utils.js";

const here = dirname(fileURLToPath(import.meta.url));

export function canonicalClaimRelay(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (
    url.protocol !== "wss:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    return null;
  }
  url.pathname = "/";
  url.hash = "";
  return url.toString();
}

export function loadIngestRelayUrls(env = process.env) {
  if (env.CLAIM_RELAYS !== undefined && String(env.CLAIM_RELAYS).trim()) {
    return String(env.CLAIM_RELAYS)
      .split(",")
      .map((relay) => relay.trim())
      .filter(Boolean);
  }
  const bundled = join(here, "relays.json");
  const repoCopy = join(here, "../relays.json");
  const file = existsSync(bundled) ? bundled : repoCopy;
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data)) {
    throw new Error("relays.json must be a JSON array.");
  }
  return data
    .map((entry) =>
      typeof entry === "string" ? entry : String(entry?.url || ""),
    )
    .filter(Boolean);
}

function allowedRelays(relays) {
  return new Set(
    relays.map((relay) => canonicalClaimRelay(relay)).filter(Boolean),
  );
}

function claimEvent(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: value.id,
    pubkey: value.pubkey,
    created_at: value.created_at,
    kind: value.kind,
    tags: value.tags,
    content: value.content,
    sig: value.sig,
  };
}

function projectionArgs(config, collection) {
  return {
    timeoutMs: config.timeoutMs ?? 12_000,
    verifyTweets: config.verifyTweets !== false,
    checkZaps: config.checkZaps === true,
    projectionExternalRetryMs:
      config.projectionExternalRetryMs ?? 15 * 60 * 1000,
    maxPendingClaims: config.maxPendingClaims ?? 20,
    maxInactiveVerifiedClaims: config.maxInactiveVerifiedClaims ?? 10,
    maxRejectionTombstones: config.maxRejectionTombstones ?? 100,
    maxRetryAttempts: config.maxRetryAttempts ?? 5,
    firestoreHandlesCollection: collection,
  };
}

function statusForClaim(data, claimId) {
  if (
    data?.activeIdentity?.claimId === claimId &&
    data.activeIdentity.status === "verified"
  ) {
    return "verified";
  }
  const claim = (data?.claims || []).find((item) => item?.claimId === claimId);
  if (claim?.status === "verified") return "verified";
  if (claim?.status === "pending") return "pending";
  if (
    (data?.rejectedClaimTombstones || []).some(
      (item) => item?.claimId === claimId,
    )
  ) {
    return "rejected";
  }
  return "pending";
}

function claimRetryIsStillPending(claim, nowMs) {
  if (!claim || claim.status !== "pending" || claim.retryAt == null) {
    return false;
  }
  const retryAtMs = Date.parse(claim.retryAt);
  return Number.isFinite(retryAtMs) && retryAtMs > nowMs;
}

async function projectHandle(db, handle, claimId, collection, config) {
  const id = directoryHandleId(handle);
  const ref = db.collection(collection).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return "pending";
  const data = snapshot.data() || {};
  const nowMs = config.now instanceof Date ? config.now.getTime() : Date.now();
  const current = (data.claims || []).find((item) => item?.claimId === claimId);
  if (claimRetryIsStillPending(current, nowMs)) {
    return statusForClaim(data, claimId);
  }
  const verify = config.verifyHandleClaims || verifyHandleClaims;
  const args = projectionArgs(config, collection);
  const verification = await verify(snapshot.data() || {}, args, {
    proofsRemaining: 1,
  });
  const projectionOptions = {
    retryDelayMs: args.projectionExternalRetryMs,
    maxPendingClaims: args.maxPendingClaims,
    maxInactiveVerifiedClaims: args.maxInactiveVerifiedClaims,
    maxRejectionTombstones: args.maxRejectionTombstones,
    maxRetryAttempts: args.maxRetryAttempts,
    deferReason: verification.deferReason,
    attemptedClaimIds: verification.attemptedClaimIds,
  };
  const committed = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(ref);
    const fresh = freshSnap.exists ? freshSnap.data() || {} : {};
    const transition = applyProjectionResults(
      fresh,
      verification.results,
      projectionOptions,
    );
    const writes = buildHandleProjectionWrites(
      { id, data: fresh },
      transition,
      args,
    );
    for (const write of writes) {
      tx.set(db.collection(write.collection).doc(write.id), write.data, {
        merge: true,
      });
    }
    return transition.state;
  });
  return statusForClaim(committed, claimId);
}

export async function ingestPublishedClaim(db, input = {}, config = {}) {
  const event = claimEvent(input.event);
  if (!event || event.kind !== 10011) {
    return { ok: false, error: "invalid-event" };
  }
  try {
    if (!validateEvent(event) || !verifyEvent(event)) {
      return { ok: false, error: "invalid-event" };
    }
  } catch {
    return { ok: false, error: "invalid-event" };
  }

  const relay = canonicalClaimRelay(input.relay);
  const allowed = allowedRelays(
    config.relays || loadIngestRelayUrls(config.env),
  );
  if (!relay || !allowed.has(relay)) {
    return { ok: false, error: "relay-not-covered" };
  }

  const claims = await extractIdentityClaims(
    [event],
    relay,
    config.now || new Date(),
    {
      mentionValidationCache: new Map(),
      xMentionCheckTimeoutMs: config.timeoutMs ?? 8_000,
    },
  );
  if (claims.length === 0) {
    return { ok: false, error: "no-claim" };
  }

  const collection =
    config.firestoreHandlesCollection || DEFAULT_COLLECTIONS.handles;
  const planned = await planDirectoryHandleWrites(db, claims, {
    firestoreHandlesCollection: collection,
    maxPendingClaims: config.maxPendingClaims ?? 20,
    maxInactiveVerifiedClaims: config.maxInactiveVerifiedClaims ?? 10,
    maxRejectionTombstones: config.maxRejectionTombstones ?? 100,
  });
  if (planned.writes.length > 0) {
    await commitFirestoreWrites(db, planned.writes);
  }

  const requested = normalizeTwitterHandle(input.handle);
  const primary = requested
    ? claims.find((claim) => claim.handle === requested)
    : claims.length === 1
      ? claims[0]
      : null;
  if (!primary) return { ok: false, error: "no-claim" };
  let status = "pending";
  try {
    status = await projectHandle(
      db,
      primary.handle,
      primary.claimId,
      collection,
      config,
    );
  } catch (error) {
    console.warn(
      `Claim projection failed: ${error instanceof Error ? error.message : error}`,
    );
    status = "pending";
  }

  return { ok: true, handle: primary.handle, status };
}
