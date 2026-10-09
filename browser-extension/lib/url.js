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

  // backend/nostr-pulse/url-canonical.js
  var STATUS_HOSTS = /* @__PURE__ */ new Set([
    "x.com",
    "www.x.com",
    "m.x.com",
    "mobile.x.com",
    "twitter.com",
    "www.twitter.com",
    "m.twitter.com",
    "mobile.twitter.com"
  ]);
  var STATUS_PATH = /^\/([^/]+)\/status\/(\d+)\/?$/;
  var YOUTUBE_HOSTS = /* @__PURE__ */ new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
  var YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  function stripMobileHost(hostname) {
    let host = hostname;
    let previous;
    do {
      previous = host;
      host = host.replace(/^(?:m|mobile)\./, "");
    } while (host !== previous);
    return host;
  }
  function canonicalStatus(url) {
    if (!STATUS_HOSTS.has(url.hostname)) return null;
    const match = url.pathname.match(STATUS_PATH);
    if (!match) return null;
    return `https://x.com/${match[1].toLowerCase()}/status/${match[2]}`;
  }
  function canonicalVideo(url) {
    let videoId = null;
    if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] || null;
    } else if (url.hostname === "youtu.be") {
      videoId = url.pathname.split("/")[1] || null;
    }
    if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  var TRACKING_PARAMS = /* @__PURE__ */ new Set(["fbclid", "gclid", "mc_cid"]);
  function isTrackingParam(key) {
    const name = key.toLowerCase();
    return name.startsWith("utm_") || TRACKING_PARAMS.has(name);
  }
  function canonicalGeneric(url) {
    const host = stripMobileHost(url.hostname);
    if (!host) return null;
    const port = url.port ? `:${url.port}` : "";
    const pathname = url.pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (isTrackingParam(key)) params.delete(key);
    }
    params.sort();
    const query = params.toString();
    return `https://${host}${port}${pathname}${query ? `?${query}` : ""}`;
  }
  function canonicalUrl(raw) {
    if (typeof raw !== "string" || !raw) return null;
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return canonicalStatus(url) || canonicalVideo(url) || canonicalGeneric(url);
  }

  // browser-extension/src/url.js
  (function() {
    const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
    const STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)\/?$/;
    const STATUS_HOSTS2 = /* @__PURE__ */ new Set([
      "x.com",
      "www.x.com",
      "m.x.com",
      "mobile.x.com",
      "twitter.com",
      "www.twitter.com",
      "m.twitter.com",
      "mobile.twitter.com"
    ]);
    const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const BECH32_GENERATORS = [
      996825010,
      642813549,
      513874426,
      1027748829,
      705979059
    ];
    function parseTweetUrl(href, origin) {
      try {
        const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : void 0);
        const url = new URL(href, baseOrigin);
        if (!STATUS_HOSTS2.has(url.hostname)) {
          return null;
        }
        const match = url.pathname.match(STATUS_PATH_PATTERN);
        if (!match) {
          return null;
        }
        url.protocol = "https:";
        url.hostname = "x.com";
        url.search = "";
        url.hash = "";
        const canonicalUrl2 = canonicalUrl(url.toString());
        if (!canonicalUrl2) return null;
        return {
          pathname: url.pathname.replace(/\/$/, ""),
          username: match[1].toLowerCase(),
          statusId: match[2],
          canonicalUrl: canonicalUrl2
        };
      } catch (_error) {
        return null;
      }
    }
    function parseYouTubeUrl(href, origin) {
      try {
        const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : void 0);
        const url = new URL(href, baseOrigin);
        let videoId = null;
        if ((url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "m.youtube.com") && url.pathname === "/watch") {
          videoId = url.searchParams.get("v");
        } else if ((url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "m.youtube.com") && url.pathname.startsWith("/shorts/")) {
          videoId = url.pathname.split("/")[2] || null;
        } else if (url.hostname === "youtu.be") {
          videoId = url.pathname.split("/")[1] || null;
        }
        if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
          return null;
        }
        const canonicalUrl2 = canonicalUrl(url.toString());
        if (!canonicalUrl2) return null;
        return {
          videoId,
          canonicalUrl: canonicalUrl2
        };
      } catch (_error) {
        return null;
      }
    }
    function isValidNpub(value) {
      const original = String(value || "");
      if (original !== original.toLowerCase()) {
        return false;
      }
      const normalized = original;
      if (!/^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(normalized)) {
        return false;
      }
      let checksum = 1;
      const values = [3, 3, 3, 3, 0, 14, 16, 21, 2];
      for (const char of normalized.slice(5)) {
        values.push(BECH32_CHARSET.indexOf(char));
      }
      for (const item of values) {
        const top = checksum >>> 25;
        checksum = (checksum & 33554431) << 5 ^ item;
        for (let index = 0; index < BECH32_GENERATORS.length; index += 1) {
          if (top >>> index & 1) checksum ^= BECH32_GENERATORS[index];
        }
      }
      return checksum === 1;
    }
    async function urlKey(value) {
      const canonical = canonicalUrl(value);
      if (!canonical || !globalThis.crypto?.subtle) return null;
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical)
      );
      return Array.from(new Uint8Array(digest), function(byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    }
    extension.url = {
      normalizeURL,
      canonicalUrl,
      urlKey,
      parseTweetUrl,
      parseYouTubeUrl,
      isValidNpub
    };
  })();
})();
