#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { parseBackfillArgs, runBackfill } from "./relay-directory/backfill.mjs";
import {
  parseLiveArgs,
  runLiveMonitor,
} from "./relay-directory/live-monitor.mjs";
import { isMainModule } from "./relay-directory/runtime.mjs";

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const isLive = argv.includes("--live-listen");
  const normalized = argv.filter((flag) => flag !== "--live-listen");
  const parseArgs = isLive ? parseLiveArgs : parseBackfillArgs;
  const runner = isLive ? runLiveMonitor : runBackfill;

  runner(parseArgs(normalized)).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

export * from "./relay-directory/backfill.mjs";
export * from "./relay-directory/ingestion.mjs";
export * from "./relay-directory/live-monitor.mjs";
export * from "./relay-directory/runtime.mjs";
