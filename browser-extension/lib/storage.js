// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const KNOWN_PUBKEY_STORAGE_KEY = 'nostr-competency-known-pubkey';
  const DIRECTORY_CACHE_STORAGE_PREFIX = 'nostr-directory-handle:';
  const RECENT_REACTIONS_STORAGE_KEY = 'nostr-recent-reactions:v1';
  const RECENT_REACTION_CACHE_LIMIT = 100;
  const MAX_RECENT_REACTION_TTL_MS = 5 * 60 * 1000;
  const PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/i;

  function getBrowserStorage() {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return { kind: 'browser', area: browser.storage.local };
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return { kind: 'chrome', area: chrome.storage.local };
    }
    return null;
  }

  async function getValues(keys) {
    const storage = getBrowserStorage();
    if (!storage) {
      return {};
    }

    if (storage.kind === 'browser') {
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

  async function setValues(values) {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    if (storage.kind === 'browser') {
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

  async function getKnownPubkey() {
    const values = await getValues(KNOWN_PUBKEY_STORAGE_KEY).catch(function () {
      return {};
    });
    const value = values[KNOWN_PUBKEY_STORAGE_KEY];
    return typeof value === 'string' && PUBLIC_KEY_PATTERN.test(value) ? value.toLowerCase() : null;
  }

  async function setKnownPubkey(pubkey) {
    if (typeof pubkey !== 'string' || !PUBLIC_KEY_PATTERN.test(pubkey)) {
      return;
    }
    await setValues({
      [KNOWN_PUBKEY_STORAGE_KEY]: pubkey.toLowerCase()
    }).catch(function () {});
  }

  function getReactionUrl(event) {
    if (!event || typeof event !== 'object' || !Array.isArray(event.tags)) {
      return null;
    }
    const identifierTag = event.tags.find(function (tag) {
      return Array.isArray(tag) && tag.length === 2 && tag[0] === 'i';
    });
    return identifierTag && typeof identifierTag[1] === 'string'
      ? identifierTag[1]
      : null;
  }

  function getActiveRecentReactionEntries(value, now) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (entry) {
      return Boolean(
        entry &&
        typeof entry === 'object' &&
        Number.isFinite(entry.expiresAt) &&
        entry.expiresAt > now &&
        entry.event &&
        typeof entry.event === 'object' &&
        typeof entry.event.pubkey === 'string' &&
        getReactionUrl(entry.event)
      );
    });
  }

  async function getRecentReactions(url) {
    if (typeof url !== 'string' || url.length === 0) return [];
    const values = await getValues(RECENT_REACTIONS_STORAGE_KEY).catch(function () {
      return {};
    });
    const stored = values[RECENT_REACTIONS_STORAGE_KEY];
    const active = getActiveRecentReactionEntries(stored, Date.now());
    if (Array.isArray(stored) && active.length !== stored.length) {
      await setValues({ [RECENT_REACTIONS_STORAGE_KEY]: active }).catch(function () {});
    }
    return active
      .filter(function (entry) {
        return getReactionUrl(entry.event) === url;
      })
      .map(function (entry) {
        return entry.event;
      });
  }

  async function setRecentReaction(event, ttlMs) {
    const url = getReactionUrl(event);
    if (
      !url ||
      !event ||
      typeof event.pubkey !== 'string' ||
      !Number.isFinite(ttlMs) ||
      ttlMs <= 0
    ) {
      return;
    }

    const now = Date.now();
    const values = await getValues(RECENT_REACTIONS_STORAGE_KEY).catch(function () {
      return {};
    });
    const active = getActiveRecentReactionEntries(
      values[RECENT_REACTIONS_STORAGE_KEY],
      now
    ).filter(function (entry) {
      return !(
        entry.event.pubkey === event.pubkey &&
        getReactionUrl(entry.event) === url
      );
    });
    active.unshift({
      event: event,
      expiresAt: now + Math.min(ttlMs, MAX_RECENT_REACTION_TTL_MS)
    });
    await setValues({
      [RECENT_REACTIONS_STORAGE_KEY]: active.slice(0, RECENT_REACTION_CACHE_LIMIT)
    }).catch(function () {});
  }

  async function getDirectoryEntry(handle, options) {
    const key = DIRECTORY_CACHE_STORAGE_PREFIX + handle;
    const values = await getValues(key).catch(function () {
      return {};
    });
    const cached = values[key];
    if (!cached || typeof cached !== 'object') {
      return null;
    }
    if (!options || !options.allowExpired) {
      if (!Number.isFinite(cached.expiresAt) || cached.expiresAt <= Date.now()) {
        return null;
      }
    }
    const value = cached.value || null;
    if (options && options.includeExpiry) {
      return { value: value, expiresAt: cached.expiresAt };
    }
    return value;
  }

  async function setDirectoryEntry(handle, value, ttlMs) {
    const key = DIRECTORY_CACHE_STORAGE_PREFIX + handle;
    await setValues({
      [key]: {
        value: value,
        expiresAt: Date.now() + ttlMs
      }
    }).catch(function () {});
  }

  extension.storage = {
    getKnownPubkey: getKnownPubkey,
    setKnownPubkey: setKnownPubkey,
    getRecentReactions: getRecentReactions,
    setRecentReaction: setRecentReaction,
    getDirectoryEntry: getDirectoryEntry,
    setDirectoryEntry: setDirectoryEntry
  };
})();
