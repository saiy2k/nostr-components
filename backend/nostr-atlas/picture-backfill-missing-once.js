import { FieldValue } from "@google-cloud/firestore";
import { fetchKind0s } from "./kind0.js";
import { fetchXAvatarUrl, httpsPictureUrl } from "./picture-url.js";
import {
  isVerifiedIdentity,
  planNostrPicture,
  planXPicture,
} from "./picture-backfill.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const BATCH_LIMIT = 400;
const X_AVATAR_CONCURRENCY = 2;

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== "string" || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--project") {
      options.project = optionValue(argv, index, arg);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

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
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const relays = loadRelaysFromFile();
const db = await createFirestore({
  firestoreProject: options.project,
  firestoreDatabase: options.database,
});
const stats = {
  verified: 0,
  hasPicture: 0,
  hasXOnly: 0,
  missingBoth: 0,
  nostrUpdated: 0,
  noKind0: 0,
  noNostrPicture: 0,
  xUpdated: 0,
  xUnchanged: 0,
  xReasons: {},
  wrote: 0,
};
try {
  const snap = await db.collection(options.collection).get();
  const due = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (!isVerifiedIdentity(data.activeIdentity)) continue;
    stats.verified += 1;
    const metadata = data.activeIdentity.metadata || {};
    if (httpsPictureUrl(metadata.picture)) {
      stats.hasPicture += 1;
      continue;
    }
    if (httpsPictureUrl(metadata.xPicture)) {
      stats.hasXOnly += 1;
      continue;
    }
    due.push({ id: doc.id, data });
  }
  stats.missingBoth = due.length;
  console.log(
    JSON.stringify({
      verified: stats.verified,
      hasPicture: stats.hasPicture,
      hasXOnly: stats.hasXOnly,
      missingBoth: stats.missingBoth,
      relays: relays.length,
    }),
  );
  if (due.length === 0) {
    console.log("nothing to update");
  } else if (due.length > 2000) {
    throw new Error(
      `Refusing to run: ${due.length} accounts are missing both images, expected about 1368.`,
    );
  } else {
    const profiles = await fetchKind0s(
      [...new Set(due.map((row) => String(row.data.activeIdentity.pubkey).toLowerCase()))],
      relays,
      { newest: true },
    );
    const planned = [];
    const needsX = [];
    for (const row of due) {
      const pubkey = String(row.data.activeIdentity.pubkey).toLowerCase();
      const profile = profiles.get(pubkey);
      const plan = planNostrPicture(row.data, profile?.event || null);
      if (plan.changed) {
        stats.nostrUpdated += 1;
        planned.push({ row, plan, event: profile?.event || null, avatar: null });
        continue;
      }
      if (!profile?.event && profile?.transient !== false) {
        stats.noKind0 += 1;
        continue;
      }
      if (plan.reason === "no-kind0") stats.noKind0 += 1;
      else if (plan.reason === "no-picture") stats.noNostrPicture += 1;
      needsX.push(row);
    }
    console.log(
      `kind0 done: nostr ${stats.nostrUpdated}, no kind0 ${stats.noKind0}, no picture ${stats.noNostrPicture}, x lookups ${needsX.length}`,
    );
    let fetched = 0;
    const avatars = await mapPool(needsX, X_AVATAR_CONCURRENCY, async (row) => {
      const handle = rowHandle(row);
      const avatar = handle ? await fetchXAvatarUrl(handle) : null;
      fetched += 1;
      if (fetched % 100 === 0 || fetched === needsX.length) {
        console.log(`x avatars ${fetched}/${needsX.length}`);
      }
      return avatar;
    });
    needsX.forEach((row, index) => {
      const plan = planXPicture(row.data, avatars[index]);
      if (!plan.changed) {
        stats.xUnchanged += 1;
        stats.xReasons[plan.reason] = (stats.xReasons[plan.reason] || 0) + 1;
        return;
      }
      stats.xUpdated += 1;
      planned.push({ row, plan, event: null, avatar: avatars[index] });
    });
    if (!options.dryRun) {
      for (const item of planned) {
        const wrote = await db.runTransaction(async (tx) => {
          const ref = db.collection(options.collection).doc(item.row.id);
          const snap = await tx.get(ref);
          if (!snap.exists) return false;
          const fresh = snap.data() || {};
          const metadata = fresh.activeIdentity?.metadata || {};
          if (
            !item.event &&
            (httpsPictureUrl(metadata.picture) || httpsPictureUrl(metadata.xPicture))
          ) {
            return false;
          }
          const plan = item.event
            ? planNostrPicture(fresh, item.event)
            : planXPicture(fresh, item.avatar);
          if (!plan.changed) return false;
          tx.set(
            ref,
            stripUndefined({
              activeIdentity: plan.activeIdentity,
              claims: plan.claims,
              updatedAt: FieldValue.serverTimestamp(),
            }),
            { merge: true },
          );
          return true;
        });
        if (wrote) stats.wrote += 1;
        if (stats.wrote > 0 && stats.wrote % BATCH_LIMIT === 0) {
          console.log(`wrote ${stats.wrote}`);
        }
      }
    }
  }
  console.log(JSON.stringify({ dryRun: options.dryRun, ...stats }, null, 2));
} finally {
  await terminateFirestore(db);
}
