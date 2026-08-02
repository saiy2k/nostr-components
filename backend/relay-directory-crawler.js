#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import {
  loadBackfillConfig,
  runBackfill,
} from "./relay-directory/backfill.js";
import {
  parseProjectionArgs,
  runProjection,
} from "./relay-directory/projection.js";
import { isMainModule } from "./relay-directory/runtime.js";

if (isMainModule(import.meta.url)) {
  const { mode, argv } = parseLegacyMode(process.argv.slice(2));
  const modules = {
    backfill: [
      (remainingArgv) =>
        loadBackfillConfig(process.env, undefined, {}, remainingArgv),
      runBackfill,
    ],
    project: [parseProjectionArgs, runProjection],
  };
  const [parseArgs, runner] = modules[mode];

  runner(parseArgs(argv)).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

function parseLegacyMode(argv) {
  let mode = "project";
  const normalized = [];

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--backfill") mode = "backfill";
    else if (flag === "--project-directory") mode = "project";
    else if (flag === "--mode") {
      const value = argv[index + 1];
      if (!["backfill", "project"].includes(value)) {
        throw new Error("--mode must be backfill or project.");
      }
      mode = value;
      index += 1;
    } else {
      normalized.push(flag);
    }
  }

  return { mode, argv: normalized };
}

export * from "./relay-directory/backfill.js";
export * from "./relay-directory/ingestion.js";
export * from "./relay-directory/projection.js";
export * from "./relay-directory/projection-state.js";
export * from "./relay-directory/runtime.js";
export * from "./relay-directory/x-identity.js";
