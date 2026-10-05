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

const COPIED_DEPENDENCIES = ["@google-cloud/firestore", "nostr-tools", "ws"];

test("functions pin the backend versions used by the copied crawler code", () => {
  const functionsPkg = readPackage(join(here, "package.json"));
  const backendPkg = readPackage(join(here, "../backend/package.json"));
  for (const name of COPIED_DEPENDENCIES) {
    const functionsVersion = functionsPkg.dependencies[name];
    const backendVersion = backendPkg.dependencies[name];
    assert.equal(functionsVersion, backendVersion, name);
    assert.match(functionsVersion, /^\d+\.\d+\.\d+$/, name);
  }
  assert.equal(functionsPkg.dependencies["@nostr-dev-kit/ndk"], undefined);
  assert.equal(backendPkg.dependencies["@nostr-dev-kit/ndk"], undefined);
});
