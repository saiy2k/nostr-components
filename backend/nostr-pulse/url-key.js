// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { canonicalUrl } from "./url-canonical.js";

export { canonicalUrl };

/** sha256 hex of the canonical URL. Null when the URL is not a page. */
export function urlKey(raw) {
  const canonical = canonicalUrl(raw);
  if (!canonical) return null;
  return createHash("sha256").update(canonical).digest("hex");
}
