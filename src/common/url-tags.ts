// SPDX-License-Identifier: MIT

import { normalizeURL as normalizeWithNostrTools } from 'nostr-tools/utils';
import { canonicalUrl } from '../../backend/nostr-pulse/url-canonical.js';
import { getRelayTransport } from './relay-transport';
import { normalizeURL as normalizeWithUtils } from './utils';

function addSpelling(values: string[], value: string | null | undefined) {
  if (value && !values.includes(value)) values.push(value);
}

/**
 * Canonical URL plus each older normalizer's spelling of the same page.
 * Relay tag filters match exact strings, and likes published before the
 * canonical URL still have to count.
 */
export function pageUrlSpellings(raw: string): string[] {
  const values: string[] = [];
  addSpelling(values, canonicalUrl(raw));
  try {
    addSpelling(values, normalizeWithNostrTools(raw));
  } catch {
    // An unparseable page has no nostr-tools spelling.
  }
  addSpelling(values, normalizeWithUtils(raw));
  return values;
}

/** Like `i` tag. A host transport keeps nostr-tools' normalizer. */
export function likeTagUrl(raw: string): string | null {
  if (getRelayTransport()) {
    try {
      return normalizeWithNostrTools(raw);
    } catch {
      return null;
    }
  }
  return canonicalUrl(raw);
}

/** Zap `a` tag URL. A host transport keeps the utils normalizer. */
export function zapTagUrl(raw: string): string {
  if (getRelayTransport()) return normalizeWithUtils(raw);
  return canonicalUrl(raw) ?? normalizeWithUtils(raw);
}

export function likeFilterUrls(raw: string): string[] {
  if (getRelayTransport()) {
    const tag = likeTagUrl(raw);
    return tag ? [tag] : [];
  }
  return pageUrlSpellings(raw);
}

export function zapFilterUrls(raw: string): string[] {
  if (getRelayTransport()) return [zapTagUrl(raw)];
  return pageUrlSpellings(raw);
}
