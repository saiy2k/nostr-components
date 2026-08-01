// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue, Firestore } from "@google-cloud/firestore";
import { firestoreSafeId } from "./utils.js";

const BACKEND_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Default path to the ranked relay list used by the backfill crawler. */
export const DEFAULT_RELAYS_FILE = path.join(BACKEND_ROOT, "relays.json");

export const IDENTITY_KINDS = [10011, 0];

/**
 * Parse relays.json contents into a de-duplicated URL list ordered by rank.
 * Accepts `[{ rank, url, ... }, ...]` or a plain string array.
 */
export function parseRelaysJson(data) {
  if (!Array.isArray(data)) {
    throw new Error("relays.json must be a JSON array.");
  }

  const entries = data.map((item, index) => {
    let entry;
    if (typeof item === "string") {
      entry = { rank: index + 1, url: item.trim() };
    } else if (item && typeof item === "object" && typeof item.url === "string") {
      const rank = Number.isFinite(item.rank) ? item.rank : index + 1;
      entry = { rank, url: item.url.trim() };
    } else {
      throw new Error(
        `relays.json entry at index ${index} must be a URL string or { url, rank? }.`,
      );
    }
    assertValidRelayUrl(entry.url, index);
    return entry;
  });

  const seen = new Set();
  const relays = [];
  for (const entry of entries.sort((a, b) => a.rank - b.rank)) {
    if (!entry.url || seen.has(entry.url)) continue;
    seen.add(entry.url);
    relays.push(entry.url);
  }
  return relays;
}

function assertValidRelayUrl(url, index) {
  if (!url) return;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `relays.json entry at index ${index} is not a valid URL: ${url}`,
    );
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error(
      `relays.json entry at index ${index} must use ws:// or wss://: ${url}`,
    );
  }
}

/** Synchronously load relay URLs from a relays.json file. */
export function loadRelaysFromFile(filePath = DEFAULT_RELAYS_FILE) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read relays file at ${filePath}: ${error?.message || error}`,
    );
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse relays file at ${filePath}: ${error?.message || error}`,
    );
  }

  const relays = parseRelaysJson(data);
  if (!relays.length) {
    throw new Error(`Relays file at ${filePath} did not contain any URLs.`);
  }
  return relays;
}

export const DEFAULT_COLLECTIONS = {
  handles: "nostrDirectoryHandles",
  state: "relayCrawlerState",
  gaps: "relayCrawlerGaps",
  handleWriteFailures: "nostrDirectoryHandleWriteFailures",
};

export function firestoreConfigFromEnv(env = process.env) {
  return {
    firestoreProject:
      env.FIRESTORE_PROJECT ||
      env.GOOGLE_CLOUD_PROJECT ||
      env.GCLOUD_PROJECT ||
      null,
    firestoreDatabase: env.FIRESTORE_DATABASE || "(default)",
    firestoreHandlesCollection:
      env.FIRESTORE_HANDLES_COLLECTION || DEFAULT_COLLECTIONS.handles,
    firestoreStateCollection:
      env.FIRESTORE_STATE_COLLECTION || DEFAULT_COLLECTIONS.state,
    firestoreGapsCollection:
      env.FIRESTORE_GAPS_COLLECTION || DEFAULT_COLLECTIONS.gaps,
    firestoreHandleWriteFailuresCollection:
      env.FIRESTORE_HANDLE_WRITE_FAILURES_COLLECTION ||
      DEFAULT_COLLECTIONS.handleWriteFailures,
  };
}

export async function createFirestore(args, FirestoreCtor = Firestore) {
  await assertFirestoreCredentialsAvailable();
  return new FirestoreCtor({
    projectId: args.firestoreProject,
    databaseId: args.firestoreDatabase,
  });
}

