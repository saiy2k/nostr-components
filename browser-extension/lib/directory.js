// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
  const MISS_TTL_MS = 60 * 60 * 1000;
  const DEGRADED_MEMORY_TTL_MS = 5 * 60 * 1000;
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

  /** Return a valid memory entry and discard it after its expiry. */
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

  /** Store one memory entry with the same bounded lifetime as its source. */
  function setMemoryEntry(handle, value, expiresAt) {
    memoryCache.set(handle, { value: value, expiresAt: expiresAt });
  }

  /** Resolve author metadata through memory, extension storage, Firestore, then fallback. */
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
      includeExpiry: true,
    });
    if (cached && cached.value) {
      setMemoryEntry(handle, cached.value, cached.expiresAt);
      return cached.value;
    }

    try {
      const result = await sendLookupRequest(handle);
      const valueToCache = { ...result, source: "firestore" };
      const ttlMs = valueToCache.verified ? VERIFIED_TTL_MS : MISS_TTL_MS;
      const expiresAt = Date.now() + ttlMs;
      setMemoryEntry(handle, valueToCache, expiresAt);
      await extension.storage.setDirectoryEntry(handle, valueToCache, ttlMs);
      return valueToCache;
    } catch (_error) {
      const stale = await extension.storage.getDirectoryEntry(handle, {
        allowExpired: true,
        includeExpiry: true,
      });
      if (stale && stale.value) {
        const staleValue = { ...stale.value, source: "stale-cache" };
        setMemoryEntry(handle, staleValue, Date.now() + DEGRADED_MEMORY_TTL_MS);
        return staleValue;
      }

      const fallback = await bundledFallback(handle);
      setMemoryEntry(handle, fallback, Date.now() + DEGRADED_MEMORY_TTL_MS);
      return fallback;
    }
  }

  extension.directory = {
    lookup: lookup,
    normalizeHandle: normalizeHandle,
  };
})();
