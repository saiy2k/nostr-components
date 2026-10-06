// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function readPackage(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const COPIED_DEPENDENCIES = [
  "@google-cloud/firestore",
  "@nostr-dev-kit/ndk",
  "@scure/base",
  "light-bolt11-decoder",
  "nostr-tools",
  "ws",
];

test("functions pin the backend versions used by the copied crawler code", () => {
  const functionsPkg = readPackage(join(here, "package.json"));
  const backendPkg = readPackage(join(here, "../backend/package.json"));
  const lock = readPackage(join(here, "package-lock.json"));
  for (const name of COPIED_DEPENDENCIES) {
    const functionsVersion = functionsPkg.dependencies[name];
    const backendVersion = backendPkg.dependencies[name];
    assert.equal(functionsVersion, backendVersion, name);
    assert.match(functionsVersion, /^\d+\.\d+\.\d+$/, name);
    assert.equal(
      lock.packages?.[`node_modules/${name}`]?.version,
      backendVersion,
      `${name} lock`,
    );
  }
});
