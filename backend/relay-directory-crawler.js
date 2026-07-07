#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { loadBackfillConfig, runBackfill } from "./relay-directory/backfill.js";
import { runMain } from "./relay-directory/runtime.js";

runMain(import.meta.url, () => runBackfill(loadBackfillConfig()));
