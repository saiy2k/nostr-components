#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { isNip39Identity, planKind0Metadata } from "./directory-state.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";
import { fetchKind0s, metadataFromKind0 } from "./kind0.js";

export function parseArgs(argv) {
  const options = {
    write: false,
    handles: [],
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--project") options.project = argv[++index];
    else if (arg === "--handle") options.handles.push(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.handles = options.handles.map((handle) =>
    String(handle || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase(),
  );
  if (options.handles.some((handle) => !/^[a-z0-9_]{1,15}$/.test(handle))) {
    throw new Error("Invalid --handle value");
  }
  return options;
}

function planForProfile(data, profile) {
  const event = profile?.event || null;
  if (!event) return planKind0Metadata(data, null, null);
  const content = metadataFromKind0(event);
  if (!content) return { changed: false, reason: "rejected-kind0" };
  return planKind0Metadata(data, content, event.pubkey, event.created_at);
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
    noKind0: 0,
    rejectedKind0: 0,
    noProfileFields: 0,
    staleKind0: 0,
    wrote: 0,
  };
  try {
    const due = [];
    if (options.handles.length) {
      const refs = options.handles.map((handle) =>
        db.collection(options.collection).doc(`twitter:${handle}`),
      );
      const snapshots = await db.getAll(...refs);
      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;
        const data = snapshot.data() || {};
        if (!isNip39Identity(data.activeIdentity)) continue;
        stats.scanned += 1;
        due.push({ id: snapshot.id, data });
      }
    } else {
      const snap = await db.collection(options.collection).get();
      for (const doc of snap.docs) {
        const data = doc.data() || {};
        if (!isNip39Identity(data.activeIdentity)) continue;
        stats.scanned += 1;
        due.push({ id: doc.id, data });
      }
    }
    console.log(
      `Kind-0 metadata pass: ${due.length} NIP-39 identities, relays ${relays.length}`,
    );
    const profiles = await fetchKind0s(
      [
        ...new Set(
          due
            .map((row) =>
              String(row.data.activeIdentity.pubkey || "").toLowerCase(),
            )
            .filter((pubkey) => /^[0-9a-f]{64}$/.test(pubkey)),
        ),
      ],
      relays,
      { newest: true },
    );
    const planned = [];
    for (const row of due) {
      const pubkey = String(row.data.activeIdentity.pubkey || "").toLowerCase();
      const plan = planForProfile(row.data, profiles.get(pubkey));
      if (!plan.changed) {
        if (plan.reason === "no-kind0") stats.noKind0 += 1;
        else if (plan.reason === "rejected-kind0") stats.rejectedKind0 += 1;
        else if (plan.reason === "no-profile-fields") stats.noProfileFields += 1;
        else if (plan.reason === "stale-kind0") stats.staleKind0 += 1;
        else stats.unchanged += 1;
        continue;
      }
      stats.updated += 1;
      planned.push({ row, plan });
    }
    if (options.write) {
      for (const { row } of planned) {
        const wrote = await db.runTransaction(async (transaction) => {
          const ref = db.collection(options.collection).doc(row.id);
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists) return false;
          const data = snapshot.data() || {};
          const pubkey = String(
            data.activeIdentity?.pubkey || "",
          ).toLowerCase();
          const current = planForProfile(data, profiles.get(pubkey));
          if (!current.changed) return false;
          transaction.set(
            ref,
            stripUndefined({
              activeIdentity: current.activeIdentity,
              claims: current.claims,
              updatedAt: FieldValue.serverTimestamp(),
            }),
            { merge: true },
          );
          return true;
        });
        if (wrote) stats.wrote += 1;
      }
    }
    console.log(
      JSON.stringify(
        {
          dryRun: !options.write,
          project: options.project,
          collection: options.collection,
          handles: options.handles,
          ...stats,
        },
        null,
        2,
      ),
    );
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("kind0-metadata-backfill.js")) {
  main()
    .catch((error) => {
      console.error(error?.stack || error?.message || error);
      process.exitCode = 1;
    })
    .finally(() => {
      // NDK and Firestore leave handles open after the writes finish.
      process.exit(process.exitCode ?? 0);
    });
}
