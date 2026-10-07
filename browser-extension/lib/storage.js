// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const KNOWN_PUBKEY_STORAGE_KEY = 'nostr-competency-known-pubkey';
  const DIRECTORY_CACHE_STORAGE_PREFIX = 'nostr-directory-handle:';
  const RECENT_REACTIONS_STORAGE_KEY = 'nostr-recent-reactions:v1';
  const RECENT_REACTION_CACHE_LIMIT = 100;
  const MAX_RECENT_REACTION_TTL_MS = 5 * 60 * 1000;
  const ZAP_PROVIDER_STORAGE_KEY = 'nostr-zap-providers:v1';
  const ZAP_PROFILE_STORAGE_KEY = 'nostr-zap-profiles:v1';
  const RELAY_LIST_STORAGE_KEY = 'nostr-relay-lists:v1';
  const ZAP_PROVIDER_LIMIT = 100;
  const ZAP_PROFILE_LIMIT = 100;
  const RELAY_LIST_LIMIT = 100;
  const ZAP_PROFILE_CONTENT_LIMIT = 16384;
  const PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/i;
  const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/i;
  const EVENT_SIG_PATTERN = /^[0-9a-f]{128}$/i;

  function getBrowserStorage() {
    const browserApi = typeof browser !== 'undefined' ? browser : globalThis.browser;
    const chromeApi = typeof chrome !== 'undefined' ? chrome : globalThis.chrome;
    if (browserApi && browserApi.storage && browserApi.storage.local) {
      return { kind: 'browser', area: browserApi.storage.local };
    }
    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      return { kind: 'chrome', area: chromeApi.storage.local };
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

  function isHex64(value) {
    return typeof value === 'string' && PUBLIC_KEY_PATTERN.test(value);
  }

  const zapWriteQueues = new Map();

  function withZapLock(storageKey, task) {
    const previous = zapWriteQueues.get(storageKey) || Promise.resolve();
    const next = previous.then(task, task);
    const settled = next.catch(function () {});
    zapWriteQueues.set(storageKey, settled);
    settled.then(function () {
      if (zapWriteQueues.get(storageKey) === settled) {
        zapWriteQueues.delete(storageKey);
      }
    });
    return next;
  }

  function activeZapEntries(value, now) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (entry) {
      return Boolean(
        entry &&
        typeof entry === 'object' &&
        Number.isFinite(entry.expiresAt) &&
        entry.expiresAt > now
      );
    });
  }

  async function readZapEntries(storageKey) {
    return withZapLock(storageKey, async function () {
      const values = await getValues(storageKey).catch(function () {
        return {};
      });
      const stored = values[storageKey];
      const active = activeZapEntries(stored, Date.now());
      if (Array.isArray(stored) && active.length !== stored.length) {
        await setValues({ [storageKey]: active }).catch(function () {});
      }
      return active;
    });
  }

  async function writeZapEntry(storageKey, limit, entry, sameEntry) {
    return withZapLock(storageKey, async function () {
      let values;
      try {
        values = await getValues(storageKey);
      } catch (_error) {
        return;
      }
      const active = activeZapEntries(values[storageKey], Date.now()).filter(function (item) {
        return !sameEntry(item);
      });
      active.unshift(entry);
      await setValues({
        [storageKey]: active.slice(0, limit)
      }).catch(function () {});
    });
  }

  function sanitizeProviderValue(value) {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.lnurl !== 'string' ||
      typeof value.callback !== 'string' ||
      !isHex64(value.nostrPubkey) ||
      !(value.minSendable === null || Number.isFinite(value.minSendable)) ||
      !(value.maxSendable === null || Number.isFinite(value.maxSendable)) ||
      !Number.isInteger(value.commentAllowed) ||
      value.commentAllowed < 0
    ) {
      return null;
    }
    return {
      lnurl: value.lnurl,
      callback: value.callback,
      nostrPubkey: value.nostrPubkey.toLowerCase(),
      minSendable: value.minSendable === null ? null : Number(value.minSendable),
      maxSendable: value.maxSendable === null ? null : Number(value.maxSendable),
      commentAllowed: value.commentAllowed
    };
  }

  function sanitizeProviderEntry(entry) {
    const value = sanitizeProviderValue(entry && entry.value);
    if (
      !entry ||
      !isHex64(entry.pubkey) ||
      !value ||
      !Number.isFinite(entry.freshUntil) ||
      !Number.isFinite(entry.expiresAt)
    ) {
      return null;
    }
    return {
      pubkey: entry.pubkey.toLowerCase(),
      value: value,
      fetchedAt: Number(entry.fetchedAt) || 0,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt
    };
  }

  function sanitizeProfileEvent(event) {
    if (
      !event ||
      typeof event !== 'object' ||
      event.kind !== 0 ||
      !EVENT_ID_PATTERN.test(String(event.id || '')) ||
      !isHex64(event.pubkey) ||
      !EVENT_SIG_PATTERN.test(String(event.sig || '')) ||
      !Number.isInteger(event.created_at) ||
      typeof event.content !== 'string' ||
      event.content.length > ZAP_PROFILE_CONTENT_LIMIT ||
      !Array.isArray(event.tags) ||
      event.tags.length > 50
    ) {
      return null;
    }
    const tags = [];
    for (const tag of event.tags) {
      if (!Array.isArray(tag) || tag.length > 10) return null;
      const copy = [];
      for (const item of tag) {
        if (typeof item !== 'string' || item.length > 500) return null;
        copy.push(item);
      }
      tags.push(copy);
    }
    return {
      id: String(event.id).toLowerCase(),
      pubkey: event.pubkey.toLowerCase(),
      created_at: event.created_at,
      kind: 0,
      tags: tags,
      content: event.content,
      sig: String(event.sig).toLowerCase()
    };
  }

  function sanitizeProfileEntry(entry) {
    const event = sanitizeProfileEvent(entry && entry.event);
    if (
      !entry ||
      !isHex64(entry.pubkey) ||
      !event ||
      event.pubkey !== entry.pubkey.toLowerCase() ||
      !Number.isFinite(entry.freshUntil) ||
      !Number.isFinite(entry.expiresAt)
    ) {
      return null;
    }
    return {
      pubkey: entry.pubkey.toLowerCase(),
      event: event,
      fetchedAt: Number(entry.fetchedAt) || 0,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt
    };
  }

  function sanitizeRelayListEvent(event) {
    if (
      !event ||
      typeof event !== 'object' ||
      event.kind !== 10002 ||
      !EVENT_ID_PATTERN.test(String(event.id || '')) ||
      !isHex64(event.pubkey) ||
      !EVENT_SIG_PATTERN.test(String(event.sig || '')) ||
      !Number.isInteger(event.created_at) ||
      typeof event.content !== 'string' ||
      event.content.length > 1024 ||
      !Array.isArray(event.tags) ||
      event.tags.length > 50
    ) {
      return null;
    }
    const tags = [];
    for (const tag of event.tags) {
      if (!Array.isArray(tag) || tag.length > 10) return null;
      const copy = [];
      for (const item of tag) {
        if (typeof item !== 'string' || item.length > 500) return null;
        copy.push(item);
      }
      tags.push(copy);
    }
    return {
      id: String(event.id).toLowerCase(),
      pubkey: event.pubkey.toLowerCase(),
      created_at: event.created_at,
      kind: 10002,
      tags: tags,
      content: event.content,
      sig: String(event.sig).toLowerCase()
    };
  }

  function sanitizeRelayListEntry(entry) {
    const event = sanitizeRelayListEvent(entry && entry.event);
    if (!entry || !isHex64(entry.pubkey) || !event || event.pubkey !== entry.pubkey.toLowerCase()) {
      return null;
    }
    return { pubkey: entry.pubkey.toLowerCase(), event: event };
  }

  async function getZapProvider(pubkey) {
    if (!isHex64(pubkey)) return null;
    const normalized = pubkey.toLowerCase();
    const entries = await readZapEntries(ZAP_PROVIDER_STORAGE_KEY);
    for (const entry of entries) {
      const sanitized = sanitizeProviderEntry(entry);
      if (sanitized && sanitized.pubkey === normalized) return sanitized;
    }
    return null;
  }

  async function setZapProvider(pubkey, value, freshMs, staleMs) {
    const normalized = isHex64(pubkey) ? pubkey.toLowerCase() : null;
    const sanitized = sanitizeProviderValue(value);
    if (
      !normalized ||
      !sanitized ||
      !Number.isFinite(freshMs) ||
      freshMs <= 0 ||
      !Number.isFinite(staleMs) ||
      staleMs <= 0
    ) {
      return;
    }
    const now = Date.now();
    await writeZapEntry(
      ZAP_PROVIDER_STORAGE_KEY,
      ZAP_PROVIDER_LIMIT,
      {
        pubkey: normalized,
        value: sanitized,
        fetchedAt: now,
        freshUntil: now + freshMs,
        expiresAt: now + staleMs
      },
      function (entry) {
        return entry && String(entry.pubkey || '').toLowerCase() === normalized;
      }
    );
  }

  async function deleteZapProvider(pubkey) {
    if (!isHex64(pubkey)) return;
    const normalized = pubkey.toLowerCase();
    return withZapLock(ZAP_PROVIDER_STORAGE_KEY, async function () {
      let values;
      try {
        values = await getValues(ZAP_PROVIDER_STORAGE_KEY);
      } catch (_error) {
        return;
      }
      const active = activeZapEntries(
        values[ZAP_PROVIDER_STORAGE_KEY],
        Date.now()
      ).filter(function (entry) {
        return !entry || String(entry.pubkey || '').toLowerCase() !== normalized;
      });
      await setValues({
        [ZAP_PROVIDER_STORAGE_KEY]: active
      }).catch(function () {});
    });
  }

  async function getZapProfile(pubkey) {
    if (!isHex64(pubkey)) return null;
    const normalized = pubkey.toLowerCase();
    const entries = await readZapEntries(ZAP_PROFILE_STORAGE_KEY);
    for (const entry of entries) {
      const sanitized = sanitizeProfileEntry(entry);
      if (sanitized && sanitized.pubkey === normalized) return sanitized;
    }
    return null;
  }

  async function setZapProfile(pubkey, event, freshMs, staleMs) {
    const normalized = isHex64(pubkey) ? pubkey.toLowerCase() : null;
    const sanitized = sanitizeProfileEvent(event);
    if (
      !normalized ||
      !sanitized ||
      sanitized.pubkey !== normalized ||
      !Number.isFinite(freshMs) ||
      freshMs <= 0 ||
      !Number.isFinite(staleMs) ||
      staleMs <= 0
    ) {
      return;
    }
    const now = Date.now();
    await writeZapEntry(
      ZAP_PROFILE_STORAGE_KEY,
      ZAP_PROFILE_LIMIT,
      {
        pubkey: normalized,
        event: sanitized,
        fetchedAt: now,
        freshUntil: now + freshMs,
        expiresAt: now + staleMs
      },
      function (entry) {
        return entry && String(entry.pubkey || '').toLowerCase() === normalized;
      }
    );
  }

  async function readRelayLists() {
    return withZapLock(RELAY_LIST_STORAGE_KEY, async function () {
      const values = await getValues(RELAY_LIST_STORAGE_KEY).catch(function () {
        return {};
      });
      const stored = values[RELAY_LIST_STORAGE_KEY];
      if (!Array.isArray(stored)) return [];
      return stored.map(sanitizeRelayListEntry).filter(Boolean);
    });
  }

  async function getRelayList(pubkey) {
    if (!isHex64(pubkey)) return null;
    const normalized = pubkey.toLowerCase();
    const entries = await readRelayLists();
    for (const entry of entries) {
      if (entry.pubkey === normalized) return entry.event;
    }
    return null;
  }

  async function setRelayList(pubkey, event) {
    const normalized = isHex64(pubkey) ? pubkey.toLowerCase() : null;
    const sanitized = sanitizeRelayListEvent(event);
    if (!normalized || !sanitized || sanitized.pubkey !== normalized) return;
    return withZapLock(RELAY_LIST_STORAGE_KEY, async function () {
      let values;
      try {
        values = await getValues(RELAY_LIST_STORAGE_KEY);
      } catch (_error) {
        return;
      }
      const active = (Array.isArray(values[RELAY_LIST_STORAGE_KEY])
        ? values[RELAY_LIST_STORAGE_KEY]
        : []
      ).map(sanitizeRelayListEntry).filter(function (entry) {
        return entry && entry.pubkey !== normalized;
      });
      active.unshift({ pubkey: normalized, event: sanitized });
      await setValues({
        [RELAY_LIST_STORAGE_KEY]: active.slice(0, RELAY_LIST_LIMIT)
      }).catch(function () {});
    });
  }

  async function deleteRelayList(pubkey) {
    if (!isHex64(pubkey)) return;
    const normalized = pubkey.toLowerCase();
    return withZapLock(RELAY_LIST_STORAGE_KEY, async function () {
      let values;
      try {
        values = await getValues(RELAY_LIST_STORAGE_KEY);
      } catch (_error) {
        return;
      }
      const active = (Array.isArray(values[RELAY_LIST_STORAGE_KEY])
        ? values[RELAY_LIST_STORAGE_KEY]
        : []
      ).map(sanitizeRelayListEntry).filter(function (entry) {
        return entry && entry.pubkey !== normalized;
      });
      await setValues({
        [RELAY_LIST_STORAGE_KEY]: active
      }).catch(function () {});
    });
  }

  extension.storage = {
    getKnownPubkey: getKnownPubkey,
    setKnownPubkey: setKnownPubkey,
    getRecentReactions: getRecentReactions,
    setRecentReaction: setRecentReaction,
    getDirectoryEntry: getDirectoryEntry,
    setDirectoryEntry: setDirectoryEntry,
    getZapProvider: getZapProvider,
    setZapProvider: setZapProvider,
    deleteZapProvider: deleteZapProvider,
    getZapProfile: getZapProfile,
    setZapProfile: setZapProfile,
    getRelayList: getRelayList,
    setRelayList: setRelayList,
    deleteRelayList: deleteRelayList,
    ZAP_PROVIDER_LIMIT: ZAP_PROVIDER_LIMIT,
    ZAP_PROFILE_LIMIT: ZAP_PROFILE_LIMIT,
    RELAY_LIST_LIMIT: RELAY_LIST_LIMIT
  };
})();
