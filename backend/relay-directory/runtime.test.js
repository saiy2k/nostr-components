// SPDX-License-Identifier: MIT

import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMain } from "./runtime.js";

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
