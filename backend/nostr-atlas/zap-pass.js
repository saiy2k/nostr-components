#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { readFile } from "node:fs/promises";
import { FieldValue } from "@google-cloud/firestore";
import { handleDocumentId } from "./handle-state.js";
import { fetchKind0s, metadataFromKind0 } from "./kind0.js";
import { isDirectoryIdentity } from "./nip05-backfill.js";
import { checkZapSupport } from "./projection.js";
import {
  createFirestore,
  loadRelaysFromFile,
  stripUndefined,
  terminateFirestore,
} from "./runtime.js";

const LNURL_CONCURRENCY = 8;
const LNURL_TIMEOUT_MS = 8000;

export function isPrivateAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export async function fetchPublicHttps(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    return { ok: false, status: 400, json: async () => ({}) };
  }
  const records = await lookup(parsed.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    return { ok: false, status: 403, json: async () => ({}) };
  }
  const chosen = records[0];
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: chosen.address,
        servername: parsed.hostname,
        family: chosen.family,
        method: "GET",
        path: `${parsed.pathname}${parsed.search}`,
        headers: { host: parsed.hostname, accept: "application/json" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(body),
          });
        });
      },
    );
    const abort = () => req.destroy(new Error("aborted"));
    options.signal?.addEventListener("abort", abort, { once: true });
    req.on("error", reject);
    req.setTimeout(LNURL_TIMEOUT_MS, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function deleted() {
  return FieldValue.delete();
}

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
    else delete next.lnurlp;
    if (zap.lnurlAllowsNostr !== undefined) next.lnurlAllowsNostr = zap.lnurlAllowsNostr;
    else delete next.lnurlAllowsNostr;
    if (zap.lnurlNostrPubkey) next.lnurlNostrPubkey = zap.lnurlNostrPubkey;
    else delete next.lnurlNostrPubkey;
  }
  next.zapReason = zap.zapReason;
  next.zapCheckedAt = zap.zapCheckedAt;
  next.zapCheckTransient = transient;
  return stripUndefined(next);
}

export function activeZapWrite(identity, zap) {
  const next = applyZapResult(identity, zap);
  if (zap.zapCheckTransient === true) {
    next.zappable = deleted();
    next.lud16 = deleted();
  }
  if (!zap.lnurlp) next.lnurlp = deleted();
  if (zap.lnurlAllowsNostr === undefined) next.lnurlAllowsNostr = deleted();
  if (!zap.lnurlNostrPubkey) next.lnurlNostrPubkey = deleted();
  return next;
}

export function directoryZapClaims(data) {
  const claims = (Array.isArray(data?.claims) ? data.claims : []).filter(
    (claim) => isDirectoryIdentity(claim) && claim.pubkey,
  );
  if (claims.length) return claims;
  if (isDirectoryIdentity(data?.activeIdentity) && data.activeIdentity.pubkey) {
    return [data.activeIdentity];
  }
  return [];
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

function matchesRecheck(identity, recheck) {
  if (!recheck) return false;
  if (recheck === "open") {
    return (
      identity?.zapReason === "missing-lud16" ||
      identity?.zapReason === "kind0-unavailable" ||
      identity?.zapCheckTransient === true
    );
  }
  return identity?.zapReason === recheck;
}

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== "string" || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    accounts: "",
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
    if (arg === "--accounts") {
      options.accounts = optionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--limit") {
      options.limit = Number(optionValue(argv, i, arg));
      i += 1;
    } else if (arg === "--offset") {
      options.offset = Number(optionValue(argv, i, arg));
      i += 1;
    } else if (arg === "--project") {
      options.project = optionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--recheck") {
      options.recheck = optionValue(argv, i, arg);
      i += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.accounts) throw new Error("--accounts is required.");
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
      const claims = directoryZapClaims(data).filter(
        (claim) => matchesRecheck(claim, options.recheck) || zapNeedsCheck(claim),
      );
      if (!claims.length) {
        stats.skippedFresh += 1;
        continue;
      }
      for (const claim of claims) {
        due.push({
          id: snapshot.id,
          handle: data.handle,
          claim,
        });
      }
    }

    console.log(
      `Zap pass: ${due.length} claims due, relays ${relays.join(", ")}`,
    );
    const profilesByPubkey = await fetchKind0s(
      [...new Set(due.map((row) => String(row.claim.pubkey).toLowerCase()))],
      relays,
      { newest: true },
    );
    const checked = await mapPool(due, LNURL_CONCURRENCY, async (row) => {
      const profile = profilesByPubkey.get(String(row.claim.pubkey).toLowerCase());
      if (!profile?.event) {
        return {
          row,
          zap: {
            zapReason: profile?.transient ? "kind0-unavailable" : "missing-lud16",
            zapCheckedAt: new Date().toISOString(),
            zapCheckTransient: Boolean(profile?.transient),
            zappable: false,
            lud16: null,
          },
        };
      }
      const metadata = metadataFromKind0(profile.event) || {};
      const zap = await checkZapSupport({}, metadata, LNURL_TIMEOUT_MS, fetchPublicHttps);
      return { row, zap };
    });

    const byDoc = new Map();
    for (const { row, zap } of checked) {
      const entry = byDoc.get(row.id) || [];
      entry.push({ claimId: row.claim.claimId, handle: row.handle, zap });
      byDoc.set(row.id, entry);
      const transient = zap.zapCheckTransient === true;
      const zappable = !transient && zap.zappable === true;
      if (transient) stats.transient += 1;
      else if (zappable) stats.zappable += 1;
      else stats.notZappable += 1;
      if (samples.length < 8 || row.handle === "adriancantrill") {
        samples.push({
          handle: row.handle,
          claimId: row.claim.claimId,
          zappable: transient ? null : zappable,
          zapReason: zap.zapReason,
          lud16: transient ? null : zap.lud16 || null,
          transient,
        });
      }
    }

    for (const [id, updates] of byDoc) {
      const wrote = await db.runTransaction(async (tx) => {
        const ref = db.collection(options.collection).doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return false;
        const data = snap.data() || {};
        const updatesById = new Map(updates.map((update) => [update.claimId, update.zap]));
        let matched = false;
        const claims = (data.claims || []).map((claim) => {
          const zap = updatesById.get(claim?.claimId);
          if (!zap) return claim;
          matched = true;
          return applyZapResult(claim, zap);
        });
        const activeZap = updatesById.get(data.activeIdentity?.claimId);
        if (activeZap) matched = true;
        if (!matched) return false;
        tx.set(
          ref,
          stripUndefined({
            activeIdentity: activeZap
              ? activeZapWrite(data.activeIdentity, activeZap)
              : undefined,
            claims,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true },
        );
        return true;
      });
      if (wrote) stats.wrote += 1;
    }

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
