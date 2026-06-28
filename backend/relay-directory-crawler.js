#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  loadBackfillConfig,
  runBackfill,
} from "./relay-directory/backfill.js";
import {
  parseLiveArgs,
  runLiveMonitor,
} from "./relay-directory/live-monitor.js";
import { isMainModule } from "./relay-directory/runtime.js";

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const isLive = argv.includes("--live-listen");
  const normalized = argv.filter((flag) => flag !== "--live-listen");
  const parseArgs = isLive ? parseLiveArgs : () => loadBackfillConfig();
  const runner = isLive ? runLiveMonitor : runBackfill;

  runner(parseArgs(normalized)).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

export * from "./relay-directory/backfill.js";
export * from "./relay-directory/ingestion.js";
export * from "./relay-directory/live-monitor.js";
export * from "./relay-directory/runtime.js";
