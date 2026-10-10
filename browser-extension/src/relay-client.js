// SPDX-License-Identifier: MIT

import { SimplePool, nip19, verifyEvent } from 'nostr-tools';
import { bech32 } from '@scure/base';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';
import relayRoles from '../../backend/relay-roles.json';
import { canonicalUrl as canonicalPageUrl } from '../../backend/nostr-pulse/url-canonical.js';

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const REQUEST_SOURCE = 'nostr-components-relay-main';
  const RESPONSE_SOURCE = 'nostr-components-relay-extension';
  const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
  const ACTION_ID_PATTERN = /^[0-9a-f]{64}$/;
  const REQUEST_ID_PATTERN = /^[0-9a-f]{32}$/;
  const MESSAGE_MAC_PATTERN = /^[0-9a-f]{64}$/;
  const BRIDGE_AUTH_CONTEXT = 'nostr-components-relay-v2';
  const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
  const HEX_128_PATTERN = /^[0-9a-f]{128}$/i;
  const QUERY_DEADLINE_MS = 2500;
  const QUERY_RELAY_QUORUM = 4;
  const QUERY_RESPONSE_QUORUM = 3;
  const PROVIDER_FRESH_MS = 30 * 60 * 1000;
  const PROFILE_FRESH_MS = 60 * 60 * 1000;
  const ZAP_CACHE_STALE_MS = 24 * 60 * 60 * 1000;
  const NEGATIVE_CACHE_MS = 30 * 1000;
  const MEMORY_PROVIDER_LIMIT = 100;
  const RELAY_HEALTH_TTL_MS = 5 * 60 * 1000;
  const RECENT_REACTION_TTL_MS = 2 * 60 * 1000;
  const INITIAL_RELAY_ORDER = [
    'wss://relay.damus.io/',
    'wss://relay.getalby.com/',
    'wss://relay.primal.net/',
    'wss://nostr.wine/',
    'wss://relay.nostr.net/',
    'wss://nos.lol/',
    'wss://nostr-pub.wellorder.net/',
    'wss://relay.nostr.band/'
  ];
  const WRITE_RELAY_LIMIT = 3;
  const ZAP_RELAY_LIMIT = 8;
  const ACTIVITY_CACHE_MS = 60 * 1000;
  const ACTIVITY_BATCH_MS = 50;
  const PROFILE_PUBKEY_LIMIT = 50;

  function normalizeRelayUrl(value) {
    let url;
    try {
      url = new URL(String(value ?? '').trim());
    } catch (_error) {
      return null;
    }
    if (url.protocol !== 'wss:' || url.username || url.password) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.port === '443') url.port = '';
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    }
    return url.toString();
  }

  function uniqueRelays(values) {
    const out = [];
    for (const value of values) {
      const normalized = normalizeRelayUrl(value);
      if (normalized && !out.includes(normalized)) out.push(normalized);
    }
    return out;
  }

  const RENDEZVOUS_RELAYS = uniqueRelays(relayRoles.rendezvous || []);
  const RENDEZVOUS_SET = new Set(RENDEZVOUS_RELAYS);
  const SWEEP_RELAYS = new Set(uniqueRelays([
    ...(relayRoles.rendezvous || []),
    ...(relayRoles.sweepExtra || [])
  ]));

  let activeSession = null;
  const relayHealth = new Map();
  const recentReactionsByUrl = new Map();
  const actionContexts = new Map();
  const providerMemory = new Map();
  const providerNegative = new Map();
  const providerInflight = new Map();

  function canonicalJson(value) {
    if (value === null) return 'null';
    if (typeof value === 'string' || typeof value === 'number') {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        throw new Error('Relay bridge value is not serializable');
      }
      return serialized;
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) {
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        items.push(
          Object.hasOwn(value, index) && value[index] !== undefined
            ? canonicalJson(value[index])
            : 'null'
        );
      }
      return '[' + items.join(',') + ']';
    }
    if (!value || typeof value !== 'object') {
      throw new Error('Relay bridge value is not serializable');
    }
    const entries = [];
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      entries.push(JSON.stringify(key) + ':' + canonicalJson(value[key]));
    }
    return '{' + entries.join(',') + '}';
  }

  function bridgeAuthPayload(type, message) {
    if (type === 'request') {
      return canonicalJson([
        BRIDGE_AUTH_CONTEXT,
        'request',
        message.requestId,
        message.operation,
        message.payload
      ]);
    }
    return canonicalJson([
      BRIDGE_AUTH_CONTEXT,
      'response',
      message.requestId,
      message.requestMac,
      message.operation,
      message.ok === true,
      message.ok === true ? message.result : null,
      message.ok === true ? null : String(message.error || 'Relay request failed')
    ]);
  }

  function hexToBytes(value) {
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  function bytesToHex(value) {
    return Array.from(new Uint8Array(value), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function cloneBridgeValue(value) {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function createBridgeAuthenticator(channel) {
    if (!CHANNEL_PATTERN.test(String(channel || ''))) {
      throw new Error('Invalid relay bridge channel');
    }
    if (!globalThis.crypto?.subtle) {
      throw new Error('Web Crypto is required for the relay bridge');
    }

    const subtle = globalThis.crypto.subtle;
    const encoder = new TextEncoder();
    const keyPromise = subtle.importKey(
      'raw',
      hexToBytes(channel),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    async function sign(type, message) {
      const key = await keyPromise;
      const mac = await subtle.sign(
        'HMAC',
        key,
        encoder.encode(bridgeAuthPayload(type, message))
      );
      return bytesToHex(mac);
    }

    async function verify(type, message) {
      if (!MESSAGE_MAC_PATTERN.test(String(message?.mac || ''))) return false;
      const key = await keyPromise;
      return subtle.verify(
        'HMAC',
        key,
        hexToBytes(message.mac),
        encoder.encode(bridgeAuthPayload(type, message))
      );
    }

    return Object.freeze({
      signRequest: function (message) {
        return sign('request', message);
      },
      verifyRequest: function (message) {
        return verify('request', message);
      },
      signResponse: function (message) {
        return sign('response', message);
      },
      verifyResponse: function (message) {
        return verify('response', message);
      }
    });
  }

  async function rememberRecentReaction(event) {
    const identifierTag = event.tags.find((tag) => Array.isArray(tag) && tag[0] === 'i');
    const url = identifierTag?.[1];
    if (!url) return;
    let reactionsByPubkey = recentReactionsByUrl.get(url);
    if (!reactionsByPubkey) {
      reactionsByPubkey = new Map();
      recentReactionsByUrl.set(url, reactionsByPubkey);
    }
    reactionsByPubkey.set(event.pubkey, { event: event });
    if (typeof extension.storage.setRecentReaction === 'function') {
      try {
        await extension.storage.setRecentReaction(event, RECENT_REACTION_TTL_MS);
      } catch (_error) {
        // A relay-acknowledged publish stays successful if local caching fails.
      }
    }
  }

  function getInMemoryRecentReactions(url) {
    const reactionsByPubkey = recentReactionsByUrl.get(url);
    if (!reactionsByPubkey) return [];
    return Array.from(reactionsByPubkey.values()).map(function (entry) {
      return entry.event;
    });
  }

  function forgetRecentReaction(eventId) {
    for (const [url, reactionsByPubkey] of recentReactionsByUrl) {
      for (const [pubkey, entry] of reactionsByPubkey) {
        if (entry.event && entry.event.id === eventId) reactionsByPubkey.delete(pubkey);
      }
      if (reactionsByPubkey.size === 0) recentReactionsByUrl.delete(url);
    }
    if (typeof extension.storage.forgetRecentReaction === 'function') {
      void extension.storage.forgetRecentReaction(eventId);
    }
  }

  async function getRecentReactions(url) {
    const storedEvents = typeof extension.storage.getRecentReactions === 'function'
      ? await extension.storage.getRecentReactions(url)
      : [];
    const eventsById = new Map();
    for (const event of [...getInMemoryRecentReactions(url), ...storedEvents]) {
      const validated = validateReactionEvent(event);
      if (!validated) continue;
      const identifierTag = validated.tags.find(
        (tag) => Array.isArray(tag) && tag[0] === 'i'
      );
      if (identifierTag?.[1] === url) eventsById.set(validated.id, validated);
    }
    return Array.from(eventsById.values());
  }

  function relayScore(relay) {
    const health = relayHealth.get(relay);
    if (health && health.recordedAt + RELAY_HEALTH_TTL_MS > Date.now()) {
      return health.latencyMs + health.failures * QUERY_DEADLINE_MS;
    }
    if (health) relayHealth.delete(relay);
    const initialRank = INITIAL_RELAY_ORDER.indexOf(relay);
    return (initialRank === -1 ? INITIAL_RELAY_ORDER.length : initialRank) * 100;
  }

  function selectQueryRelays(relays) {
    return [...relays].sort((left, right) => relayScore(left) - relayScore(right)).slice(0, Math.min(QUERY_RELAY_QUORUM, relays.length));
  }

  function isRequestedProfile(event, filterList) {
    const filter = filterList.length === 1 ? filterList[0] : null;
    if (
      !event ||
      !filter ||
      event.kind !== 0 ||
      !Array.isArray(filter.authors)
    ) {
      return false;
    }
    const pubkey = String(event.pubkey || '').toLowerCase();
    if (!filter.authors.includes(pubkey)) return false;
    try {
      return verifyEvent(event);
    } catch (_error) {
      return false;
    }
  }

  function preferProfile(candidate, current) {
    if (candidate.created_at !== current.created_at) {
      return candidate.created_at > current.created_at;
    }
    return candidate.id < current.id;
  }

  function summarizeReactionEvents(events) {
    const latestByPubkey = new Map();
    for (const event of events) {
      if (!event?.pubkey) continue;
      const previous = latestByPubkey.get(event.pubkey);
      if (
        !previous ||
        event.created_at > previous.created_at ||
        (event.created_at === previous.created_at && event.id > previous.id)
      ) {
        latestByPubkey.set(event.pubkey, event);
      }
    }

    let likedCount = 0;
    let dislikedCount = 0;
    for (const event of latestByPubkey.values()) {
      if (event.content === '-') dislikedCount += 1;
      else if (event.content === '+' || event.content === '') likedCount += 1;
    }
    return { totalCount: likedCount, likedCount, dislikedCount };
  }

  function findLatestReaction(events, publicKey) {
    if (!publicKey) return undefined;
    return events
      .filter((event) => event.pubkey === publicKey)
      .sort(
        (a, b) => b.created_at - a.created_at || (a.id === b.id ? 0 : a.id > b.id ? -1 : 1)
      )[0];
  }

  function queryWithFastQuorum(pool, relays, filters, options) {
    const selectedRelays =
      options && Array.isArray(options.selectedRelays)
        ? options.selectedRelays
        : selectQueryRelays(relays);
    const filterList = Array.isArray(filters) ? filters : [filters];
    const eventsById = new Map();
    const relaysWithEvents = new Set();
    const closers = [];
    // A single profile may live on any relay in the allowed list. Empty
    // replies must not cancel the rest. The newest verified profile wins,
    // because that profile chooses the Lightning address.
    const keepNewestProfile = options && options.keepNewestProfile === true;
    const requireEvent =
      keepNewestProfile || (options && options.requireEvent === true);

    return new Promise(function (resolve) {
      let successfulResponses = 0;
      let finished = false;
      const completedRelays = new Set();
      const requiredResponses = Math.min(QUERY_RESPONSE_QUORUM, selectedRelays.length);

      function finish(penalizePending = true) {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        if (penalizePending) {
          for (const relay of selectedRelays) {
            if (completedRelays.has(relay) || relaysWithEvents.has(relay)) continue;
            const previous = relayHealth.get(relay);
            relayHealth.set(relay, {
              latencyMs: QUERY_DEADLINE_MS,
              failures: (previous?.failures || 0) + 1,
              recordedAt: Date.now()
            });
          }
        }
        for (const closer of closers) void closer.close();
        resolve(Array.from(eventsById.values()));
      }

      const timeoutId = setTimeout(function () {
        finish(true);
      }, QUERY_DEADLINE_MS);

      for (const relay of selectedRelays) {
        const relayStartedAt = Date.now();
        function settleRelay(succeeded) {
          if (finished) return;
          if (completedRelays.has(relay)) return;
          completedRelays.add(relay);
          const previous = relayHealth.get(relay);
          relayHealth.set(relay, {
            latencyMs: Date.now() - relayStartedAt,
            failures: succeeded ? 0 : (previous?.failures || 0) + 1,
            recordedAt: Date.now()
          });
          if (succeeded) successfulResponses += 1;
          if (
            completedRelays.size === selectedRelays.length ||
            (!requireEvent && successfulResponses >= requiredResponses)
          ) {
            finish();
          }
        }
        const options = {
          maxWait: QUERY_DEADLINE_MS,
          onevent(event) {
            if (finished) return;
            if (keepNewestProfile) {
              if (!isRequestedProfile(event, filterList)) return;
              const pubkey = String(event.pubkey || '').toLowerCase();
              const current = eventsById.get(pubkey) || null;
              if (!current || preferProfile(event, current)) {
                eventsById.set(pubkey, event);
              }
              relaysWithEvents.add(relay);
              return;
            }
            if (event && event.id) {
              eventsById.set(event.id, event);
              relaysWithEvents.add(relay);
            }
          },
          oneose() {
            settleRelay(true);
          },
          onclose() {
            settleRelay(false);
          }
        };
        try {
          const closer =
            filterList.length === 1
              ? pool.subscribe([relay], filterList[0], options)
              : pool.subscribeMany([relay], filterList, options);
          if (finished) void closer.close();
          else closers.push(closer);
        } catch (_error) {
          settleRelay(false);
        }
        if (finished) break;
      }
    });
  }

  function isAllowedContentUrl(value) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.port !== '' ||
        url.username !== '' ||
        url.password !== '' ||
        url.hash !== ''
      ) {
        return false;
      }
      if (url.hostname === 'x.com' || url.hostname === 'twitter.com') {
        return /^\/[^/]+\/status\/\d+\/?$/.test(url.pathname) && url.search === '';
      }
      if (url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') {
        return false;
      }
      const keys = Array.from(url.searchParams.keys());
      return (
        keys.length === 1 &&
        keys[0] === 'v' &&
        /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '')
      );
    } catch (_error) {
      return false;
    }
  }

  const isAllowedStatusUrl = isAllowedContentUrl;

  function validateFilter(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    if (!Array.isArray(value.kinds) || value.kinds.length !== 1) {
      return null;
    }

    if (value.kinds[0] === 0) {
      const allowedKeys = new Set(['kinds', 'authors', 'limit']);
      if (
        Object.keys(value).some((key) => !allowedKeys.has(key)) ||
        !Array.isArray(value.authors) ||
        value.authors.length < 1 ||
        value.authors.length > 50 ||
        value.authors.some((author) => !HEX_64_PATTERN.test(String(author))) ||
        new Set(value.authors.map((author) => String(author).toLowerCase())).size !== value.authors.length ||
        !Number.isInteger(value.limit) ||
        value.limit < 1 ||
        value.limit > 50
      ) {
        return null;
      }
      return {
        kinds: [0],
        authors: value.authors.map((author) => String(author).toLowerCase()),
        limit: value.limit
      };
    }

    if (value.kinds[0] === 9735) {
      const allowedKeys = new Set(['kinds', '#p', '#a', 'since', 'limit']);
      if (
        Object.keys(value).some((key) => !allowedKeys.has(key)) ||
        !Array.isArray(value['#p']) ||
        value['#p'].length !== 1 ||
        !HEX_64_PATTERN.test(String(value['#p'][0])) ||
        !Number.isInteger(value.limit) ||
        value.limit < 1 ||
        value.limit > 1000 ||
        (value.since !== undefined &&
          (!Number.isInteger(value.since) || value.since < 0))
      ) {
        return null;
      }

      const pubkey = String(value['#p'][0]).toLowerCase();
      if (value['#a'] !== undefined) {
        if (!Array.isArray(value['#a']) || value['#a'].length !== 1) return null;
        const prefix = '39735:' + pubkey + ':';
        const aTag = String(value['#a'][0]);
        if (!aTag.startsWith(prefix) || !isAllowedContentUrl(aTag.slice(prefix.length))) {
          return null;
        }
      }

      return {
        kinds: [9735],
        '#p': [pubkey],
        ...(value['#a'] ? { '#a': [String(value['#a'][0])] } : {}),
        ...(value.since !== undefined ? { since: value.since } : {}),
        limit: value.limit
      };
    }

    const allowedKeys = new Set(['kinds', '#k', '#i', 'authors', 'limit']);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
      return null;
    }
    if (
      value.kinds[0] !== 17 ||
      !Array.isArray(value['#k']) ||
      value['#k'].length !== 1 ||
      value['#k'][0] !== 'web' ||
      !Array.isArray(value['#i']) ||
      value['#i'].length !== 1 ||
      !isAllowedContentUrl(value['#i'][0]) ||
      !Number.isInteger(value.limit) ||
      value.limit < 1 ||
      value.limit > 1000
    ) {
      return null;
    }

    if (
      value.authors !== undefined &&
      (!Array.isArray(value.authors) ||
        value.authors.length !== 1 ||
        !HEX_64_PATTERN.test(String(value.authors[0])))
    ) {
      return null;
    }

    return {
      kinds: [17],
      '#k': ['web'],
      '#i': [value['#i'][0]],
      ...(value.authors ? { authors: [value.authors[0].toLowerCase()] } : {}),
      limit: value.limit
    };
  }

  function validateReactionEvent(event, expectedUrl) {
    if (
      !event ||
      typeof event !== 'object' ||
      event.kind !== 17 ||
      (event.content !== '+' && event.content !== '-') ||
      !Number.isInteger(event.created_at) ||
      event.created_at <= 0 ||
      !HEX_64_PATTERN.test(String(event.id || '')) ||
      !HEX_64_PATTERN.test(String(event.pubkey || '')) ||
      !HEX_128_PATTERN.test(String(event.sig || '')) ||
      !Array.isArray(event.tags) ||
      event.tags.length !== 2
    ) {
      return null;
    }

    const kindTags = event.tags.filter(
      (tag) => Array.isArray(tag) && tag.length === 2 && tag[0] === 'k'
    );
    const identifierTags = event.tags.filter(
      (tag) => Array.isArray(tag) && tag.length === 2 && tag[0] === 'i'
    );
    if (
      kindTags.length !== 1 ||
      kindTags[0][1] !== 'web' ||
      identifierTags.length !== 1 ||
      !isAllowedContentUrl(identifierTags[0][1]) ||
      (expectedUrl && identifierTags[0][1] !== expectedUrl) ||
      !verifyEvent(event)
    ) {
      return null;
    }

    return event;
  }

  function decodeRecipientNpub(value) {
    if (!value) return null;
    try {
      const decoded = nip19.decode(value);
      return decoded.type === 'npub' &&
        HEX_64_PATTERN.test(String(decoded.data || ''))
        ? String(decoded.data).toLowerCase()
        : null;
    } catch (_error) {
      return null;
    }
  }

  function registerActionContext(actionId, context) {
    if (
      !ACTION_ID_PATTERN.test(String(actionId || '')) ||
      !context ||
      (context.kind !== 'x' && context.kind !== 'youtube') ||
      !isAllowedContentUrl(context.url)
    ) {
      throw new Error('Invalid isolated action context');
    }
    const next = {
      kind: context.kind,
      url: context.url,
      recipientPubkey: decodeRecipientNpub(context.recipientNpub)
    };
    const current = actionContexts.get(actionId);
    if (
      current &&
      current.kind === next.kind &&
      current.url === next.url &&
      current.recipientPubkey === next.recipientPubkey
    ) {
      actionContexts.delete(actionId);
      actionContexts.set(actionId, current);
      return;
    }
    actionContexts.set(actionId, next);
    if (actionContexts.size > 2048) {
      actionContexts.delete(actionContexts.keys().next().value);
    }
  }

  function revokeActionContext(actionId) {
    if (ACTION_ID_PATTERN.test(String(actionId || ''))) {
      actionContexts.delete(actionId);
    }
  }

  function isAllowedPageOrigin(origin) {
    try {
      const url = new URL(origin);
      return (
        url.protocol === 'https:' &&
        url.port === '' &&
        [
          'x.com',
          'twitter.com',
          'www.youtube.com',
          'm.youtube.com',
          'youtube.com'
        ].includes(url.hostname)
      );
    } catch (_error) {
      return false;
    }
  }

  function sendExtensionMessage(message) {
    function unwrap(response) {
      if (!response || response.ok !== true) {
        throw new Error((response && response.error) || 'Extension request failed');
      }
      return response.result;
    }
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      return browser.runtime.sendMessage(message).then(unwrap);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage(message, function (value) {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          try {
            resolve(unwrap(value));
          } catch (unwrapError) {
            reject(unwrapError);
          }
        });
      });
    }
    return Promise.reject(new Error('Browser runtime API is not available'));
  }

  function sendHttpsJsonRequest(url) {
    return sendExtensionMessage({ type: 'FETCH_HTTPS_JSON', url: url });
  }

  function getActionContext(actionId, requireRecipient) {
    const normalizedId = String(actionId || '');
    const context = ACTION_ID_PATTERN.test(normalizedId)
      ? actionContexts.get(normalizedId)
      : null;
    if (!context || (requireRecipient && !context.recipientPubkey)) {
      throw new Error('Request is not bound to an active action');
    }
    return context;
  }

  function requireCurrentActionContext(actionId, context) {
    if (actionContexts.get(String(actionId || '')) !== context) {
      throw new Error('Request action is no longer active');
    }
  }

  function profileLnurl(content) {
    try {
      const metadata = JSON.parse(content || '{}');
      if (typeof metadata.lud16 === 'string') {
        const value = metadata.lud16;
        const separator = value.indexOf('@');
        if (
          separator <= 0 ||
          separator !== value.lastIndexOf('@') ||
          !/^[A-Za-z0-9._-]+$/.test(value.slice(0, separator)) ||
          !/^[A-Za-z0-9.-]+$/.test(value.slice(separator + 1))
        ) {
          return null;
        }
        const name = value.slice(0, separator);
        const domain = value.slice(separator + 1);
        const parsed = new URL(
          '/.well-known/lnurlp/' + encodeURIComponent(name),
          'https://' + domain
        );
        return parsed.protocol === 'https:' && parsed.port === ''
          ? parsed.toString()
          : null;
      }
      if (typeof metadata.lud06 === 'string') {
        const decoded = bech32.decode(metadata.lud06, 1000);
        const bytes = Uint8Array.from(bech32.fromWords(decoded.words));
        const parsed = new URL(new TextDecoder().decode(bytes));
        return parsed.protocol === 'https:' ? parsed.toString() : null;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  function rememberBounded(map, key, value, limit) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > limit) {
      map.delete(map.keys().next().value);
    }
  }

  function eventVerified(event) {
    try {
      return Boolean(event) && verifyEvent(event);
    } catch (_error) {
      return false;
    }
  }

  function freshEntry(entry) {
    return Boolean(
      entry &&
      Number.isFinite(entry.freshUntil) &&
      entry.freshUntil > Date.now() &&
      Number.isFinite(entry.expiresAt) &&
      entry.expiresAt > Date.now()
    );
  }

  function unexpiredEntry(entry) {
    if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry;
  }

  function normalizeProviderRecord(record) {
    if (!record) return null;
    const lnurl = extension.zapHttp?.normalizeZapHttpUrl(record.lnurl);
    const callback = extension.zapHttp?.normalizeZapHttpUrl(record.callback);
    if (!lnurl || !callback || !HEX_64_PATTERN.test(String(record.nostrPubkey || ''))) {
      return null;
    }
    return {
      lnurl: lnurl,
      callback: callback,
      nostrPubkey: String(record.nostrPubkey).toLowerCase(),
      minSendable: Number.isFinite(record.minSendable) ? Number(record.minSendable) : null,
      maxSendable: Number.isFinite(record.maxSendable) ? Number(record.maxSendable) : null,
      commentAllowed: Number.isInteger(record.commentAllowed) ? record.commentAllowed : 0
    };
  }

  async function readProvider(pubkey) {
    const memory = unexpiredEntry(providerMemory.get(pubkey));
    if (!memory) providerMemory.delete(pubkey);
    if (memory) {
      const normalized = normalizeProviderRecord(memory.value);
      return normalized ? { ...memory, value: normalized } : null;
    }
    if (typeof extension.storage.getZapProvider !== 'function') return null;
    const stored = await extension.storage.getZapProvider(pubkey);
    const normalized = normalizeProviderRecord(stored && stored.value);
    if (!stored || !normalized) return null;
    const entry = {
      value: normalized,
      fetchedAt: stored.fetchedAt,
      freshUntil: stored.freshUntil,
      expiresAt: stored.expiresAt
    };
    if (!unexpiredEntry(entry)) return null;
    rememberBounded(providerMemory, pubkey, entry, MEMORY_PROVIDER_LIMIT);
    return entry;
  }

  async function rememberProvider(pubkey, provider) {
    const now = Date.now();
    const entry = {
      value: provider,
      fetchedAt: now,
      freshUntil: now + PROVIDER_FRESH_MS,
      expiresAt: now + ZAP_CACHE_STALE_MS
    };
    rememberBounded(providerMemory, pubkey, entry, MEMORY_PROVIDER_LIMIT);
    providerNegative.delete(pubkey);
    if (typeof extension.storage.setZapProvider === 'function') {
      await extension.storage.setZapProvider(
        pubkey,
        provider,
        PROVIDER_FRESH_MS,
        ZAP_CACHE_STALE_MS
      );
    }
  }

  async function dropProvider(pubkey) {
    providerMemory.delete(pubkey);
    providerNegative.delete(pubkey);
    providerInflight.delete(pubkey);
    if (typeof extension.storage.deleteZapProvider === 'function') {
      await extension.storage.deleteZapProvider(pubkey);
    }
  }

  async function fetchProviderLiveUncached(pubkey) {
    let record = profileRecords.get(pubkey);
    if (!record?.event || Date.now() - record.fetchedAt > PROFILE_FRESH_MS) {
      const views = await lookupProfiles([pubkey], false);
      for (const view of views) applyProfileView(view);
      record = profileRecords.get(pubkey);
    }
    const profile = record && record.event;
    const lnurl = profile ? profileLnurl(profile.content) : null;
    if (!lnurl) {
      throw new Error('Zap recipient has no valid LNURL provider');
    }
    const response = await sendHttpsJsonRequest(lnurl);
    const body = response?.json;
    if (
      response?.status < 200 ||
      response?.status >= 300 ||
      !body ||
      typeof body !== 'object' ||
      body.allowsNostr !== true ||
      !HEX_64_PATTERN.test(String(body.nostrPubkey || ''))
    ) {
      throw new Error('Zap provider returned invalid metadata');
    }
    const provider = normalizeProviderRecord({
      lnurl: lnurl,
      callback: body.callback,
      nostrPubkey: body.nostrPubkey,
      minSendable: body.minSendable,
      maxSendable: body.maxSendable,
      commentAllowed: body.commentAllowed
    });
    if (!provider) {
      throw new Error('Zap provider returned an invalid callback');
    }
    await rememberProvider(pubkey, provider);
    return provider;
  }

  function fetchProviderLive(pubkey) {
    const pending = providerInflight.get(pubkey);
    if (pending) return pending;
    const next = fetchProviderLiveUncached(pubkey).finally(function () {
      if (providerInflight.get(pubkey) === next) providerInflight.delete(pubkey);
    });
    providerInflight.set(pubkey, next);
    return next;
  }

  async function resolveZapProvider(actionId, context, options) {
    const allowStale = !options || options.allowStale !== false;
    const bypassCache = Boolean(options && options.bypassCache);
    const pubkey = context.recipientPubkey;
    requireCurrentActionContext(actionId, context);

    if (!bypassCache) {
      const cached = await readProvider(pubkey);
      if (freshEntry(cached)) return cached.value;
      const negative = providerNegative.get(pubkey);
      if (negative && negative.expiresAt > Date.now()) {
        if (allowStale && cached) return cached.value;
        throw new Error(negative.message);
      }
    }

    try {
      const provider = await fetchProviderLive(pubkey);
      requireCurrentActionContext(actionId, context);
      return provider;
    } catch (error) {
      requireCurrentActionContext(actionId, context);
      if (!bypassCache && allowStale) {
        const stale = await readProvider(pubkey);
        if (stale) return stale.value;
      }
      if (!bypassCache) {
        providerNegative.set(pubkey, {
          expiresAt: Date.now() + NEGATIVE_CACHE_MS,
          message: error instanceof Error ? error.message : 'Zap provider lookup failed'
        });
      }
      throw error;
    }
  }

  const profileRecords = new Map();
  const relayListMemory = new Map();
  const zapRelaysByPubkey = new Map();
  const signerLists = new Map();
  let signerPubkeyMemory = null;
  const activityCache = new Map();
  let activityWaiters = [];
  let activityTimer = null;
  let viewerReactions = null;

  function payloadAllows(payload, allowed) {
    return Boolean(
      payload &&
      typeof payload === 'object' &&
      Object.keys(payload).every(function (key) {
        return allowed.indexOf(key) !== -1;
      })
    );
  }

  function countOf(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function relaysFromList(event, marker) {
    const urls = [];
    for (const tag of (event && event.tags) || []) {
      if (!Array.isArray(tag) || tag[0] !== 'r') continue;
      const url = normalizeRelayUrl(tag[1]);
      if (!url) continue;
      const role = tag[2];
      const unmarked = role == null || role === '';
      if (marker === 'read' && (role === 'read' || unmarked)) urls.push(url);
      if (marker === 'write' && (role === 'write' || unmarked)) urls.push(url);
    }
    return uniqueRelays(urls);
  }

  function newerEvent(current, candidate) {
    if (!candidate) return current || null;
    if (!current) return candidate;
    if (candidate.created_at > current.created_at) return candidate;
    if (candidate.created_at < current.created_at) return current;
    return String(candidate.id) < String(current.id) ? candidate : current;
  }

  function acceptedEvent(pubkey, event, kind) {
    if (!event || event.kind !== kind) return null;
    if (String(event.pubkey || '').toLowerCase() !== pubkey) return null;
    if (!eventVerified(event)) return null;
    return event;
  }

  function applyProfileView(view, options) {
    const pubkey = String(view && view.pubkey || '').toLowerCase();
    if (!HEX_64_PATTERN.test(pubkey)) {
      return { profile: null, relayList: null };
    }
    const signer = options && options.signer;
    const profile = acceptedEvent(pubkey, view.profileEvent, 0);
    const relayList = acceptedEvent(pubkey, view.relayListEvent, 10002);
    const current = profileRecords.get(pubkey);
    const event = profile ? newerEvent(current && current.event, profile) : (current && current.event) || null;
    let zappable = current ? current.zappable : null;
    if (view.zappable === true || view.zappable === false || view.zappable === null) {
      zappable = view.zappable;
    }
    profileRecords.set(pubkey, {
      event: event,
      zappable: zappable,
      fetchedAt: Date.now()
    });
    let keptList = relayListMemory.get(pubkey) || null;
    if (relayList) keptList = newerEvent(keptList, relayList);
    if (keptList) relayListMemory.set(pubkey, keptList);
    const isSigner = signer === pubkey || signerPubkeyMemory === pubkey;
    if (isSigner) {
      if (typeof extension.storage.deleteRelayList === 'function') {
        void extension.storage.deleteRelayList(pubkey);
      }
    } else if (keptList && relayList && typeof extension.storage.setRelayList === 'function') {
      void extension.storage.setRelayList(pubkey, keptList);
    }
    return {
      profile: event,
      relayList: keptList
    };
  }

  function seedIdentity(pubkey, profileEvent, relayListEvent, zappable) {
    applyProfileView({
      pubkey: pubkey,
      profileEvent: profileEvent,
      relayListEvent: relayListEvent,
      zappable: zappable
    });
  }

  async function lookupProfiles(pubkeys, fresh) {
    const result = await sendExtensionMessage({
      type: 'LOOKUP_NOSTR_PROFILES',
      pubkeys: pubkeys.join(','),
      ...(fresh ? { fresh: '1' } : {})
    });
    if (!result || !Array.isArray(result.profiles)) {
      throw new Error('Profile lookup failed');
    }
    return result.profiles;
  }

  function ensureSignerRelays(pubkey) {
    const normalized = String(pubkey || '').toLowerCase();
    if (!HEX_64_PATTERN.test(normalized)) return Promise.resolve([]);
    const existing = signerLists.get(normalized);
    if (existing) return existing;
    signerPubkeyMemory = normalized;
    const pending = lookupProfiles([normalized], false).then(function (profiles) {
      for (const view of profiles) applyProfileView(view, { signer: normalized });
      return relaysFromList(relayListMemory.get(normalized), 'write').slice(0, WRITE_RELAY_LIMIT);
    }).catch(function (error) {
      signerLists.delete(normalized);
      throw error;
    });
    signerLists.set(normalized, pending);
    return pending;
  }

  async function pageUrlKey(raw) {
    const canonical = canonicalPageUrl(raw);
    if (!canonical || !globalThis.crypto?.subtle) return null;
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonical)
    );
    return bytesToHex(digest);
  }

  function activityCacheKey(item) {
    return item.recipient ? item.urlKey + ':' + item.recipient : item.urlKey;
  }

  function rememberActivityRow(row) {
    const key = activityCacheKey(row);
    activityCache.set(key, {
      row: row,
      expiresAt: Date.now() + ACTIVITY_CACHE_MS
    });
  }

  function rememberActivityFromIngest(activity) {
    if (!activity || !HEX_64_PATTERN.test(String(activity.urlKey || ''))) return;
    const urlKey = String(activity.urlKey).toLowerCase();
    let found = false;
    for (const [key, entry] of activityCache) {
      if (key !== urlKey && !key.startsWith(urlKey + ':')) continue;
      found = true;
      entry.row = Object.assign({}, entry.row, {
        likes: countOf(activity.likeCount),
        dislikes: countOf(activity.dislikeCount)
      });
      entry.expiresAt = Date.now() + ACTIVITY_CACHE_MS;
    }
    if (!found) {
      rememberActivityRow({
        urlKey: urlKey,
        recipient: null,
        likes: countOf(activity.likeCount),
        dislikes: countOf(activity.dislikeCount),
        zapCount: null,
        sats: null
      });
    }
  }

  async function fetchActivityRows(items) {
    const result = await sendExtensionMessage({
      type: 'GET_URL_ACTIVITY',
      items: items.map(function (item) {
        return item.recipient ? item.urlKey + ':' + item.recipient : item.urlKey;
      }).join(',')
    });
    if (!result || !Array.isArray(result.items)) {
      throw new Error('Like count is unavailable');
    }
    return result.items;
  }

  function requestActivity(item) {
    const key = activityCacheKey(item);
    const cached = activityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.row);
    return new Promise(function (resolve, reject) {
      activityWaiters.push({ item: item, key: key, resolve: resolve, reject: reject });
      if (!activityTimer) {
        activityTimer = setTimeout(flushActivity, ACTIVITY_BATCH_MS);
      }
    });
  }

  async function flushActivity() {
    activityTimer = null;
    const waiting = activityWaiters;
    activityWaiters = [];
    if (waiting.length === 0) return;
    const groups = new Map();
    for (const waiter of waiting) {
      if (!groups.has(waiter.key)) groups.set(waiter.key, []);
      groups.get(waiter.key).push(waiter);
    }
    const entries = Array.from(groups.entries());
    for (let offset = 0; offset < entries.length; offset += 20) {
      const slice = entries.slice(offset, offset + 20);
      try {
        const rows = await fetchActivityRows(slice.map(function (entry) {
          return entry[1][0].item;
        }));
        const returned = new Map();
        for (const row of rows) {
          if (!row || !row.urlKey) continue;
          returned.set(activityCacheKey(row), row);
        }
        for (const [key, group] of slice) {
          const row = returned.get(key);
          if (!row) {
            for (const waiter of group) {
              waiter.reject(new Error('Like count is unavailable'));
            }
            continue;
          }
          rememberActivityRow(row);
          for (const waiter of group) waiter.resolve(row);
        }
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Like count is unavailable');
        for (const [, group] of slice) {
          for (const waiter of group) waiter.reject(failure);
        }
      }
    }
  }

  function viewerReactionsOnce(pubkey) {
    const normalized = String(pubkey || '').toLowerCase();
    if (viewerReactions && viewerReactions.pubkey === normalized) {
      return viewerReactions.promise;
    }
    const promise = sendExtensionMessage({
      type: 'LIST_VIEWER_REACTIONS',
      pubkey: normalized
    }).then(function (result) {
      return {
        ok: true,
        reactions: Array.isArray(result && result.reactions) ? result.reactions : []
      };
    }).catch(function () {
      if (viewerReactions && viewerReactions.promise === promise) viewerReactions = null;
      return { ok: false, reactions: [] };
    });
    viewerReactions = { pubkey: normalized, promise: promise };
    return promise;
  }

  function newestViewerReaction(reactions, urlKey) {
    let chosen = null;
    for (const row of reactions || []) {
      if (!row || row.urlKey !== urlKey) continue;
      if (!chosen || Number(row.createdAt) >= Number(chosen.createdAt)) chosen = row;
    }
    return chosen;
  }

  function reactionIsLike(content, reaction) {
    if (content === '+' || content === '') return true;
    return reaction === 'like' && content !== '-';
  }

  function likedNow(localEvent, remote, viewerOk) {
    if (localEvent && (!viewerOk || !remote || localEvent.created_at >= Number(remote.createdAt))) {
      return localEvent.content === '+' || localEvent.content === '';
    }
    if (viewerOk && remote) return reactionIsLike(remote.content, remote.reaction);
    if (viewerOk) return false;
    return null;
  }

  async function pushUrlEvent(event, relay) {
    let result;
    try {
      result = await sendExtensionMessage({
        type: 'INGEST_URL_EVENT',
        event: event,
        relay: relay
      });
    } catch (_error) {
      throw new Error('Directory did not store the reaction');
    }
    if (!result || result.ok === false) {
      throw new Error('Directory did not store the reaction');
    }
    if (result.activity) rememberActivityFromIngest(result.activity);
  }

  function publishOne(pool, relay, event) {
    let pending;
    try {
      pending = pool.publish([relay], event);
    } catch (error) {
      return Promise.reject(error);
    }
    const first = Array.isArray(pending) ? pending[0] : pending;
    if (!first || typeof first.then !== 'function') {
      return Promise.reject(new Error('No relay accepted the reaction event'));
    }
    return Promise.resolve(first).then(function () {
      return relay;
    });
  }

  async function settleWriteRelays(pool, event, writesPromise) {
    let writes = [];
    try {
      writes = await writesPromise;
    } catch (_error) {
      writes = [];
    }
    for (const relay of writes) {
      if (RENDEZVOUS_SET.has(relay)) continue;
      try {
        await publishOne(pool, relay, event);
      } catch (_error) {
        // A relay that refuses the event is skipped.
      }
    }
  }

  function assertZapRequestRelays(event) {
    const relaysTags = event.tags.filter(function (tag) {
      return Array.isArray(tag) && tag[0] === 'relays';
    });
    if (relaysTags.length !== 1) {
      throw new Error('Zap request relays do not include the rendezvous relays');
    }
    const urls = [];
    for (const value of relaysTags[0].slice(1)) {
      const normalized = normalizeRelayUrl(value);
      if (normalized) urls.push(normalized);
    }
    if (urls.length > ZAP_RELAY_LIMIT) {
      throw new Error('Zap request relays do not include the rendezvous relays');
    }
    for (const required of RENDEZVOUS_RELAYS) {
      if (urls.indexOf(required) === -1) {
        throw new Error('Zap request relays do not include the rendezvous relays');
      }
    }
  }

  async function storedRelayList(pubkey) {
    if (relayListMemory.has(pubkey)) return relayListMemory.get(pubkey);
    if (pubkey === signerPubkeyMemory) return null;
    if (typeof extension.storage.getRelayList !== 'function') return null;
    const event = await extension.storage.getRelayList(pubkey);
    if (!acceptedEvent(pubkey, event, 10002)) return null;
    relayListMemory.set(pubkey, event);
    return event;
  }

  async function zapRelaysForRecipient(pubkey) {
    const record = profileRecords.get(pubkey);
    const age = record ? Date.now() - record.fetchedAt : Infinity;
    if (!record || !record.event || age > PROFILE_FRESH_MS || record.zappable == null) {
      const views = await lookupProfiles([pubkey], true);
      for (const view of views) applyProfileView(view);
    }
    if (!relayListMemory.has(pubkey)) await storedRelayList(pubkey);
    const reads = relaysFromList(relayListMemory.get(pubkey), 'read')
      .filter(function (url) { return !RENDEZVOUS_SET.has(url); })
      .slice(0, WRITE_RELAY_LIMIT);
    const zapRelays = RENDEZVOUS_RELAYS.concat(reads).slice(0, ZAP_RELAY_LIMIT);
    zapRelaysByPubkey.set(pubkey, zapRelays);
    return zapRelays;
  }

  function watchOneRelay(pool, relay, filter, onEvent) {
    return new Promise(function (resolve) {
      let closer = null;
      let finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (closer && typeof closer.close === 'function') void closer.close();
        resolve();
      }
      const timer = setTimeout(finish, QUERY_DEADLINE_MS);
      try {
        closer = pool.subscribe([relay], filter, {
          onevent: function (event) {
            onEvent(event, relay);
          },
          oneose: finish,
          onclose: finish,
          maxWait: QUERY_DEADLINE_MS
        });
      } catch (_error) {
        finish();
      }
    });
  }

  async function handleLikeRead(operation, payload) {
    if (
      !payloadAllows(payload, ['relays', 'url']) ||
      !isAllowedContentUrl(payload.url) ||
      !Array.from(actionContexts.values()).some(function (context) {
        return context.url === payload.url;
      })
    ) {
      throw new Error('Known-reaction request contains unexpected data');
    }
    const publicKey = await extension.storage.getKnownPubkey();
    if (operation === 'getCachedLikeState') {
      const cachedEvents = await getRecentReactions(payload.url);
      const latest = findLatestReaction(cachedEvents, publicKey);
      return {
        found: Boolean(latest),
        isLiked: latest?.content === '+' || latest?.content === ''
      };
    }
    const urlKey = await pageUrlKey(payload.url);
    if (!urlKey) throw new Error('Like count is unavailable');
    const activityPromise = requestActivity({ urlKey: urlKey, recipient: null });
    let viewerPromise = Promise.resolve({ ok: false, reactions: [] });
    if (publicKey) {
      void ensureSignerRelays(publicKey).catch(function () {});
      viewerPromise = viewerReactionsOnce(publicKey);
    }
    const row = await activityPromise;
    const viewer = await viewerPromise;
    const local = findLatestReaction(await getRecentReactions(payload.url), publicKey);
    const remote = newestViewerReaction(viewer.reactions, urlKey);
    if (local && remote && remote.eventId && remote.eventId === local.id) {
      forgetRecentReaction(local.id);
    }
    return {
      totalCount: countOf(row.likes),
      likedCount: countOf(row.likes),
      dislikedCount: countOf(row.dislikes),
      isLiked: likedNow(local, remote, viewer.ok)
    };
  }

  async function handleGetProfiles(payload) {
    if (!payloadAllows(payload, ['actionId', 'pubkeys']) || !Array.isArray(payload.pubkeys)) {
      throw new Error('Profile request contains unexpected data');
    }
    getActionContext(payload.actionId, false);
    if (payload.pubkeys.length < 1 || payload.pubkeys.length > PROFILE_PUBKEY_LIMIT) {
      throw new Error('Profile request contains unexpected data');
    }
    const pubkeys = [];
    for (const value of payload.pubkeys) {
      const pubkey = String(value || '').toLowerCase();
      if (!HEX_64_PATTERN.test(pubkey) || pubkeys.indexOf(pubkey) !== -1) {
        throw new Error('Profile request contains unexpected data');
      }
      pubkeys.push(pubkey);
    }
    const views = await lookupProfiles(pubkeys, false);
    const events = [];
    const requested = new Set(pubkeys);
    for (const view of views) {
      if (!requested.has(String(view && view.pubkey || '').toLowerCase())) continue;
      const kept = applyProfileView(view);
      if (kept.profile) events.push(kept.profile);
      if (kept.relayList) events.push(kept.relayList);
    }
    return events;
  }

  async function handleGetZapRoute(payload) {
    if (!payloadAllows(payload, ['actionId'])) {
      throw new Error('Zap route request contains unexpected data');
    }
    const context = getActionContext(payload.actionId, true);
    const zapRelays = await zapRelaysForRecipient(context.recipientPubkey);
    const provider = await resolveZapProvider(payload.actionId, context);
    return {
      provider: {
        lnurl: provider.lnurl,
        callback: provider.callback,
        nostrPubkey: provider.nostrPubkey
      },
      zapRelays: zapRelays
    };
  }

  async function handleGetZapSummary(payload) {
    if (!payloadAllows(payload, ['actionId'])) {
      throw new Error('Zap summary request contains unexpected data');
    }
    const context = getActionContext(payload.actionId, true);
    const urlKey = await pageUrlKey(context.url);
    if (!urlKey) throw new Error('Zap total is unavailable');
    const row = await requestActivity({
      urlKey: urlKey,
      recipient: context.recipientPubkey
    });
    return {
      totalAmount: countOf(row.sats),
      zapDetails: []
    };
  }

  async function handleListZaps(payload) {
    if (!payloadAllows(payload, ['actionId'])) {
      throw new Error('Zap list request contains unexpected data');
    }
    const context = getActionContext(payload.actionId, true);
    const urlKey = await pageUrlKey(context.url);
    if (!urlKey) throw new Error('Zap total is unavailable');
    const result = await sendExtensionMessage({
      type: 'LIST_URL_EVENTS',
      key: urlKey,
      recipient: context.recipientPubkey,
      limit: '50'
    });
    if (!result || !Array.isArray(result.zaps)) {
      throw new Error('Zap total is unavailable');
    }
    return result.zaps.map(function (row) {
      const author = typeof row.senderPubkey === 'string' ? row.senderPubkey.toLowerCase() : '';
      return {
        amount: countOf(row.sats),
        createdAt: Number.isFinite(Number(row.createdAt)) ? Number(row.createdAt) : 0,
        authorPubkey: HEX_64_PATTERN.test(author) ? author : null,
        comment: typeof row.comment === 'string' ? row.comment : ''
      };
    });
  }

  async function handleYouTubeProfileQuery(pool, payload, filter) {
    const context = getActionContext(payload && payload.actionId, false);
    if (!context || context.kind !== 'youtube') {
      throw new Error('Relay request contains an unsupported filter');
    }
    const relays = uniqueRelays(Array.isArray(payload.relays) ? payload.relays : []);
    if (!relays.length) throw new Error('Relay request contains an unsupported filter');
    return queryWithFastQuorum(pool, relays, filter, { keepNewestProfile: true });
  }

  async function handleReceiptWatch(pool, payload) {
    if (!payloadAllows(payload, ['relays', 'filter', 'actionId'])) {
      throw new Error('Relay request contains an unsupported filter');
    }
    const filter = validateFilter(payload.filter);
    if (
      !filter ||
      filter.kinds[0] !== 9735 ||
      filter.since === undefined ||
      !isFilterBoundToAction(filter, payload.actionId)
    ) {
      throw new Error('Relay request contains an unsupported filter');
    }
    const recipient = filter['#p'][0];
    const relays = zapRelaysByPubkey.get(recipient) || RENDEZVOUS_RELAYS.slice();
    const events = [];
    const seen = new Set();
    await Promise.all(relays.map(function (relay) {
      return watchOneRelay(pool, relay, filter, function (event, source) {
        if (!event || !event.id || seen.has(event.id)) return;
        if (event.kind !== 9735 || !eventVerified(event)) return;
        const pTag = Array.isArray(event.tags)
          ? event.tags.find(function (tag) {
            return Array.isArray(tag) && tag[0] === 'p';
          })
          : null;
        if (!pTag || String(pTag[1] || '').toLowerCase() !== recipient) return;
        seen.add(event.id);
        events.push(event);
        if (SWEEP_RELAYS.has(source)) {
          void pushUrlEvent(event, source).catch(function () {});
        }
      });
    }));
    return events;
  }

  async function handlePublish(pool, payload) {
    const actionId = String(payload && payload.actionId || '');
    const actionContext = ACTION_ID_PATTERN.test(actionId)
      ? actionContexts.get(actionId)
      : null;
    if (
      !payloadAllows(payload, ['relays', 'event', 'actionId']) ||
      !actionContext
    ) {
      throw new Error('Relay publish is not bound to an action');
    }
    const event = validateReactionEvent(payload.event, actionContext.url);
    if (!event) throw new Error('Relay request contains an invalid reaction event');
    let acceptedRelay;
    try {
      acceptedRelay = await Promise.any(RENDEZVOUS_RELAYS.map(function (relay) {
        return publishOne(pool, relay, event);
      }));
    } catch (_error) {
      throw new Error('No relay acknowledged the reaction event');
    }
    await extension.storage.setKnownPubkey(event.pubkey);
    await rememberRecentReaction(event);
    viewerReactions = null;
    const writesPromise = ensureSignerRelays(event.pubkey);
    void settleWriteRelays(pool, event, writesPromise);
    try {
      await pushUrlEvent(event, acceptedRelay);
    } catch (_error) {
      // The relay already accepted the reaction. A directory miss must not
      // fail the like; the sweep can store it later.
    }
    return null;
  }

  function getExactTag(event, name) {
    const matches = event.tags.filter(function (tag) {
      return Array.isArray(tag) && tag.length >= 2 && tag[0] === name;
    });
    return matches.length === 1 ? matches[0][1] : null;
  }

  function validateBoundZapRequest(event, context, amount, comment) {
    if (
      !event ||
      typeof event !== 'object' ||
      event.kind !== 9734 ||
      event.content !== comment ||
      !Array.isArray(event.tags) ||
      event.tags.some(function (tag) {
        return (
          !Array.isArray(tag) ||
          tag.some(function (value) {
            return typeof value !== 'string';
          })
        );
      }) ||
      !verifyEvent(event)
    ) {
      return null;
    }
    const pageUrl = canonicalPageUrl(context.url);
    const expectedATag = pageUrl
      ? '39735:' + context.recipientPubkey + ':' + pageUrl
      : null;
    if (
      !pageUrl ||
      String(getExactTag(event, 'p') || '').toLowerCase() !==
        context.recipientPubkey ||
      getExactTag(event, 'amount') !== String(amount) ||
      getExactTag(event, 'a') !== expectedATag
    ) {
      return null;
    }
    return event;
  }

  function getInvoiceAmountMsats(invoice) {
    try {
      const decoded = decodeBolt11(invoice);
      const amount = decoded.sections.find(function (section) {
        return section.name === 'amount';
      });
      if (!amount?.value) return null;
      const value = Number(amount.value);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_error) {
      return null;
    }
  }

  async function fetchZapInvoice(payload) {
    const context = getActionContext(payload?.actionId, true);
    const amount = payload?.amount;
    const comment = typeof payload?.comment === 'string'
      ? payload.comment
      : '';
    if (
      !Number.isInteger(amount) ||
      amount < 1000 ||
      amount > 210000000 ||
      comment.length > 280 ||
      Object.keys(payload).some(
        (key) =>
          key !== 'actionId' &&
          key !== 'relays' &&
          key !== 'amount' &&
          key !== 'comment' &&
          key !== 'zapEvent'
      )
    ) {
      throw new Error('Zap invoice request contains unexpected data');
    }
    const zapEvent = validateBoundZapRequest(
      payload.zapEvent,
      context,
      amount,
      comment
    );
    if (!zapEvent) {
      throw new Error('Zap request is not bound to the active recipient');
    }
    assertZapRequestRelays(zapEvent);

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const provider = await resolveZapProvider(
          payload.actionId,
          context,
          {
            allowStale: false,
            bypassCache: attempt > 0
          }
        );
        if (
          (provider.minSendable !== null && amount < provider.minSendable) ||
          (provider.maxSendable !== null && amount > provider.maxSendable) ||
          comment.length > provider.commentAllowed
        ) {
          throw new Error('Zap amount or comment is not supported by the provider');
        }
        const callback = new URL(provider.callback);
        callback.searchParams.set('amount', String(amount));
        callback.searchParams.set('nostr', JSON.stringify(zapEvent));
        if (comment) callback.searchParams.set('comment', comment);

        requireCurrentActionContext(payload.actionId, context);
        const response = await sendHttpsJsonRequest(callback.toString());
        requireCurrentActionContext(payload.actionId, context);
        const invoice = response?.json?.pr;
        if (
          response?.status < 200 ||
          response?.status >= 300 ||
          typeof invoice !== 'string' ||
          getInvoiceAmountMsats(invoice) !== amount
        ) {
          throw new Error('Zap provider returned an invalid invoice');
        }
        return {
          invoice: invoice,
          provider: {
            lnurl: provider.lnurl,
            callback: provider.callback,
            nostrPubkey: provider.nostrPubkey
          }
        };
      } catch (error) {
        requireCurrentActionContext(payload.actionId, context);
        lastError = error;
        if (attempt === 0) {
          await dropProvider(context.recipientPubkey);
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('Zap provider returned an invalid invoice');
  }

  function isFilterBoundToAction(filter, actionId) {
    if (
      filter.kinds[0] === 0 &&
      ACTION_ID_PATTERN.test(String(actionId || '')) &&
      actionContexts.has(actionId)
    ) {
      return true;
    }
    for (const context of actionContexts.values()) {
      if (
        filter.kinds[0] === 17 &&
        filter['#i']?.[0] === context.url
      ) {
        return true;
      }
      if (
        filter.kinds[0] === 0 &&
        context.recipientPubkey &&
        filter.authors.every(
          (author) => author === context.recipientPubkey
        )
      ) {
        return true;
      }
      if (
        filter.kinds[0] === 9735 &&
        context.recipientPubkey === filter['#p']?.[0] &&
        (
          !filter['#a'] ||
          filter['#a'][0] ===
            '39735:' + context.recipientPubkey + ':' + context.url
        )
      ) {
        return true;
      }
    }
    return false;
  }

  async function handleRequest(pool, message) {
    const payload = message.payload;

    if (
      message.operation === 'getCachedLikeState' ||
      message.operation === 'getLikeState'
    ) {
      return handleLikeRead(message.operation, payload);
    }

    if (message.operation === 'getProfiles') {
      return handleGetProfiles(payload);
    }

    if (message.operation === 'getZapRoute') {
      return handleGetZapRoute(payload);
    }

    if (message.operation === 'getZapSummary') {
      return handleGetZapSummary(payload);
    }

    if (message.operation === 'listZaps') {
      return handleListZaps(payload);
    }

    if (message.operation === 'query') {
      const filter = validateFilter(payload && payload.filter);
      if (filter && filter.kinds[0] === 0) {
        return handleYouTubeProfileQuery(pool, payload, filter);
      }
      return handleReceiptWatch(pool, payload);
    }

    if (message.operation === 'publish') {
      return handlePublish(pool, payload);
    }

    if (
      message.operation === 'getZapProvider' ||
      message.operation === 'fetchZapInvoice'
    ) {
      const context = getActionContext(payload?.actionId, true);
      if (message.operation === 'getZapProvider') {
        if (!payloadAllows(payload, ['actionId', 'relays'])) {
          throw new Error('Zap provider request contains unexpected data');
        }
        const provider = await resolveZapProvider(payload.actionId, context);
        return {
          lnurl: provider.lnurl,
          callback: provider.callback,
          nostrPubkey: provider.nostrPubkey
        };
      }
      return fetchZapInvoice(payload);
    }

    throw new Error('Unsupported relay operation');
  }

  function configure(channel, options) {
    if (!CHANNEL_PATTERN.test(String(channel || ''))) {
      throw new Error('Invalid relay bridge channel');
    }
    if (activeSession && activeSession.channel === channel) {
      return activeSession;
    }
    if (activeSession) {
      activeSession.dispose();
    }

    const pool = (options && options.pool) || new SimplePool();
    const pageWindow = (options && options.window) || window;
    const authenticator = createBridgeAuthenticator(channel);
    const handledRequestIds = new Set();

    function rememberRequestId(requestId) {
      handledRequestIds.add(requestId);
      if (handledRequestIds.size > 1024) {
        handledRequestIds.delete(handledRequestIds.values().next().value);
      }
    }

    async function onMessage(event) {
      const candidate = event.data;
      if (
        event.source !== pageWindow ||
        event.origin !== pageWindow.location.origin ||
        !isAllowedPageOrigin(event.origin) ||
        !candidate ||
        candidate.source !== REQUEST_SOURCE ||
        !REQUEST_ID_PATTERN.test(String(candidate.requestId || '')) ||
        !MESSAGE_MAC_PATTERN.test(String(candidate.mac || '')) ||
        handledRequestIds.has(candidate.requestId)
      ) {
        return;
      }

      let message;
      try {
        message = cloneBridgeValue(candidate);
      } catch (_error) {
        return;
      }
      if (
        !message ||
        message.source !== REQUEST_SOURCE ||
        !REQUEST_ID_PATTERN.test(String(message.requestId || '')) ||
        !MESSAGE_MAC_PATTERN.test(String(message.mac || '')) ||
        handledRequestIds.has(message.requestId)
      ) {
        return;
      }

      let authenticated = false;
      try {
        authenticated = await authenticator.verifyRequest(message);
      } catch (_error) {
        return;
      }
      if (!authenticated || handledRequestIds.has(message.requestId)) return;
      rememberRequestId(message.requestId);

      let response;
      try {
        response = {
          source: RESPONSE_SOURCE,
          requestId: message.requestId,
          requestMac: message.mac,
          operation: message.operation,
          ok: true,
          result: await handleRequest(pool, message)
        };
      } catch (error) {
        response = {
          source: RESPONSE_SOURCE,
          requestId: message.requestId,
          requestMac: message.mac,
          operation: message.operation,
          ok: false,
          error: error instanceof Error ? error.message : 'Relay request failed'
        };
      }

      try {
        response.mac = await authenticator.signResponse(response);
        pageWindow.postMessage(response, event.origin);
      } catch (_error) {
        // Fail closed if the bridge response cannot be authenticated.
      }
    }

    pageWindow.addEventListener('message', onMessage);
    activeSession = {
      channel: channel,
      dispose: function () {
        pageWindow.removeEventListener('message', onMessage);
        if (typeof pool.destroy === 'function') pool.destroy();
        if (activeSession && activeSession.channel === channel) {
          activeSession = null;
        }
      }
    };
    return activeSession;
  }

  extension.relayClient = {
    configure: configure,
    queryWithFastQuorum: queryWithFastQuorum,
    createBridgeAuthenticator: createBridgeAuthenticator,
    isAllowedContentUrl: isAllowedContentUrl,
    isAllowedStatusUrl: isAllowedStatusUrl,
    validateFilter: validateFilter,
    validateReactionEvent: validateReactionEvent,
    registerActionContext: registerActionContext,
    revokeActionContext: revokeActionContext,
    seedIdentity: seedIdentity,
    isAllowedZapHttpUrl: function (value) {
      return Boolean(extension.zapHttp && extension.zapHttp.isAllowedZapHttpUrl(value));
    }
  };
})();
