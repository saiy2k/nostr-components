// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  FEATURED_X_HANDLES,
  listingKeyForHandle,
} from "../../functions/featured-handles.js";
import { planListingKeyBackfill } from "./listing-key-backfill.js";

function document(handle, extra = {}) {
  return {
    id: `twitter:${handle}`,
    handle,
    listingKey: "",
    verified: true,
    ...extra,
  };
}

describe("listing key backfill", () => {
  it("sets featured keys first and leaves the alphabetical tail unchanged once written", () => {
    const featured = document("jack");
    const tail = document("alice", { listingKey: "1-twitter:alice" });
    const plan = planListingKeyBackfill([
      tail,
      featured,
      { id: "not-a-handle", verified: true },
    ]);

    expect(plan.updates).toEqual([
      { id: "twitter:jack", listingKey: "0-0000" },
    ]);
    expect(plan.missingFeatured).toContain("lynaldencontact");
    expect(plan.missingFeatured).not.toContain("jack");
  });

  it("treats a mismatched or unverified curated handle as missing and skips an existing key", () => {
    const documents = FEATURED_X_HANDLES.map((handle) =>
      document(handle, {
        listingKey: listingKeyForHandle(handle),
        verified: handle !== "odell",
        handle: handle === "lopp" ? "other" : handle,
      }),
    );
    documents.push(document("zoe", { listingKey: listingKeyForHandle("zoe") }));
    const plan = planListingKeyBackfill(documents);

    expect(plan.updates).toEqual([]);
    expect(plan.missingFeatured).toEqual(["lopp", "odell"]);
    expect(documents[0].listingKey).toBe("0-0000");
    expect(listingKeyForHandle(FEATURED_X_HANDLES[49])).toBe("0-0049");
  });
});
