// SPDX-License-Identifier: MIT
"use strict";
(() => {
  // node_modules/nostr-tools/lib/esm/utils.js
  var utf8Decoder = new TextDecoder("utf-8");
  var utf8Encoder = new TextEncoder();
  function normalizeURL(url) {
    if (url.indexOf("://") === -1)
      url = "wss://" + url;
    let p = new URL(url);
    p.pathname = p.pathname.replace(/\/+/g, "/");
    if (p.pathname.endsWith("/"))
      p.pathname = p.pathname.slice(0, -1);
    if (p.port === "80" && p.protocol === "ws:" || p.port === "443" && p.protocol === "wss:")
      p.port = "";
    p.searchParams.sort();
    p.hash = "";
    return p.toString();
  }

  // browser-extension/src/url.js
  (function() {
    const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
    const STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)\/?$/;
    function parseTweetUrl(href, origin) {
      try {
        const url = new URL(href, origin || window.location.origin);
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
          canonicalUrl: normalizeURL(url.toString())
        };
      } catch (_error) {
        return null;
      }
    }
    extension.url = {
      normalizeURL,
      parseTweetUrl
    };
  })();
})();
