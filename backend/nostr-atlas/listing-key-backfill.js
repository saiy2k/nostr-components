#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import {
  FEATURED_X_HANDLES,
  listingKeyForHandle,
} from "./featured-handles.js";
import {
  createFirestore,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const BATCH_LIMIT = 450;
const HANDLE_ID = /^twitter:[a-z0-9_]{1,15}$/;

export function planListingKeyBackfill(documents) {
  const byHandle = new Map();
  const updates = [];
  for (const document of documents) {
    const id = String(document?.id || "");
    if (!HANDLE_ID.test(id)) continue;
    const handle = id.slice(8);
    byHandle.set(handle, document);
    const listingKey = listingKeyForHandle(handle);
    if (document.listingKey === listingKey) continue;
    updates.push({ id, listingKey });
  }
  const missingFeatured = FEATURED_X_HANDLES.filter((handle) => {
    const document = byHandle.get(handle);
    return (
      document?.verified !== true ||
      (document.handle && document.handle !== handle)
    );
  });
  return { updates, missingFeatured };
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

function directoryDocument(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    handle: typeof data.handle === "string" ? data.handle : "",
    listingKey: typeof data.listingKey === "string" ? data.listingKey : "",
    verified: data.activeIdentity?.status === "verified",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = await createFirestore({
    firestoreProject: options.project,
    firestoreDatabase: options.database,
  });
  try {
    const snapshot = await db
      .collection(options.collection)
      .select("handle", "listingKey", "activeIdentity.status")
      .get();
    const plan = planListingKeyBackfill(snapshot.docs.map(directoryDocument));
    console.log(
      JSON.stringify(
        {
          dryRun: !options.write,
          project: options.project,
          collection: options.collection,
          scanned: snapshot.size,
          updates: plan.updates.length,
          missingFeatured: plan.missingFeatured,
        },
        null,
        2,
      ),
    );
    if (plan.missingFeatured.length) {
      throw new Error(
        `Refusing to write listing keys until every curated handle is a verified directory document: ${plan.missingFeatured.join(", ")}`,
      );
    }
    if (!options.write) return;

    let wrote = 0;
    for (let index = 0; index < plan.updates.length; index += BATCH_LIMIT) {
      const batch = db.batch();
      for (const update of plan.updates.slice(index, index + BATCH_LIMIT)) {
        batch.set(
          db.collection(options.collection).doc(update.id),
          stripUndefined({
            listingKey: update.listingKey,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true },
        );
      }
      await batch.commit();
      wrote += Math.min(BATCH_LIMIT, plan.updates.length - index);
      console.log(`wrote ${wrote}`);
    }
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("listing-key-backfill.js")) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
