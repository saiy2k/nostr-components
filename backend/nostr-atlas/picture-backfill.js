#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { metadataFromKind0, fetchKind0s } from "./kind0.js";
import {
  fetchXAvatarUrl,
  httpsPictureUrl,
  upgradeTwitterAvatarUrl,
} from "./picture-url.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const BATCH_LIMIT = 400;
const X_AVATAR_CONCURRENCY = 2;

export function isVerifiedIdentity(identity) {
  return (
    identity?.status === "verified" &&
    typeof identity.pubkey === "string" &&
    /^[0-9a-f]{64}$/i.test(identity.pubkey)
  );
}

function withMetadata(entity, patch) {
  return {
    ...entity,
    metadata: {
      ...(entity?.metadata || {}),
      ...patch,
    },
  };
}

function patchMatchingClaim(claims, claimId, patch) {
  if (!Array.isArray(claims) || !claimId) return undefined;
  let matched = false;
  const next = claims.map((claim) => {
    if (claim?.claimId !== claimId) return claim;
    matched = true;
    return withMetadata(claim, patch);
  });
  return matched ? next : undefined;
}

export function planNostrPicture(doc, kind0) {
  const active = doc?.activeIdentity;
  if (!isVerifiedIdentity(active)) {
    return { changed: false, reason: "not-verified" };
  }
  if (httpsPictureUrl(active.metadata?.picture)) {
    return { changed: false, reason: "has-picture" };
  }
  if (!kind0) return { changed: false, reason: "no-kind0" };
  if (
    String(kind0.pubkey || "").toLowerCase() !==
    String(active.pubkey || "").toLowerCase()
  ) {
    return { changed: false, reason: "pubkey-mismatch" };
  }
  const metadata = metadataFromKind0(kind0);
  if (!metadata) return { changed: false, reason: "rejected-kind0" };
  const picture = httpsPictureUrl(metadata.picture);
  if (!picture) return { changed: false, reason: "no-picture" };
  return {
    changed: true,
    reason: "nostr-picture",
    picture,
    activeIdentity: withMetadata(active, { picture }),
    claims: patchMatchingClaim(doc.claims, active.claimId, { picture }),
  };
}

export function planXPicture(doc, avatarUrl) {
  const active = doc?.activeIdentity;
  if (!isVerifiedIdentity(active)) {
    return { changed: false, reason: "not-verified" };
  }
  if (httpsPictureUrl(active.metadata?.picture)) {
    return { changed: false, reason: "has-nostr-picture" };
  }
  const xPicture = upgradeTwitterAvatarUrl(avatarUrl);
  if (!xPicture) return { changed: false, reason: "no-x-picture" };
  if (httpsPictureUrl(active.metadata?.xPicture) === xPicture) {
    return { changed: false, reason: "unchanged", xPicture };
  }
  return {
    changed: true,
    reason: "x-picture",
    xPicture,
    activeIdentity: withMetadata(active, { xPicture }),
    claims: patchMatchingClaim(doc.claims, active.claimId, { xPicture }),
  };
}

function rowHandle(row) {
  const fromId = row.id.startsWith("twitter:") ? row.id.slice(8) : "";
  const handle = String(row.data?.handle || fromId)
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
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
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
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
    hasPicture: 0,
    nostrUpdated: 0,
    noKind0: 0,
    noNostrPicture: 0,
    hasXPicture: 0,
    xUpdated: 0,
    xUnchanged: 0,
    wrote: 0,
  };
  try {
    const snap = await db.collection(options.collection).get();
    const due = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      if (!isVerifiedIdentity(data.activeIdentity)) continue;
      stats.scanned += 1;
      if (httpsPictureUrl(data.activeIdentity.metadata?.picture)) {
        stats.hasPicture += 1;
        continue;
      }
      due.push({ id: doc.id, data });
    }
    console.log(
      `Picture pass: ${due.length} verified identities missing a Nostr picture, relays ${relays.length}`,
    );
    const profiles = await fetchKind0s(
      [
        ...new Set(
          due.map((row) => String(row.data.activeIdentity.pubkey).toLowerCase()),
        ),
      ],
      relays,
    );
    const planned = [];
    const needsX = [];
    for (const row of due) {
      const pubkey = String(row.data.activeIdentity.pubkey).toLowerCase();
      const profile = profiles.get(pubkey);
      const plan = planNostrPicture(row.data, profile?.event || null);
      if (plan.changed) {
        stats.nostrUpdated += 1;
        planned.push({ row, plan });
        continue;
      }
      if (plan.reason === "no-kind0") stats.noKind0 += 1;
      else if (plan.reason === "no-picture") stats.noNostrPicture += 1;
      if (httpsPictureUrl(row.data.activeIdentity.metadata?.xPicture)) {
        stats.hasXPicture += 1;
        continue;
      }
      needsX.push(row);
    }
    const avatars = await mapPool(needsX, X_AVATAR_CONCURRENCY, (row) => {
      const handle = rowHandle(row);
      return handle ? fetchXAvatarUrl(handle) : null;
    });
    needsX.forEach((row, index) => {
      const plan = planXPicture(row.data, avatars[index]);
      if (!plan.changed) {
        stats.xUnchanged += 1;
        return;
      }
      stats.xUpdated += 1;
      planned.push({ row, plan });
    });
    if (options.write) {
      let batch = db.batch();
      let pending = 0;
      for (const { row, plan } of planned) {
        batch.set(
          db.collection(options.collection).doc(row.id),
          stripUndefined({
            activeIdentity: plan.activeIdentity,
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
        },
        null,
        2,
      ),
    );
  } finally {
    await terminateFirestore(db);
  }
}

if (process.argv[1] && process.argv[1].endsWith("picture-backfill.js")) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
