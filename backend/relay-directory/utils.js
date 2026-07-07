// SPDX-License-Identifier: MIT

export function firestoreSafeId(value) {
  return String(value).replace(/[/.#[\]]/g, "_");
}

export function backfillStateId(relay, kind, prefix = "backfill") {
  return firestoreSafeId(`${prefix}:${relay}:kind:${kind}`);
}
