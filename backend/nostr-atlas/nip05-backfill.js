#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { fetchKind0s } from "./kind0.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";
import { isPublicHostname } from "./utils.js";

const NIP05_MAX = 255;
const BATCH_LIMIT = 400;

export function boundedNip05(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || value.length > NIP05_MAX) return { ok: false };
  const parts = value.split("@");
  const [name, domain] = parts;
  if (
    parts.length !== 2 ||
    !/^[a-z0-9._-]+$/i.test(name) ||
    !isPublicHostname(domain)
  ) {
    return { ok: false };
  }
  return { ok: true, value: `${name.toLowerCase()}@${domain.toLowerCase()}` };
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

export function planNip05FromKind0(doc, kind0, claim = doc?.activeIdentity) {
  if (!isDirectoryIdentity(claim)) {
    return { changed: false, reason: "not-directory" };
  }
  if (!kind0) {
    return { changed: false, reason: "no-kind0" };
  }
  if (
    String(kind0.pubkey || "").toLowerCase() !==
    String(claim.pubkey || "").toLowerCase()
  ) {
    return { changed: false, reason: "pubkey-mismatch" };
  }
  const metadata = kind0Object(kind0);
  if (!metadata) {
    return { changed: false, reason: "rejected-kind0" };
  }
  const decision = boundedNip05(metadata.nip05);
  if (!decision.ok) {
    return { changed: false, reason: "rejected-nip05" };
  }
  const nextNip05 = decision.value;
  const updatesActive = doc?.activeIdentity?.claimId === claim.claimId;
  const current = storedNip05(updatesActive ? doc.activeIdentity : claim);
  const storedClaim = (doc.claims || []).find((item) => item?.claimId === claim.claimId);
  const claimMatches = !storedClaim || storedNip05(storedClaim) === nextNip05;
  const activeMatches = !updatesActive || current === nextNip05;
  if (activeMatches && claimMatches) {
    return { changed: false, reason: "unchanged", nip05: current };
  }
  return {
    changed: true,
    reason: nextNip05 ? "updated" : "cleared",
    nip05: nextNip05,
    previousNip05: current,
    activeIdentity: updatesActive
      ? applyNip05(doc.activeIdentity, nextNip05)
      : undefined,
    claims: (doc.claims || []).map((item) =>
      item?.claimId === claim.claimId ? applyNip05(item, nextNip05) : item,
    ),
  };
}

function kind0Object(event) {
  if (!event || typeof event.content !== "string") return null;
  try {
    const content = JSON.parse(event.content);
    if (!content || typeof content !== "object" || Array.isArray(content)) return null;
    return content;
  } catch {
    return null;
  }
}

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== "string" || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
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
    else if (arg === "--project") {
      options.project = optionValue(argv, index, arg);
      index += 1;
    }
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
      const targets = (data.claims || []).filter(isDirectoryIdentity);
      if (!targets.length && isDirectoryIdentity(data.activeIdentity)) {
        targets.push(data.activeIdentity);
      }
      for (const claim of targets) {
        stats.scanned += 1;
        due.push({ id: doc.id, data, claim });
      }
    }
    console.log(`NIP-05 pass: ${due.length} directory identities, relays ${relays.length}`);
    const profiles = await fetchKind0s(
      [...new Set(due.map((row) => row.claim.pubkey))],
      relays,
      { newest: true },
    );
    const planned = [];
    for (const row of due) {
      const profile = profiles.get(row.claim.pubkey);
      const plan = planNip05FromKind0(row.data, profile?.event || null, row.claim);
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
      planned.push({ row, event: profile?.event || null, claimId: row.claim.claimId });
    }
    if (options.write) {
      for (let index = 0; index < planned.length; index += BATCH_LIMIT) {
        const slice = planned.slice(index, index + BATCH_LIMIT);
        for (const item of slice) {
          const wrote = await db.runTransaction(async (tx) => {
            const ref = db.collection(options.collection).doc(item.row.id);
            const snap = await tx.get(ref);
            if (!snap.exists) return false;
            const fresh = snap.data() || {};
            const claim =
              (fresh.claims || []).find((entry) => entry?.claimId === item.claimId) ||
              (fresh.activeIdentity?.claimId === item.claimId
                ? fresh.activeIdentity
                : null);
            const freshPlan = planNip05FromKind0(fresh, item.event, claim);
            if (!freshPlan.changed) return false;
            const clear = freshPlan.nip05 == null;
            tx.set(
              ref,
              stripUndefined({
                activeIdentity: freshPlan.activeIdentity
                  ? activeIdentityForMerge(freshPlan.activeIdentity, clear)
                  : undefined,
                claims: freshPlan.claims,
                updatedAt: FieldValue.serverTimestamp(),
              }),
              { merge: true },
            );
            return true;
          });
          if (wrote) stats.wrote += 1;
        }
        console.log(`wrote ${stats.wrote}`);
      }
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
