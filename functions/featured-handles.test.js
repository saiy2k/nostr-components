// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import {
  FEATURED_X_HANDLES,
  listingKeyForHandle,
} from "./featured-handles.js";

test("curated handles fill the first fifty listing slots", () => {
  assert.equal(FEATURED_X_HANDLES.length, 50);
  assert.equal(new Set(FEATURED_X_HANDLES).size, 50);
  for (const handle of FEATURED_X_HANDLES) {
    assert.match(handle, /^[a-z0-9_]{1,15}$/);
  }
  assert.equal(listingKeyForHandle("Jack"), "0-0000");
  assert.equal(listingKeyForHandle("@donmcallister"), "0-0049");
  assert.equal(listingKeyForHandle("alice"), "1-twitter:alice");
  const keys = FEATURED_X_HANDLES.map((handle) => listingKeyForHandle(handle));
  assert.deepEqual(keys, [...keys].sort());
  assert.ok(listingKeyForHandle("jack") < listingKeyForHandle("alice"));
  assert.ok(listingKeyForHandle("alice") < listingKeyForHandle("bob"));
});
