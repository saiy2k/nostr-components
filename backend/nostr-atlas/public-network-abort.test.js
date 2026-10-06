// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { fetchPublicHttps } from "./public-network.js";

describe("fetchPublicHttps", () => {
  it("rejects when the signal aborts during DNS lookup", async () => {
    let finishLookup;
    lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLookup = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = fetchPublicHttps(
      "https://example.com/.well-known/lnurlp/alice",
      { signal: controller.signal },
    );

    expect(lookup).toHaveBeenCalledTimes(1);
    controller.abort(new Error("aborted"));
    await expect(pending).rejects.toThrow(/aborted/);

    finishLookup([{ address: "1.1.1.1", family: 4 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
