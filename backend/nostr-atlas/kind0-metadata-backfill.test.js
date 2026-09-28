// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { parseArgs } from "./kind0-metadata-backfill.js";

describe("kind 0 metadata backfill args", () => {
  it("rejects an invalid handle instead of scanning every identity", () => {
    expect(() => parseArgs(["--write", "--handle", "saiy2k@iris.to"])).toThrow(
      /Invalid --handle/,
    );
  });

  it("accepts a normalized handle", () => {
    expect(parseArgs(["--handle", "@Saiy2k"]).handles).toEqual(["saiy2k"]);
  });

  it("leaves a full scan available when no handle is passed", () => {
    expect(parseArgs(["--write"]).handles).toEqual([]);
  });
});
