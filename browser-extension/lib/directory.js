// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
  const MISS_TTL_MS = 60 * 60 * 1000;
  const DEGRADED_MEMORY_TTL_MS = 5 * 60 * 1000;
  const memoryCache = new Map();

  function getRuntime() {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return { kind: 'browser', runtime: browser.runtime };
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return { kind: 'chrome', runtime: chrome.runtime };
    }
    return null;
  }

  function normalizeHandle(value) {
    const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
  }

  async function sendLookupRequest(handle) {
    const runtime = getRuntime();
    if (!runtime) {
      throw new Error('Browser runtime API is not available');
    }

    const message = {
      type: 'LOOKUP_DIRECTORY_HANDLE',
      platform: 'twitter',
      handle: handle
    };

    let response;
    if (runtime.kind === 'browser') {
      response = await runtime.runtime.sendMessage(message);
    } else {
      response = await new Promise(function (resolve, reject) {
        runtime.runtime.sendMessage(message, function (value) {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(value);
        });
      });
    }

    if (!response || response.ok !== true) {
      throw new Error((response && response.error) || 'Directory lookup failed');
    }
    return response.result;
  }

  function getMemoryEntry(handle) {
    const cached = memoryCache.get(handle);
    if (!cached) {
      return null;
    }
    if (!Number.isFinite(cached.expiresAt) || cached.expiresAt <= Date.now()) {
      memoryCache.delete(handle);
      return null;
    }
    return cached.value;
  }

  function setMemoryEntry(handle, value, expiresAt) {
    memoryCache.set(handle, { value: value, expiresAt: expiresAt });
  }

  async function lookup(value) {
    const handle = normalizeHandle(value);
    if (!handle) {
      return null;
    }

    const memoryEntry = getMemoryEntry(handle);
    if (memoryEntry) {
      return memoryEntry;
    }

    const cached = await extension.storage.getDirectoryEntry(handle, {
      includeExpiry: true
    });
    if (cached && cached.value) {
      setMemoryEntry(handle, cached.value, cached.expiresAt);
      return cached.value;
    }

    try {
      const result = await sendLookupRequest(handle);
      const valueToCache = { ...result, source: 'firestore' };
      const ttlMs = valueToCache.verified ? VERIFIED_TTL_MS : MISS_TTL_MS;
      const expiresAt = Date.now() + ttlMs;
      setMemoryEntry(handle, valueToCache, expiresAt);
      await extension.storage.setDirectoryEntry(handle, valueToCache, ttlMs);
      return valueToCache;
    } catch (_error) {
      const stale = await extension.storage.getDirectoryEntry(handle, {
        allowExpired: true,
        includeExpiry: true
      });
      if (stale && stale.value) {
        const staleValue = { ...stale.value, source: 'stale-cache' };
        setMemoryEntry(handle, staleValue, Date.now() + DEGRADED_MEMORY_TTL_MS);
        return staleValue;
      }

      const miss = {
        found: false,
        verified: false,
        platform: 'twitter',
        handle: handle,
        source: 'unavailable'
      };
      setMemoryEntry(handle, miss, Date.now() + DEGRADED_MEMORY_TTL_MS);
      return miss;
    }
  }

  extension.directory = {
    lookup: lookup,
    normalizeHandle: normalizeHandle
  };
})();
