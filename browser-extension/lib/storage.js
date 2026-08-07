// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const KNOWN_PUBKEY_STORAGE_KEY = "nostr-competency-known-pubkey";
  const REACTION_CACHE_STORAGE_PREFIX = "nostr-competency-reaction:";
  const DIRECTORY_CACHE_STORAGE_PREFIX = "nostr-directory-handle:";

  /** Resolve the extension-private storage API for Chrome or Firefox. */
  function getBrowserStorage() {
    if (
      typeof browser !== "undefined" &&
      browser.storage &&
      browser.storage.local
    ) {
      return { kind: "browser", area: browser.storage.local };
    }
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return { kind: "chrome", area: chrome.storage.local };
    }
    return null;
  }

  /** Read one or more values from extension-private local storage. */
  async function getValues(keys) {
    const storage = getBrowserStorage();
    if (!storage) {
      return {};
    }

    if (storage.kind === "browser") {
      return storage.area.get(keys);
    }

    return new Promise(function (resolve, reject) {
      storage.area.get(keys, function (values) {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(values || {});
      });
    });
  }

  /** Persist values in extension-private local storage. */
  async function setValues(values) {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    if (storage.kind === "browser") {
      await storage.area.set(values);
      return;
    }

    await new Promise(function (resolve, reject) {
      storage.area.set(values, function () {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  /** Build a per-account, per-URL reaction cache key. */
  function reactionKey(url, pubkey) {
    return REACTION_CACHE_STORAGE_PREFIX + pubkey + "::" + url;
  }

  /** Read the last known NIP-07 pubkey for optimistic rendering only. */
  async function getKnownPubkey() {
    const values = await getValues(KNOWN_PUBKEY_STORAGE_KEY).catch(function () {
      return {};
    });
    return values[KNOWN_PUBKEY_STORAGE_KEY] || null;
  }

  /** Store the most recently confirmed NIP-07 pubkey. */
  async function setKnownPubkey(pubkey) {
    await setValues({ [KNOWN_PUBKEY_STORAGE_KEY]: pubkey }).catch(
      function () {},
    );
  }

  /** Read cached liked state for an account and canonical URL. */
  async function getReactionState(url, pubkey) {
    if (!pubkey) {
      return null;
    }

    const key = reactionKey(url, pubkey);
    const values = await getValues(key).catch(function () {
      return {};
    });
    if (values[key] === "liked") {
      return true;
    }
    if (values[key] === "unliked") {
      return false;
    }
    return null;
  }

  /** Store cached liked state for an account and canonical URL. */
  async function setReactionState(url, pubkey, liked) {
    if (!pubkey) {
      return;
    }
    const key = reactionKey(url, pubkey);
    await setValues({ [key]: liked ? "liked" : "unliked" }).catch(
      function () {},
    );
  }

  /** Read a fresh or explicitly allowed stale directory cache entry. */
  async function getDirectoryEntry(handle, options) {
    const key = DIRECTORY_CACHE_STORAGE_PREFIX + handle;
    const values = await getValues(key).catch(function () {
      return {};
    });
    const cached = values[key];
    if (!cached || typeof cached !== "object") {
      return null;
    }
    if (!options || !options.allowExpired) {
      if (
        !Number.isFinite(cached.expiresAt) ||
        cached.expiresAt <= Date.now()
      ) {
        return null;
      }
    }
    return cached.value || null;
  }

  /** Cache a sanitized directory response with an expiry time. */
  async function setDirectoryEntry(handle, value, ttlMs) {
    const key = DIRECTORY_CACHE_STORAGE_PREFIX + handle;
    await setValues({
      [key]: {
        value: value,
        expiresAt: Date.now() + ttlMs,
      },
    }).catch(function () {});
  }

  extension.storage = {
    getKnownPubkey: getKnownPubkey,
    setKnownPubkey: setKnownPubkey,
    getReactionState: getReactionState,
    setReactionState: setReactionState,
    getDirectoryEntry: getDirectoryEntry,
    setDirectoryEntry: setDirectoryEntry,
  };
})();
