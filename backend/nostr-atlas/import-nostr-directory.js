#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import { FieldValue } from "@google-cloud/firestore";
import { nip19 } from "nostr-tools";
import { listingKeyForHandle } from "./featured-handles.js";
import { handleDocumentId } from "./handle-state.js";
import { stripUndefined, createFirestore, terminateFirestore } from "./runtime.js";
import {
  DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS,
  compareClaimsNewestFirst,
  isHexPubkey,
  normalizeTwitterHandle,
} from "./utils.js";

const BATCH_LIMIT = 450;

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== "string" || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function loadDirectoryClaims(records) {
  const byHandle = new Map();
  let skippedHandle = 0;
  let skippedKey = 0;
  for (const record of records) {
    const data = record?.data || {};
    if (data.verified !== true || record.collection !== "twitter") continue;
    const handle = normalizeTwitterHandle(data.screenName || data.userName);
    const pubkey = String(data.hexPubKey || "").trim().toLowerCase();
    if (!handle) {
      skippedHandle += 1;
      continue;
    }
    if (!isHexPubkey(pubkey)) {
      skippedKey += 1;
      continue;
    }
    const documentId = String(record.document_id ?? "").trim();
    if (!documentId) {
      skippedKey += 1;
      continue;
    }
    const claim = directoryClaim(record, handle, pubkey);
    const claims = byHandle.get(handle) || [];
    claims.push(claim);
    byHandle.set(handle, claims);
  }
  return {
    byHandle,
    skippedHandle,
    skippedKey,
  };
}

function directoryClaim(record, handle, pubkey) {
  const data = record.data;
  const documentId = String(record.document_id).trim();
  const proofPublishedAt = unixSeconds(data.createdAt || record.document_created_at);
  const verifyEvent = String(data.verifyEvent || "");
  return stripUndefined({
    claimId: `nd:${documentId}`,
    platform: "twitter",
    handle,
    pubkey,
    npub: nip19.npubEncode(pubkey),
    proofTweetId: digitString(data.id_str),
    sources: ["nostr.directory"],
    evidence: [
      {
        source: "nostr.directory",
        value: documentId,
      },
    ],
    status: "verified",
    verificationMethods: ["nostr.directory"],
    proofSource: "nostr.directory",
    verifiedAt: isoString(data.verifiedAt) || record.document_created_at,
    proofPublishedAt,
    sourceCreatedAt: unixSeconds(record.document_created_at),
    sourceEventId: /^[0-9a-f]{64}$/i.test(verifyEvent)
      ? verifyEvent.toLowerCase()
      : undefined,
    xUserId: digitString(data.userId || data.user?.id_str),
    signatureVerified: false,
  });
}

