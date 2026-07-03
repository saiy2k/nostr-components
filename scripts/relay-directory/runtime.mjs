// SPDX-License-Identifier: MIT

import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue, Firestore } from "@google-cloud/firestore";

export const DEFAULT_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
];

export const IDENTITY_KINDS = [10011, 0];

export const DEFAULT_COLLECTIONS = {
  entries: "nostrDirectoryEntries",
  handles: "nostrDirectoryHandles",
  backfillRuns: "relayBackfillRuns",
  projectionRuns: "relayProjectionRuns",
  liveRuns: "relayLiveListenerRuns",
  state: "relayCrawlerState",
  gaps: "relayCrawlerGaps",
};

export function firestoreConfigFromEnv() {
  return {
    firestoreProject:
      process.env.FIRESTORE_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      null,
    firestoreDatabase: process.env.FIRESTORE_DATABASE || "(default)",
    firestoreEntriesCollection:
      process.env.FIRESTORE_ENTRIES_COLLECTION || DEFAULT_COLLECTIONS.entries,
    firestoreHandlesCollection:
      process.env.FIRESTORE_HANDLES_COLLECTION || DEFAULT_COLLECTIONS.handles,
    firestoreBackfillRunsCollection:
      process.env.FIRESTORE_BACKFILL_RUNS_COLLECTION ||
      DEFAULT_COLLECTIONS.backfillRuns,
    firestoreProjectionRunsCollection:
      process.env.FIRESTORE_PROJECTION_RUNS_COLLECTION ||
      DEFAULT_COLLECTIONS.projectionRuns,
    firestoreLiveRunsCollection:
      process.env.FIRESTORE_LIVE_RUNS_COLLECTION ||
      DEFAULT_COLLECTIONS.liveRuns,
    firestoreStateCollection:
      process.env.FIRESTORE_STATE_COLLECTION || DEFAULT_COLLECTIONS.state,
    firestoreGapsCollection:
      process.env.FIRESTORE_GAPS_COLLECTION || DEFAULT_COLLECTIONS.gaps,
  };
}

export function takeOptionValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return { value, nextIndex: index + 1 };
}

export async function createFirestore(args, FirestoreCtor = Firestore) {
  await assertFirestoreCredentialsAvailable();
  return new FirestoreCtor({
    projectId: args.firestoreProject,
    databaseId: args.firestoreDatabase,
  });
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
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
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

export function firestoreSafeId(value) {
  return String(value).replace(/[/.#[\]]/g, "_");
}

export function firestoreTimestampToMs(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return (
      value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)
    );
  }
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export function buildRunSummaryWrite(run, output, collection) {
  return {
    collection,
    id: run.runId,
    data: stripUndefined({
      ...run,
      mode: output.mode || output.source || run.module,
      source: output.source || null,
      stats: output.stats || null,
      firestore: output.firestore || null,
      relays: output.relays || null,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
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

export function runCli(moduleUrl, parseArgs, runner) {
  if (!isMainModule(moduleUrl)) return;
  runner(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
