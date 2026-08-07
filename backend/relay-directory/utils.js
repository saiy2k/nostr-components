// SPDX-License-Identifier: MIT

export function firestoreSafeId(value) {
  return String(value).replace(/[/.#[\]]/g, "_");
}

export function isHexPubkey(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

export function isPublicHostname(value) {
  const hostname = String(value || "").trim().toLowerCase();
  if (!hostname || hostname.length > 253) return false;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

export function backfillStateId(relay, kind, prefix = "backfill") {
  return firestoreSafeId(`${prefix}:${relay}:kind:${kind}`);
}
