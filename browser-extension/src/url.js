// SPDX-License-Identifier: MIT

import { normalizeURL } from 'nostr-tools/utils';

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)\/?$/;
  const SUPPORTED_HOSTNAMES = new Set(['x.com', 'twitter.com']);
  const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const BECH32_GENERATORS = [
    0x3b6a57b2,
    0x26508e6d,
    0x1ea119fa,
    0x3d4233dd,
    0x2a1462b3
  ];

  function parseTweetUrl(href, origin) {
    try {
      const baseOrigin = origin || (
        typeof window !== 'undefined' ? window.location.origin : undefined
      );
      const url = new URL(href, baseOrigin);
      if (!SUPPORTED_HOSTNAMES.has(url.hostname)) {
        return null;
      }
      const match = url.pathname.match(STATUS_PATH_PATTERN);
      if (!match) {
        return null;
      }

      url.search = '';
      url.hash = '';

      return {
        pathname: url.pathname.replace(/\/$/, ''),
        username: match[1].toLowerCase(),
        statusId: match[2],
        canonicalUrl: normalizeURL(url.toString())
      };
    } catch (_error) {
      return null;
    }
  }

  function parseYouTubeUrl(href, origin) {
    try {
      const baseOrigin = origin || (
        typeof window !== 'undefined' ? window.location.origin : undefined
      );
      const url = new URL(href, baseOrigin);
      let videoId = null;
      if (
        (url.hostname === 'www.youtube.com' ||
          url.hostname === 'youtube.com' ||
          url.hostname === 'm.youtube.com') &&
        url.pathname === '/watch'
      ) {
        videoId = url.searchParams.get('v');
      } else if (
        (url.hostname === 'www.youtube.com' ||
          url.hostname === 'youtube.com' ||
          url.hostname === 'm.youtube.com') &&
        url.pathname.startsWith('/shorts/')
      ) {
        videoId = url.pathname.split('/')[2] || null;
      } else if (url.hostname === 'youtu.be') {
        videoId = url.pathname.split('/')[1] || null;
      }

      if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
        return null;
      }
      return {
        videoId: videoId,
        canonicalUrl: 'https://www.youtube.com/watch?v=' + videoId
      };
    } catch (_error) {
      return null;
    }
  }

  function isValidNpub(value) {
    const original = String(value || '');
    if (original !== original.toLowerCase()) {
      return false;
    }
    const normalized = original;
    if (!/^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(normalized)) {
      return false;
    }

    let checksum = 1;
    const values = [3, 3, 3, 3, 0, 14, 16, 21, 2]; // HRP expansion for "npub".
    for (const char of normalized.slice(5)) {
      values.push(BECH32_CHARSET.indexOf(char));
    }
    for (const item of values) {
      const top = checksum >>> 25;
      checksum = ((checksum & 0x1ffffff) << 5) ^ item;
      for (let index = 0; index < BECH32_GENERATORS.length; index += 1) {
        if ((top >>> index) & 1) checksum ^= BECH32_GENERATORS[index];
      }
    }
    return checksum === 1;
  }

  extension.url = {
    normalizeURL,
    parseTweetUrl,
    parseYouTubeUrl,
    isValidNpub
  };
})();
