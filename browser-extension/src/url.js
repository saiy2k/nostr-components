// SPDX-License-Identifier: MIT

import { normalizeURL } from "nostr-tools/utils";

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)\/?$/;
  const SUPPORTED_HOSTNAMES = new Set(["x.com", "twitter.com"]);

  /** Parse an X status link and normalize its NIP-25 URL identifier. */
  function parseTweetUrl(href, origin) {
    try {
      const url = new URL(href, origin || window.location.origin);
      if (!SUPPORTED_HOSTNAMES.has(url.hostname)) {
        return null;
      }
      const match = url.pathname.match(STATUS_PATH_PATTERN);
      if (!match) {
        return null;
      }

      url.search = "";
      url.hash = "";

      return {
        pathname: url.pathname.replace(/\/$/, ""),
        username: match[1].toLowerCase(),
        statusId: match[2],
        canonicalUrl: normalizeURL(url.toString()),
      };
    } catch (_error) {
      return null;
    }
  }

  extension.url = {
    normalizeURL,
    parseTweetUrl,
  };
})();
