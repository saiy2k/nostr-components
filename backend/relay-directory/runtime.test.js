// SPDX-License-Identifier: MIT

import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firestoreTimestampToMs, runMain } from "./runtime.js";

const ORIGINAL_ARGV = [...process.argv];

afterEach(() => {
  process.argv = [...ORIGINAL_ARGV];
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe("job lifecycle", () => {
  it("uses the forced-exit path after a successful run", async () => {
    process.argv = [process.execPath, "/tmp/relay-directory-job.js"];
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined);
    const runner = vi.fn(async () => {});

    await runMain(pathToFileURL(process.argv[1]).href, runner);

    expect(runner).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe("firestoreTimestampToMs", () => {
  it.each([
    [0, 0],
    [new Date("2026-08-07T00:00:00.000Z"), 1_786_060_800_000],
    [{ toMillis: () => 1_234 }, 1_234],
    [{ seconds: 2, nanoseconds: 999_999_999 }, 2_999],
    ["1970-01-01T00:00:00.000Z", 0],
  ])("converts %j to milliseconds", (value, expected) => {
    expect(firestoreTimestampToMs(value)).toBe(expected);
  });

  it.each([null, undefined, new Date("invalid"), { toMillis: () => NaN }])(
    "returns null for an absent or invalid value",
    (value) => {
      expect(firestoreTimestampToMs(value)).toBeNull();
    },
  );
});
