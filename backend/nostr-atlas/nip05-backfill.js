#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { metadataFromKind0, fetchKind0s } from "./kind0.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const NIP05_MAX = 255;
const BATCH_LIMIT = 400;

export function boundedNip05(value) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).slice(0, NIP05_MAX);
  return text || null;
}

export function isDirectoryIdentity(identity) {
  if (!identity || identity.status !== "verified") return false;
  if (String(identity.claimId || "").startsWith("nd:")) return true;
  if ((identity.sources || []).includes("nostr.directory")) return true;
  if ((identity.verificationMethods || []).includes("nostr.directory")) return true;
  return false;
}

function storedNip05(entity) {
  const value = entity?.metadata?.nip05;
  return typeof value === "string" && value ? value : null;
}

function applyNip05(entity, nip05) {
  const next = { ...entity };
  const metadata = { ...(entity?.metadata || {}) };
  if (nip05) metadata.nip05 = nip05;
  else delete metadata.nip05;
  if (Object.keys(metadata).length) next.metadata = metadata;
  else delete next.metadata;
  return next;
}

export function planNip05FromKind0(doc, kind0) {
  const active = doc?.activeIdentity;
  if (!isDirectoryIdentity(active)) {
    return { changed: false, reason: "not-directory" };
  }
  if (!kind0) {
    return { changed: false, reason: "no-kind0" };
  }
  if (
    String(kind0.pubkey || "").toLowerCase() !==
    String(active.pubkey || "").toLowerCase()
  ) {
    return { changed: false, reason: "pubkey-mismatch" };
  }
  const metadata = metadataFromKind0(kind0);
  if (!metadata) {
    return { changed: false, reason: "rejected-kind0" };
  }
  const nextNip05 = boundedNip05(metadata.nip05);
  const current = storedNip05(active);
  if (current === nextNip05) {
    return { changed: false, reason: "unchanged", nip05: current };
  }
  return {
    changed: true,
    reason: nextNip05 ? "updated" : "cleared",
    nip05: nextNip05,
    previousNip05: current,
    activeIdentity: applyNip05(active, nextNip05),
    claims: (doc.claims || []).map((claim) =>
      claim?.claimId === active.claimId ? applyNip05(claim, nextNip05) : claim,
    ),
  };
}

function activeIdentityForMerge(identity, clearNip05) {
  if (!clearNip05) return identity;
  return {
    ...identity,
    metadata: {
      ...(identity.metadata || {}),
      nip05: FieldValue.delete(),
    },
  };
}

function parseArgs(argv) {
  const options = {
    write: false,
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--project") options.project = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const relays = loadRelaysFromFile();
  const db = await createFirestore({
    firestoreProject: options.project,
    firestoreDatabase: options.database,
  });
  const stats = {
    scanned: 0,
    unchanged: 0,
    updated: 0,
    cleared: 0,
    noKind0: 0,
    wrote: 0,
  };
  let sample = null;
  try {
    const snap = await db.collection(options.collection).get();
    const due = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      if (!isDirectoryIdentity(data.activeIdentity)) continue;
      stats.scanned += 1;
      due.push({ id: doc.id, data });
    }
    console.log(`NIP-05 pass: ${due.length} directory identities, relays ${relays.length}`);
    const profiles = await fetchKind0s(
      [...new Set(due.map((row) => row.data.activeIdentity.pubkey))],
      relays,
    );
    const planned = [];
    for (const row of due) {
      const profile = profiles.get(row.data.activeIdentity.pubkey);
      const plan = planNip05FromKind0(row.data, profile?.event || null);
      if (row.data.handle === "btcforplebs" || row.id === "twitter:btcforplebs") {
        sample = {
          handle: row.data.handle || row.id,
          before: row.data.activeIdentity?.metadata?.nip05 || null,
          after: plan.changed ? plan.nip05 : plan.nip05 || row.data.activeIdentity?.metadata?.nip05 || null,
          reason: plan.reason,
        };
      }
      if (!plan.changed) {
        if (plan.reason === "no-kind0") stats.noKind0 += 1;
        else stats.unchanged += 1;
        continue;
      }
      if (plan.reason === "cleared") stats.cleared += 1;
      else stats.updated += 1;
      planned.push({ row, plan });
    }
    if (options.write) {
      let batch = db.batch();
      let pending = 0;
      for (const { row, plan } of planned) {
        const clear = plan.nip05 == null;
        batch.set(
          db.collection(options.collection).doc(row.id),
          stripUndefined({
            activeIdentity: activeIdentityForMerge(plan.activeIdentity, clear),
            claims: plan.claims,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true },
        );
        pending += 1;
        stats.wrote += 1;
        if (pending === BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
          console.log(`wrote ${stats.wrote}`);
        }
      }
      if (pending) await batch.commit();
    }
    console.log(
      JSON.stringify(
        {
          dryRun: !options.write,
          project: options.project,
          collection: options.collection,
          ...stats,
          btcforplebs: sample,
        },
        null,
        2,
      ),
    );
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("nip05-backfill.js")) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
