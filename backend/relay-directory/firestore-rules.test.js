// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rulesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../firestore.rules",
);
const rules = readFileSync(rulesPath, "utf8");

const SERVER_ONLY_COLLECTIONS = [
  "nostrDirectoryHandles",
  "relayCrawlerState",
  "relayCrawlerGaps",
  "nostrDirectoryHandleWriteFailures",
  "relayProjectionRuns",
];

describe("directory Firestore rules", () => {
  it("denies client access to every directory collection", () => {
    for (const collection of SERVER_ONLY_COLLECTIONS) {
      const block = rules.match(
        new RegExp(
          `match /${collection}/\\{[^}]+\\} \\{[\\s\\S]*?\\}`,
        ),
      );
      expect(block, collection).not.toBeNull();
      expect(block[0]).toContain("allow read, write: if false;");
      expect(block[0]).not.toMatch(/allow read,\s*write:\s*if true/);
    }
  });

  it("denies client access to any other document in the directory database", () => {
    expect(rules).toContain("match /{document=**} {");
    expect(rules).not.toMatch(/allow read:\s*if true/);
    expect(rules).not.toMatch(/allow write:\s*if true/);
  });
});
