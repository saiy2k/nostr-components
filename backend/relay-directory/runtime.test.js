// SPDX-License-Identifier: MIT

import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./runtime.js";

const ORIGINAL_ARGV = [...process.argv];

afterEach(() => {
  process.argv = [...ORIGINAL_ARGV];
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe("CLI lifecycle", () => {
  it("uses the forced-exit path after a successful command", async () => {
    process.argv = [process.execPath, "/tmp/relay-directory-cli.js", "--flag"];
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined);
    const parseArgs = vi.fn(() => ({ parsed: true }));
    const runner = vi.fn(async () => {});

    await runCli(
      pathToFileURL(process.argv[1]).href,
      parseArgs,
      runner,
    );

    expect(parseArgs).toHaveBeenCalledWith(["--flag"]);
    expect(runner).toHaveBeenCalledWith({ parsed: true });
    expect(exit).toHaveBeenCalledWith(0);
  });
});
