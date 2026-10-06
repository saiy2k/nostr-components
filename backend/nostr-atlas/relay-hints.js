// SPDX-License-Identifier: MIT

export const MAX_RELAY_HINTS = 5;

/** Canonical `wss://` relay URL. Returns null for anything else. */
export function normalizeRelayUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "wss:" || url.username || url.password) return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.port === "443") url.port = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }
  return url.toString();
}

export function normalizeRelayHints(values) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(values) ? values : [values];
  for (const value of list.flat()) {
    const url = normalizeRelayUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_RELAY_HINTS) break;
  }
  return out;
}

export function mergeRelayHints(...groups) {
  return normalizeRelayHints(groups);
}
