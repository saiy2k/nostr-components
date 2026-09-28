#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import { FieldValue } from "@google-cloud/firestore";
import { handleDocumentId } from "./handle-state.js";
import { fetchKind0s, metadataFromKind0 } from "./kind0.js";
import { checkZapSupport } from "./projection.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const DEFAULT_ACCOUNTS =
  "/Users/saiy2k/Downloads/Dump/nostr-directory-accounts-2026-09-08/accounts.json";
const LNURL_CONCURRENCY = 8;
const LNURL_TIMEOUT_MS = 8000;

export function applyZapResult(identity, zap) {
  const next = { ...identity };
  const transient = zap.zapCheckTransient === true;
  if (transient) {
    delete next.zappable;
    delete next.lud16;
    delete next.lnurlp;
    delete next.lnurlAllowsNostr;
    delete next.lnurlNostrPubkey;
  } else {
    next.zappable = zap.zappable === true;
    next.lud16 = zap.lud16 || null;
    if (zap.lnurlp) next.lnurlp = zap.lnurlp;
    if (zap.lnurlAllowsNostr !== undefined) next.lnurlAllowsNostr = zap.lnurlAllowsNostr;
    if (zap.lnurlNostrPubkey) next.lnurlNostrPubkey = zap.lnurlNostrPubkey;
  }
  next.zapReason = zap.zapReason;
  next.zapCheckedAt = zap.zapCheckedAt;
  next.zapCheckTransient = transient;
  return stripUndefined(next);
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function zapNeedsCheck(identity) {
  if (!identity?.pubkey) return false;
  if (!identity.zapCheckedAt) return true;
  return identity.zapCheckTransient === true;
}

function parseArgs(argv) {
  const options = {
    accounts: DEFAULT_ACCOUNTS,
    limit: 450,
    offset: 0,
    recheck: null,
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--accounts") options.accounts = argv[++i];
    else if (arg === "--limit") options.limit = Number(argv[++i]);
    else if (arg === "--offset") options.offset = Number(argv[++i]);
    else if (arg === "--project") options.project = argv[++i];
    else if (arg === "--recheck") options.recheck = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 450) {
    throw new Error("--limit must be an integer from 1 to 450.");
  }
  if (!Number.isInteger(options.offset) || options.offset < 0) {
    throw new Error("--offset must be a non-negative integer.");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const relays = loadRelaysFromFile();
  const records = JSON.parse(await readFile(options.accounts, "utf8"));
  const { loadDirectoryClaims } = await import("./import-nostr-directory.js");
  const handles = [...loadDirectoryClaims(records).byHandle.keys()]
    .sort()
    .slice(options.offset, options.offset + options.limit);
  const db = await createFirestore({
    firestoreProject: options.project,
    firestoreDatabase: options.database,
  });
  const stats = {
    handles: handles.length,
    skippedFresh: 0,
    missingDoc: 0,
    zappable: 0,
    notZappable: 0,
    transient: 0,
    wrote: 0,
  };
  const samples = [];

  try {
    const refs = handles.map((handle) =>
      db.collection(options.collection).doc(handleDocumentId(handle)),
    );
    const snapshots = [];
    for (let index = 0; index < refs.length; index += 100) {
      snapshots.push(...(await db.getAll(...refs.slice(index, index + 100))));
    }
    const due = [];
    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        stats.missingDoc += 1;
        continue;
      }
      const data = snapshot.data() || {};
      const identity = data.activeIdentity;
      const recheck =
        options.recheck === "open"
          ? identity?.zapReason === "missing-lud16" ||
            identity?.zapReason === "kind0-unavailable" ||
            identity?.zapCheckTransient === true
          : options.recheck && identity?.zapReason === options.recheck;
      if (!recheck && !zapNeedsCheck(identity)) {
        stats.skippedFresh += 1;
        continue;
      }
      due.push({
        id: snapshot.id,
        handle: data.handle,
        data,
      });
    }

    console.log(
      `Zap pass: ${due.length} handles due, relays ${relays.join(", ")}`,
    );
    const profilesByPubkey = await fetchKind0s(
      [...new Set(due.map((row) => row.data.activeIdentity.pubkey))],
      relays,
    );
    const profiles = due.map((row) => ({
      row,
      profile: profilesByPubkey.get(row.data.activeIdentity.pubkey),
    }));

    const checked = await mapPool(profiles, LNURL_CONCURRENCY, async ({ row, profile }) => {
      if (!profile.event) {
        return {
          row,
          zap: {
            zapReason: profile.transient ? "kind0-unavailable" : "missing-lud16",
            zapCheckedAt: new Date().toISOString(),
            zapCheckTransient: profile.transient,
            zappable: false,
            lud16: null,
          },
        };
      }
      const metadata = metadataFromKind0(profile.event) || {};
      const zap = await checkZapSupport({}, metadata, LNURL_TIMEOUT_MS);
      return { row, zap };
    });

    let batch = db.batch();
    let pendingWrites = 0;
    for (const { row, zap } of checked) {
      const transient = zap.zapCheckTransient === true;
      const zappable = !transient && zap.zappable === true;
      if (transient) stats.transient += 1;
      else if (zappable) stats.zappable += 1;
      else stats.notZappable += 1;
      if (samples.length < 8 || row.handle === "adriancantrill") {
        samples.push({
          handle: row.handle,
          zappable: transient ? null : zappable,
          zapReason: zap.zapReason,
          lud16: transient ? null : zap.lud16 || null,
          transient,
        });
      }

      const activeIdentity = applyZapResult(row.data.activeIdentity, zap);
      if (transient) {
        activeIdentity.zappable = FieldValue.delete();
        activeIdentity.lud16 = FieldValue.delete();
      }
      const claims = (row.data.claims || []).map((claim) =>
        claim?.claimId === activeIdentity.claimId
          ? applyZapResult(claim, zap)
          : claim,
      );
      batch.set(
        db.collection(options.collection).doc(row.id),
        stripUndefined({
          activeIdentity,
          claims,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true },
      );
      pendingWrites += 1;
      stats.wrote += 1;
      if (pendingWrites === 400) {
        await batch.commit();
        batch = db.batch();
        pendingWrites = 0;
      }
    }
    if (pendingWrites) await batch.commit();

    console.log(
      JSON.stringify(
        {
          project: options.project,
          collection: options.collection,
          relays,
          ...stats,
          samples,
        },
        null,
        2,
      ),
    );
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("zap-pass.js")) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
