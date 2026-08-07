// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
  const MISS_TTL_MS = 60 * 60 * 1000;
  const memoryCache = new Map();
  let bundledDirectoryPromise = null;

  /** Resolve the browser runtime messaging API. */
  function getRuntime() {
    if (typeof browser !== "undefined" && browser.runtime) {
      return { kind: "browser", runtime: browser.runtime };
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return { kind: "chrome", runtime: chrome.runtime };
    }
    return null;
  }

  /** Normalize and validate an X handle for directory lookup. */
  function normalizeHandle(value) {
    const handle = String(value || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
  }

  /** Ask the background service worker to query the Firestore lookup endpoint. */
  async function sendLookupRequest(handle) {
    const runtime = getRuntime();
    if (!runtime) {
      throw new Error("Browser runtime API is not available");
    }

    const message = {
      type: "LOOKUP_DIRECTORY_HANDLE",
      platform: "twitter",
      handle: handle,
    };

    let response;
    if (runtime.kind === "browser") {
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
      throw new Error(
        (response && response.error) || "Directory lookup failed",
      );
    }
    return response.result;
  }

  /** Load the compatibility directory used only when the backend is unavailable. */
  async function loadBundledDirectory() {
    if (bundledDirectoryPromise) {
      return bundledDirectoryPromise;
    }

    const runtime = getRuntime();
    if (!runtime) {
      return {};
    }

    bundledDirectoryPromise = fetch(
      runtime.runtime.getURL("verified-directory.json"),
    )
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load bundled directory");
        }
        return response.json();
      })
      .catch(function () {
        bundledDirectoryPromise = null;
        return {};
      });

    return bundledDirectoryPromise;
  }

  /** Convert a bundled directory record to the public lookup response shape. */
  async function bundledFallback(handle) {
    const directory = await loadBundledDirectory();
    const entry = directory[handle];
    if (!entry || entry.verified !== true) {
      return {
        found: false,
        verified: false,
        platform: "twitter",
        handle: handle,
        source: "bundled-fallback",
      };
    }

    return {
      found: true,
      verified: true,
      platform: "twitter",
      handle: handle,
      source: "bundled-fallback",
      activeIdentity: {
        npub: entry.npub,
        proofUrl: entry.proofUrl,
        status: "verified",
      },
    };
  }

  /** Resolve author metadata through memory, extension storage, Firestore, then fallback. */
  async function lookup(value) {
    const handle = normalizeHandle(value);
    if (!handle) {
      return null;
    }

    if (memoryCache.has(handle)) {
      return memoryCache.get(handle);
    }

    const cached = await extension.storage.getDirectoryEntry(handle);
    if (cached) {
      memoryCache.set(handle, cached);
      return cached;
    }

    try {
      const result = await sendLookupRequest(handle);
      const valueToCache = { ...result, source: "firestore" };
      memoryCache.set(handle, valueToCache);
      await extension.storage.setDirectoryEntry(
        handle,
        valueToCache,
        valueToCache.verified ? VERIFIED_TTL_MS : MISS_TTL_MS,
      );
      return valueToCache;
    } catch (_error) {
      const stale = await extension.storage.getDirectoryEntry(handle, {
        allowExpired: true,
      });
      if (stale) {
        const staleValue = { ...stale, source: "stale-cache" };
        memoryCache.set(handle, staleValue);
        return staleValue;
      }

      const fallback = await bundledFallback(handle);
      memoryCache.set(handle, fallback);
      return fallback;
    }
  }

  extension.directory = {
    lookup: lookup,
    normalizeHandle: normalizeHandle,
  };
})();
