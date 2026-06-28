#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { parseBackfillArgs, runBackfill } from "./relay-directory/backfill.mjs";
import { runCli } from "./relay-directory/runtime.mjs";

runCli(import.meta.url, parseBackfillArgs, runBackfill);

export * from "./relay-directory/backfill.mjs";
export * from "./relay-directory/ingestion.mjs";
export * from "./relay-directory/runtime.mjs";
