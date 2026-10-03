// SPDX-License-Identifier: MIT

(function (global) {
  const extension = global.NostrLikeExtension = global.NostrLikeExtension || {};
  // Invoice URLs embed the signed zap request, including every relay in the
  // request. Fifty relay URLs plus a comment exceed 2048 characters.
  const MAX_URL_LENGTH = 8192;
  const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  function isBlockedIPv4(hostname) {
    const match = hostname.match(IPV4_PATTERN);
    if (!match) return false;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
    if (parts.some(function (part) { return part > 255; })) return true;
    const first = parts[0];
    const second = parts[1];
    if (first === 0 || first === 10 || first === 127) return true;
    if (first === 169 && second === 254) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    return false;
  }

  function normalizeZapHttpUrl(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
      return null;
    }

    let url;
    try {
      url = new URL(value);
    } catch (_error) {
      return null;
    }

    if (url.protocol !== 'https:') return null;
    if (url.username !== '' || url.password !== '') return null;
    if (url.port !== '' && url.port !== '443') return null;
    if (url.hash !== '') return null;

    const host = url.hostname.replace(/\.$/, '').toLowerCase();
    if (!host || host.includes(':') || !host.includes('.')) return null;
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    if (host.startsWith('-') || host.endsWith('-') || host.includes('..')) return null;
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal'
    ) {
      return null;
    }
    if (isBlockedIPv4(host)) return null;
    return url.toString();
  }

  extension.zapHttp = {
    normalizeZapHttpUrl: normalizeZapHttpUrl,
    isAllowedZapHttpUrl: function (value) {
      return Boolean(normalizeZapHttpUrl(value));
    }
  };
})(globalThis);