export function planDirectoryImport(existing, incomingClaims) {
  const current = existing || {};
  const rejected = new Set(
    (current.rejectedClaimTombstones || [])
      .map((item) => item?.claimId)
      .filter(Boolean),
  );
  for (const claim of current.claims || []) {
    if (claim?.status === "rejected" && claim.claimId) {
      rejected.add(claim.claimId);
    }
  }
  const claimsById = new Map();
  for (const claim of current.claims || []) {
    if (claim?.claimId && claim.status !== "rejected") {
      claimsById.set(claim.claimId, claim);
    }
  }
  let added = 0;
  for (const claim of incomingClaims) {
    if (rejected.has(claim.claimId) || claimsById.has(claim.claimId)) continue;
    claimsById.set(claim.claimId, claim);
    added += 1;
  }
  if (!added) return { changed: false, added: 0 };

  const relayActive = relayVerifiedIdentity(current.activeIdentity);
  const verified = [...claimsById.values()]
    .filter((claim) => claim.status === "verified" && isHexPubkey(claim.pubkey))
    .sort(compareClaimsNewestFirst);
  const activeIdentity = relayActive || verified[0] || null;
  const pending = [...claimsById.values()]
    .filter((claim) => claim.status === "pending")
    .sort(compareClaimsNewestFirst);
  const inactiveVerified = verified
    .filter((claim) => claim.claimId !== activeIdentity?.claimId)
    .slice(0, DEFAULT_MAX_INACTIVE_VERIFIED_CLAIMS);
  const claims = [activeIdentity, ...pending, ...inactiveVerified]
    .filter(Boolean)
    .sort(compareClaimsNewestFirst);
  const retainedIds = new Set(claims.map((claim) => claim.claimId));
  const existingIds = new Set(
    (current.claims || [])
      .filter((claim) => claim?.claimId && claim.status !== "rejected")
      .map((claim) => claim.claimId),
  );
  const retainedAdded = incomingClaims.filter(
    (claim) => retainedIds.has(claim.claimId) && !existingIds.has(claim.claimId),
  ).length;
  if (!retainedAdded) return { changed: false, added: 0 };

  return {
    changed: true,
    added: retainedAdded,
    keptRelayIdentity: Boolean(relayActive),
    activePubkey: activeIdentity?.pubkey || null,
    data: stripUndefined({
      platform: "twitter",
      handle: incomingClaims[0]?.handle,
      listingKey: listingKeyForHandle(incomingClaims[0]?.handle),
      activeIdentity,
      claims,
      pendingClaimCount: pending.length,
      projectionStatus: pending.length
        ? current.projectionStatus || "pending"
        : "complete",
      nextAttemptAt: pending.length ? current.nextAttemptAt : null,
      createdAt: existing ? undefined : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function relayVerifiedIdentity(active) {
  if (!active?.claimId || active.status !== "verified") return null;
  if (!isHexPubkey(active.pubkey)) return null;
  if (String(active.claimId).startsWith("nd:")) return null;
  if (
    Array.isArray(active.verificationMethods) &&
    active.verificationMethods.length &&
    active.verificationMethods.every((method) => method === "nostr.directory")
  ) {
    return null;
  }
  return active;
}

function unixSeconds(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function isoString(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function digitString(value) {
  const text = String(value ?? "");
  return /^\d{2,}$/.test(text) ? text : undefined;
}

function parseArgs(argv) {
  const options = {
    accounts: "",
    limit: BATCH_LIMIT,
    dryRun: false,
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--accounts") {
      options.accounts = optionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--limit") {
      options.limit = Number(optionValue(argv, i, arg));
      i += 1;
    } else if (arg === "--project") {
      options.project = optionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--dry-run") options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.accounts) throw new Error("--accounts is required.");
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > BATCH_LIMIT) {
    throw new Error(`--limit must be an integer from 1 to ${BATCH_LIMIT}.`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const records = JSON.parse(await readFile(options.accounts, "utf8"));
  const loaded = loadDirectoryClaims(records);
  const handles = [...loaded.byHandle.keys()].sort();
  const db = await createFirestore({
    firestoreProject: options.project,
    firestoreDatabase: options.database,
  });

  const writes = [];
  const stats = {
    handlesConsidered: 0,
    alreadyPresent: 0,
    created: 0,
    merged: 0,
    keptRelayIdentity: 0,
    multiPubkeyHandles: 0,
  };
  try {
    for (let index = 0; index < handles.length && writes.length < options.limit; index += 100) {
      const slice = handles.slice(index, index + 100);
      const refs = slice.map((handle) =>
        db.collection(options.collection).doc(handleDocumentId(handle)),
      );
      const snapshots = await db.getAll(...refs);
      stats.handlesConsidered += slice.length;
      for (const snapshot of snapshots) {
        if (writes.length >= options.limit) break;
        const handle = snapshot.id.slice("twitter:".length);
        const incoming = loaded.byHandle.get(handle) || [];
        if (incoming.length > 1) stats.multiPubkeyHandles += 1;
        const existing = snapshot.exists ? snapshot.data() || {} : null;
        const planned = planDirectoryImport(existing, incoming);
        if (!planned.changed) {
          stats.alreadyPresent += 1;
          continue;
        }
        if (existing) stats.merged += 1;
        else stats.created += 1;
        if (planned.keptRelayIdentity) stats.keptRelayIdentity += 1;
        writes.push({
          id: snapshot.id,
          handle,
          incoming,
          activePubkey: planned.activePubkey,
          added: planned.added,
          data: planned.data,
        });
      }
    }

    if (!writes.length || options.dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: options.dryRun,
            ...stats,
            wouldWrite: writes.length,
            sample: writes.slice(0, 5).map((write) => ({
              handle: write.handle,
              pubkey: write.activePubkey,
              claimsAdded: write.added,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    let wrote = 0;
    for (const write of writes) {
      const committed = await db.runTransaction(async (tx) => {
        const ref = db.collection(options.collection).doc(write.id);
        const snap = await tx.get(ref);
        const existing = snap.exists ? snap.data() || {} : null;
        const planned = planDirectoryImport(existing, write.incoming);
        if (!planned.changed) return false;
        tx.set(ref, planned.data, { mergeFields: Object.keys(planned.data) });
        return true;
      });
      if (committed) wrote += 1;
    }

    const check = await db
      .collection(options.collection)
      .doc(writes[0].id)
      .get();
    const active = check.data()?.activeIdentity;
    console.log(
      JSON.stringify(
        {
          project: options.project,
          database: options.database,
          collection: options.collection,
          sourcePairs: [...loaded.byHandle.values()].reduce(
            (sum, claims) => sum + claims.length,
            0,
          ),
          sourceHandles: handles.length,
          skippedHandle: loaded.skippedHandle,
          skippedKey: loaded.skippedKey,
          ...stats,
          wrote,
          firstIndex: handles.indexOf(writes[0].handle),
          firstHandle: writes[0].handle,
          lastHandle: writes.at(-1).handle,
          readback: {
            id: writes[0].id,
            exists: check.exists,
            status: active?.status || null,
            pubkey: active?.pubkey || null,
            method: active?.verificationMethods || null,
            pendingClaimCount: check.data()?.pendingClaimCount ?? null,
          },
          sample: writes.slice(0, 5).map((write) => ({
            handle: write.handle,
            pubkey: write.activePubkey,
            claimsAdded: write.added,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("import-nostr-directory.js")) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