/** Release gRPC/keepalive handles so batch jobs can exit naturally. */
export async function terminateFirestore(db, { timeoutMs = 5000 } = {}) {
  if (!db?.terminate) return;
  let timer;
  try {
    await Promise.race([
      db.terminate(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("firestore-terminate-timeout")),
          timeoutMs,
        );
      }),
    ]);
  } catch {
    // Best-effort: never mask the caller's success/failure.
  } finally {
    clearTimeout(timer);
  }
}

export async function commitFirestoreWrites(db, writes) {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + 450)) {
      batch.set(db.collection(write.collection).doc(write.id), write.data, {
        merge: true,
      });
    }
    await batch.commit();
  }
}

export async function assertFirestoreCredentialsAvailable() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      await access(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      return;
    } catch {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS points to a missing file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`,
      );
    }
  }
  if (
    process.env.CLOUD_RUN_JOB ||
    process.env.CLOUD_RUN_WORKER_POOL ||
    process.env.K_SERVICE ||
    process.env.K_CONFIGURATION ||
    process.env.K_REVISION ||
    process.env.FUNCTION_NAME
  ) {
    return;
  }

  try {
    await access(getApplicationDefaultCredentialsPath());
  } catch {
    throw new Error(
      "Firestore write requires Application Default Credentials. Run `gcloud auth application-default login` locally, or run in Cloud Run with a Firestore-enabled service account.",
    );
  }
}

function getApplicationDefaultCredentialsPath() {
  if (process.env.CLOUDSDK_CONFIG) {
    return path.join(
      process.env.CLOUDSDK_CONFIG,
      "application_default_credentials.json",
    );
  }
  if (process.env.APPDATA) {
    return path.join(
      process.env.APPDATA,
      "gcloud",
      "application_default_credentials.json",
    );
  }
  return path.join(
    os.homedir(),
    ".config",
    "gcloud",
    "application_default_credentials.json",
  );
}

export function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value instanceof Date) return value;
  if (!value || typeof value !== "object" || value instanceof FieldValue)
    return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) result[key] = stripUndefined(child);
  }
  return result;
}

/** JSON-safe clone of Firestore write data (FieldValue → sentinel string). */
export function serializeFirestoreDataForJson(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof FieldValue) return "<FieldValue>";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeFirestoreDataForJson);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) result[key] = serializeFirestoreDataForJson(child);
  }
  return result;
}

export async function writeJson(file, data) {
  const outPath = path.resolve(process.cwd(), file);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function createRunMetrics(module, now = new Date()) {
  return {
    module,
    runId: `${module}-${firestoreSafeId(now.toISOString())}`,
    startedAt: now.toISOString(),
    startedMs: now.getTime(),
    timings: [],
  };
}

export function finishRunMetrics(runMetrics, counters = {}, now = new Date()) {
  return stripUndefined({
    module: runMetrics.module,
    component: runMetrics.module,
    runId: runMetrics.runId,
    startedAt: runMetrics.startedAt,
    finishedAt: now.toISOString(),
    durationMs: now.getTime() - runMetrics.startedMs,
    memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    avgProcessingMs: average(runMetrics.timings),
    p95ProcessingMs: percentile(runMetrics.timings, 95),
    counters,
  });
}

export function logRunSummary(run) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: "crawler_run_summary",
      module: run.module,
      component: run.component,
      runId: run.runId,
      durationMs: run.durationMs,
      memoryRssMb: run.memoryRssMb,
      counters: run.counters,
    }),
  );
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

export function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.ceil(sorted.length * (percentileValue / 100)) - 1,
  );
  return sorted[index];
}

export function isMainModule(moduleUrl) {
  return Boolean(
    process.argv[1] &&
      fileURLToPath(moduleUrl) === path.resolve(process.argv[1]),
  );
}

export function runMain(moduleUrl, main) {
  if (!isMainModule(moduleUrl)) return;
  Promise.resolve()
    .then(main)
    .catch((error) => {
      console.error(error.stack || error.message || error);
      process.exitCode = 1;
    })
    .finally(() => {
      // NDK/Firestore can leave open handles; Cloud Run batch jobs must exit.
      process.exit(process.exitCode ?? 0);
    });
}
