#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  buildLiveHeartbeatWrite,
  buildRawEventIngestionWrites,
  createNdkRelayClient,
  isValidSignedEvent,
} from "./ingestion.js";
import {
  DEFAULT_RELAYS,
  IDENTITY_KINDS,
  buildRunSummaryWrite,
  commitFirestoreWrites,
  createFirestore,
  createRunMetrics,
  finishRunMetrics,
  firestoreConfigFromEnv,
  logRunSummary,
  runCli,
  takeOptionValue,
  writeJson,
} from "./runtime.js";

export function parseLiveArgs(argv) {
  const args = {
    ...firestoreConfigFromEnv(),
    relays: DEFAULT_RELAYS,
    out: null,
    liveDurationMs: Number(process.env.LIVE_DURATION_MS || 0),
    liveFlushLimit: Number(process.env.LIVE_FLUSH_LIMIT || 25),
    liveFlushIntervalMs: Number(process.env.LIVE_FLUSH_INTERVAL_MS || 5000),
    liveHeartbeatIntervalMs: Number(
      process.env.LIVE_HEARTBEAT_INTERVAL_MS || 30000,
    ),
    liveSeenCacheLimit: Number(process.env.LIVE_SEEN_CACHE_LIMIT || 50000),
    liveConnectTimeoutMs: Number(process.env.LIVE_CONNECT_TIMEOUT_MS || 15000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const take = () => {
      const result = takeOptionValue(argv, index, flag);
      index = result.nextIndex;
      return result.value;
    };

    if (flag === "--live-listen") continue;
    if (flag === "--relays") {
      args.relays = take()
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (flag === "--out") args.out = take();
    else if (flag === "--no-json") args.out = null;
    else if (flag === "--firestore-project") args.firestoreProject = take();
    else if (flag === "--firestore-database") args.firestoreDatabase = take();
    else if (flag === "--firestore-live-runs-collection") {
      args.firestoreLiveRunsCollection = take();
    } else if (flag === "--firestore-events-collection") {
      args.firestoreEventsCollection = take();
    } else if (flag === "--firestore-queue-collection") {
      args.firestoreQueueCollection = take();
    } else if (flag === "--firestore-state-collection") {
      args.firestoreStateCollection = take();
    } else if (flag === "--live-duration-ms") {
      args.liveDurationMs = Number(take());
    } else if (flag === "--live-flush-limit") {
      args.liveFlushLimit = Number(take());
    } else if (flag === "--live-flush-interval-ms") {
      args.liveFlushIntervalMs = Number(take());
    } else if (flag === "--live-heartbeat-interval-ms") {
      args.liveHeartbeatIntervalMs = Number(take());
    } else if (flag === "--live-seen-cache-limit") {
      args.liveSeenCacheLimit = Number(take());
    } else if (flag === "--live-connect-timeout-ms") {
      args.liveConnectTimeoutMs = Number(take());
    } else if (flag === "--help" || flag === "-h") {
      printLiveHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown live-monitor argument: ${flag}`);
    }
  }

  validateLiveArgs(args);
  return args;
}

function validateLiveArgs(args) {
  if (!args.firestoreProject) {
    throw new Error("--firestore-project or GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!args.relays.length) throw new Error("At least one relay is required.");
  if (!Number.isFinite(args.liveDurationMs) || args.liveDurationMs < 0) {
    throw new Error(
      "--live-duration-ms must be >= 0. Use 0 to run until stopped.",
    );
  }
  if (!Number.isFinite(args.liveFlushLimit) || args.liveFlushLimit <= 0) {
    throw new Error("--live-flush-limit must be positive.");
  }
  if (
    !Number.isFinite(args.liveFlushIntervalMs) ||
    args.liveFlushIntervalMs <= 0
  ) {
    throw new Error("--live-flush-interval-ms must be positive.");
  }
  if (
    !Number.isFinite(args.liveHeartbeatIntervalMs) ||
    args.liveHeartbeatIntervalMs <= 0
  ) {
    throw new Error("--live-heartbeat-interval-ms must be positive.");
  }
  if (
    !Number.isFinite(args.liveSeenCacheLimit) ||
    args.liveSeenCacheLimit <= 0
  ) {
    throw new Error("--live-seen-cache-limit must be positive.");
  }
  if (
    !Number.isFinite(args.liveConnectTimeoutMs) ||
    args.liveConnectTimeoutMs <= 0
  ) {
    throw new Error("--live-connect-timeout-ms must be positive.");
  }
}

function printLiveHelp() {
  console.log(`Usage: npm run crawl:directory:live -- [options]

Continuously ingest signed Nostr kind:10011 and kind:0 events into Firestore.

Options:
  --relays <csv>                       Relays to monitor.
  --firestore-project <id>             GCP project.
  --live-duration-ms <n>               0 runs until stopped. Default: 0
  --live-flush-limit <n>               Buffered events before flush. Default: 25
  --live-flush-interval-ms <n>         Max time between flushes. Default: 5000
  --live-heartbeat-interval-ms <n>     Relay heartbeat interval. Default: 30000
  --live-seen-cache-limit <n>          In-memory dedupe size. Default: 50000
  --live-connect-timeout-ms <n>        NDK connection timeout. Default: 15000
  --out <file>                         Optional JSON run summary.
`);
}

export async function runLiveMonitor(args, FirestoreCtor) {
  const runMetrics = createRunMetrics("live-monitor");
  const db = await createFirestore(args, FirestoreCtor);
  const startedAt = new Date().toISOString();
  const stopController = new AbortController();
  const totals = {
    relayCount: args.relays.length,
    connectAttempts: 0,
    reconnects: 0,
    relayDisconnects: 0,
    relayErrors: 0,
    eventsReceived: 0,
    validEventsBuffered: 0,
    validEventsWritten: 0,
    invalidEventsDropped: 0,
    duplicateEvents: 0,
    flushes: 0,
    heartbeatWrites: 0,
  };
  const seenEventIds = new Set();
  const seenEventIdQueue = [];
  const buffer = [];
  let stopReason = "stopped";
  let flushInFlight = Promise.resolve();

  const stop = (reason) => {
    if (stopController.signal.aborted) return;
    stopReason = reason;
    stopController.abort(reason);
  };

  const signalHandlers = [];
  for (const signalName of ["SIGINT", "SIGTERM"]) {
    const handler = () => stop(signalName);
    process.once(signalName, handler);
    signalHandlers.push([signalName, handler]);
  }

  const durationTimer =
    args.liveDurationMs > 0
      ? setTimeout(() => stop("duration_elapsed"), args.liveDurationMs)
      : null;

  const flushBuffer = async () => {
    if (!buffer.length) return;
    const writes = buffer.slice();
    const rawEventWrites = writes.filter(
      (write) =>
        write.collection === args.firestoreEventsCollection && !write.operation,
    ).length;
    await commitFirestoreWrites(db, writes);
    buffer.splice(0, writes.length);
    totals.validEventsWritten += rawEventWrites;
    totals.flushes += 1;
  };

  const scheduleFlush = () => {
    flushInFlight = flushInFlight.then(flushBuffer, flushBuffer);
    return flushInFlight;
  };

  const flushInterval = setInterval(scheduleFlush, args.liveFlushIntervalMs);

  console.log(
    `Monitoring ${args.relays.length} relays for kinds ${IDENTITY_KINDS.join(",")} into ${args.firestoreProject}/${args.firestoreDatabase}...`,
  );

  const listeners = args.relays.map((relay) =>
    listenRelayLive(relay, args, {
      signal: stopController.signal,
      onConnectAttempt: () => {
        totals.connectAttempts += 1;
      },
      onReconnect: () => {
        totals.reconnects += 1;
      },
      onDisconnect: () => {
        totals.relayDisconnects += 1;
      },
      onError: () => {
        totals.relayErrors += 1;
      },
      onEvent: (event) => {
        totals.eventsReceived += 1;
        if (!isValidSignedEvent(event)) {
          totals.invalidEventsDropped += 1;
          return;
        }
        if (seenEventIds.has(event.id)) {
          totals.duplicateEvents += 1;
          return;
        }
        rememberSeenEventId(
          event.id,
          seenEventIds,
          seenEventIdQueue,
          args.liveSeenCacheLimit,
        );
        buffer.push(
          ...buildRawEventIngestionWrites(event, relay, "live", args),
        );
        totals.validEventsBuffered += 1;
        if (buffer.length >= args.liveFlushLimit) scheduleFlush();
      },
      onHeartbeat: async (status) => {
        await commitFirestoreWrites(db, [
          buildLiveHeartbeatWrite(status, args),
        ]);
        totals.heartbeatWrites += 1;
      },
    }),
  );

  await Promise.all(listeners);
  clearInterval(flushInterval);
  if (durationTimer) clearTimeout(durationTimer);
  await scheduleFlush();

  for (const [signalName, handler] of signalHandlers) {
    process.removeListener(signalName, handler);
  }

  const output = {
    mode: "live",
    run: finishRunMetrics(runMetrics, totals),
    startedAt,
    finishedAt: new Date().toISOString(),
    stopReason,
    relays: args.relays,
    kinds: IDENTITY_KINDS,
    stats: totals,
    firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      eventsCollection: args.firestoreEventsCollection,
      queueCollection: args.firestoreQueueCollection,
      stateCollection: args.firestoreStateCollection,
    },
  };

  await commitFirestoreWrites(db, [
    buildRunSummaryWrite(output.run, output, args.firestoreLiveRunsCollection),
  ]);
  logRunSummary(output.run);
  if (args.out) await writeJson(args.out, output);
  printLiveSummary(output, args);
  return output;
}

export function listenRelayLive(
  relay,
  args,
  callbacks,
  clientFactory = createNdkRelayClient,
) {
  const {
    signal,
    onConnectAttempt,
    onReconnect,
    onDisconnect,
    onError,
    onEvent,
    onHeartbeat,
  } = callbacks;

  return new Promise((resolve) => {
    const client = clientFactory(relay);
    let stopSubscription = null;
    let stopStatusListeners = null;
    let heartbeatTimer = null;
    let attempts = 0;
    let connected = false;
    let lastEventAt = null;
    let stopped = false;

    const cleanup = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      stopSubscription?.();
      stopStatusListeners?.();
      client.close?.();
    };

    const heartbeat = async (status) => {
      if (!onHeartbeat) return;
      await onHeartbeat({
        relay,
        status,
        mode: "live",
        connected,
        lastEventAt,
        attempts,
      });
    };

    const finish = async () => {
      if (stopped) return;
      stopped = true;
      cleanup();
      await heartbeat("stopped").catch(() => {});
      resolve();
    };

    stopStatusListeners = client.onStatus?.({
      onConnecting: () => {
        attempts += 1;
        onConnectAttempt?.();
        if (attempts > 1) onReconnect?.();
      },
      onConnect: () => {
        if (stopped || signal.aborted) return;
        connected = true;
        heartbeat("connected").catch(() => {});
      },
      onDisconnect: () => {
        if (stopped || signal.aborted) return;
        connected = false;
        onDisconnect?.();
        heartbeat("disconnected").catch(() => {});
      },
    });

    signal.addEventListener("abort", finish, { once: true });
    heartbeatTimer = setInterval(() => {
      heartbeat(connected ? "connected" : "disconnected").catch(() => {});
    }, args.liveHeartbeatIntervalMs);

    Promise.resolve(client.connect(args.liveConnectTimeoutMs))
      .then(() => {
        if (stopped || signal.aborted) return;
        stopSubscription = client.subscribe(
          { kinds: IDENTITY_KINDS, since: Math.floor(Date.now() / 1000) },
          {
            onEvent: (event) => {
              if (!event?.id) return;
              lastEventAt = new Date().toISOString();
              onEvent?.(event, relay);
            },
            onClosed: () => onError?.(),
          },
        );
      })
      .catch(() => {
        if (!stopped) {
          onError?.();
          finish();
        }
      });
  });
}

export function rememberSeenEventId(
  eventId,
  seenEventIds,
  seenEventIdQueue,
  limit,
) {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  seenEventIdQueue.push(eventId);
  while (seenEventIdQueue.length > limit) {
    const expired = seenEventIdQueue.shift();
    seenEventIds.delete(expired);
  }
  return true;
}

function printLiveSummary(output, args) {
  console.log("\nLive monitor stopped.");
  console.log(`  stop reason:          ${output.stopReason}`);
  console.log(`  relays:               ${output.stats.relayCount}`);
  console.log(`  connect attempts:     ${output.stats.connectAttempts}`);
  console.log(`  reconnects:           ${output.stats.reconnects}`);
  console.log(`  relay disconnects:    ${output.stats.relayDisconnects}`);
  console.log(`  relay errors:         ${output.stats.relayErrors}`);
  console.log(`  events received:      ${output.stats.eventsReceived}`);
  console.log(`  valid events written: ${output.stats.validEventsWritten}`);
  console.log(`  invalid dropped:      ${output.stats.invalidEventsDropped}`);
  console.log(`  duplicates:           ${output.stats.duplicateEvents}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore events:     ${args.firestoreEventsCollection}`);
  console.log(`  firestore state:      ${args.firestoreStateCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

runCli(import.meta.url, parseLiveArgs, runLiveMonitor);
