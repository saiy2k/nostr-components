// SPDX-License-Identifier: MIT

import { SimplePool, nip19, verifyEvent } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';
import { bech32 } from '@scure/base';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';

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
  const ALLOWED_RELAY_URLS = new Set(
    [
      'wss://relay.momostr.pink',
      'wss://relay.ditto.pub',
      'wss://relay.primal.net',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://nostr.mom',
      'wss://nostr.twinkle.lol',
      'wss://nostr.wine',
      'wss://nostr.bitcoiner.social',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://nostr.data.haus',
      'wss://purplepag.es',
      'wss://nostr.oxtr.dev',
      'wss://relay.0xchat.com',
      'wss://nostr.land',
      'wss://relay.us.whitenoise.chat',
      'wss://relay.eu.whitenoise.chat',
      'wss://relay.divine.video',
      'wss://offchain.pub',
      'wss://nostrelites.org',
      'wss://relay.nostr.wirednet.jp',
      'wss://relayable.org',
      'wss://shu01.shugur.net',
      'wss://www.nostr.ltd',
      'wss://nostr.rocks',
      'wss://relay.nostr.pub',
      'wss://cache1.primal.net',
      'wss://nostr-01.yakihonne.com',
      'wss://wot.nostr.net',
      'wss://relay.nyves.nl',
      'wss://relay.fountain.fm',
      'wss://relay.mostr.pub',
      'wss://nostr.lol',
      'wss://eden.nostr.land',
      'wss://wot.utxo.one',
      'wss://relay.current.fyi',
      'wss://relay.nmail.li',
      'wss://fanfares.nostr1.com',
      'wss://pyramid.fiatjaf.com',
      'wss://wot.nostr.party',
      'wss://relay.mostro.network',
      'wss://yabu.me',
      'wss://nostr-02.yakihonne.com',
      'wss://nostr-pub.wellorder.net',
      'wss://relay.nostr.net',
      'wss://nostr.einundzwanzig.space',
      'wss://relay.f7z.io',
      'wss://relay.wisp.talk',
      'wss://relay.wavlake.com',
      'wss://relay.getalby.com'
    ].map(normalizeURL)
  );

  let activeSession = null;
  const relayHealth = new Map();
  const recentReactionsByUrl = new Map();
  const actionContexts = new Map();

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
    reactionsByPubkey.set(event.pubkey, {
      event: event,
      expiresAt: Date.now() + RECENT_REACTION_TTL_MS
    });
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
    const now = Date.now();
    const events = [];
    for (const [pubkey, entry] of reactionsByPubkey) {
      if (entry.expiresAt <= now) reactionsByPubkey.delete(pubkey);
      else events.push(entry.event);
    }
    if (reactionsByPubkey.size === 0) recentReactionsByUrl.delete(url);
    return events;
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
              const current = eventsById.values().next().value || null;
              if (!current || preferProfile(event, current)) {
                eventsById.clear();
                eventsById.set(event.id, event);
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

  function validateRelays(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
      return null;
    }

    const normalized = [];
    for (const relay of value) {
      if (typeof relay !== 'string') return null;
      let relayUrl;
      try {
        relayUrl = normalizeURL(relay);
      } catch (_error) {
        return null;
      }
      if (!ALLOWED_RELAY_URLS.has(relayUrl) || normalized.includes(relayUrl)) {
        return null;
      }
      normalized.push(relayUrl);
    }
    return normalized;
  }

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

  function sendHttpsJsonRequest(url) {
    const message = { type: 'FETCH_HTTPS_JSON', url: url };
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime.sendMessage(message).then(function (response) {
        if (!response || response.ok !== true) {
          throw new Error((response && response.error) || 'HTTPS fetch failed');
        }
        return response.result;
      });
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage(message, function (value) {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          if (!value || value.ok !== true) {
            reject(new Error((value && value.error) || 'HTTPS fetch failed'));
            return;
          }
          resolve(value.result);
        });
      });
    }
    return Promise.reject(new Error('Browser runtime API is not available'));
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

  async function resolveZapProvider(pool, relays, actionId, context) {
    const events = await queryWithFastQuorum(
      pool,
      relays,
      {
        kinds: [0],
        authors: [context.recipientPubkey],
        limit: 1
      },
      {
        keepNewestProfile: true,
        selectedRelays: relays
      }
    );
    requireCurrentActionContext(actionId, context);
    const profiles = events
      .filter(function (event) {
        return (
          event?.kind === 0 &&
          String(event.pubkey || '').toLowerCase() ===
            context.recipientPubkey &&
          verifyEvent(event)
        );
      })
      .sort(function (left, right) {
        const timestampOrder = right.created_at - left.created_at;
        if (timestampOrder !== 0) return timestampOrder;
        if (left.id < right.id) return -1;
        if (left.id > right.id) return 1;
        return 0;
      });
    const lnurl = profiles.length > 0
      ? profileLnurl(profiles[0].content)
      : null;
    if (!lnurl) {
      throw new Error('Zap recipient has no valid LNURL provider');
    }

    const response = await sendHttpsJsonRequest(lnurl);
    requireCurrentActionContext(actionId, context);
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
    const callback = extension.zapHttp?.normalizeZapHttpUrl(body.callback);
    if (!callback) {
      throw new Error('Zap provider returned an invalid callback');
    }
    return {
      lnurl: lnurl,
      callback: callback,
      nostrPubkey: String(body.nostrPubkey).toLowerCase(),
      minSendable: Number.isFinite(body.minSendable)
        ? body.minSendable
        : null,
      maxSendable: Number.isFinite(body.maxSendable)
        ? body.maxSendable
        : null,
      commentAllowed: Number.isInteger(body.commentAllowed)
        ? body.commentAllowed
        : 0
    };
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
    const expectedATag =
      '39735:' + context.recipientPubkey + ':' + normalizeURL(context.url);
    if (
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

  async function fetchZapInvoice(pool, relays, payload) {
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

    const provider = await resolveZapProvider(
      pool,
      relays,
      payload.actionId,
      context
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
    const relays = validateRelays(payload && payload.relays);
    if (!relays) {
      throw new Error('Relay request contains an unsupported relay list');
    }

    if (
      message.operation === 'getCachedLikeState' ||
      message.operation === 'getLikeState'
    ) {
      if (
        !payload ||
        Object.keys(payload).some((key) => key !== 'relays' && key !== 'url') ||
        !isAllowedContentUrl(payload.url) ||
        !Array.from(actionContexts.values()).some(
          (context) => context.url === payload.url
        )
      ) {
        throw new Error('Known-reaction request contains unexpected data');
      }

      const publicKey = await extension.storage.getKnownPubkey();
      if (message.operation === 'getCachedLikeState') {
        const cachedEvents = await getRecentReactions(payload.url);
        const latest = findLatestReaction(cachedEvents, publicKey);
        return {
          found: Boolean(latest),
          isLiked: latest?.content === '+' || latest?.content === ''
        };
      }

      const countFilter = {
        kinds: [17],
        '#k': ['web'],
        '#i': [payload.url],
        limit: 1000
      };
      const filters = [countFilter];
      if (publicKey) {
        filters.push({
          kinds: [17],
          authors: [publicKey],
          '#k': ['web'],
          '#i': [payload.url],
          limit: 1
        });
      }
      const queriedEvents = await queryWithFastQuorum(pool, relays, filters);
      const recentEvents = await getRecentReactions(payload.url);
      const eventsById = new Map(
        [...queriedEvents, ...recentEvents].map((event) => [event.id, event])
      );
      const events = Array.from(eventsById.values());
      const latest = findLatestReaction(events, publicKey);
      return {
        ...summarizeReactionEvents(events),
        isLiked: latest?.content === '+' || latest?.content === ''
      };
    }

    if (message.operation === 'query') {
      const filter = validateFilter(payload.filter);
      if (
        Object.keys(payload).some(
          (key) =>
            key !== 'relays' &&
            key !== 'filter' &&
            key !== 'actionId'
        ) ||
        !filter ||
        !isFilterBoundToAction(filter, payload.actionId)
      ) {
        throw new Error('Relay request contains an unsupported filter');
      }
      const profileQuery = filter.kinds[0] === 0;
      const singleProfileLookup =
        profileQuery && filter.authors.length === 1;
      // A zap for one post often lives on a single slower relay. Three fast
      // empty replies are not proof the post has no receipts.
      const zapQuery = filter.kinds[0] === 9735;
      const events = await queryWithFastQuorum(
        pool,
        relays,
        filter,
        singleProfileLookup
          ? {
              keepNewestProfile: true,
              selectedRelays: relays
            }
          : zapQuery
            ? { requireEvent: true }
            : undefined
      );
      if (!profileQuery) return events;
      const authors = new Set(filter.authors);
      return events.filter(function (event) {
        return (
          event?.kind === 0 &&
          authors.has(String(event.pubkey || '').toLowerCase()) &&
          verifyEvent(event)
        );
      });
    }

    if (message.operation === 'publish') {
      const actionId = String(payload?.actionId || '');
      const actionContext = ACTION_ID_PATTERN.test(actionId)
        ? actionContexts.get(actionId)
        : null;
      if (
        !payload ||
        Object.keys(payload).some(
          (key) =>
            key !== 'relays' && key !== 'event' && key !== 'actionId'
        ) ||
        !actionContext
      ) {
        throw new Error('Relay publish is not bound to an action');
      }
      const event = validateReactionEvent(
        payload.event,
        actionContext.url
      );
      if (!event) {
        throw new Error('Relay request contains an invalid reaction event');
      }
      const publishes = pool.publish(relays, event);
      if (!Array.isArray(publishes) || publishes.length === 0) {
        throw new Error('No relay accepted the reaction event');
      }
      try {
        await Promise.any(publishes);
      } catch (_error) {
        throw new Error('No relay acknowledged the reaction event');
      }
      await extension.storage.setKnownPubkey(event.pubkey);
      await rememberRecentReaction(event);
      return null;
    }

    if (
      message.operation === 'getZapProvider' ||
      message.operation === 'fetchZapInvoice'
    ) {
      const context = getActionContext(payload?.actionId, true);
      if (message.operation === 'getZapProvider') {
        if (
          Object.keys(payload).some(
            (key) => key !== 'actionId' && key !== 'relays'
          )
        ) {
          throw new Error('Zap provider request contains unexpected data');
        }
        const provider = await resolveZapProvider(
          pool,
          relays,
          payload.actionId,
          context
        );
        return {
          lnurl: provider.lnurl,
          callback: provider.callback,
          nostrPubkey: provider.nostrPubkey
        };
      }
      return fetchZapInvoice(pool, relays, payload);
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
    validateRelays: validateRelays,
    isAllowedZapHttpUrl: function (value) {
      return Boolean(extension.zapHttp && extension.zapHttp.isAllowedZapHttpUrl(value));
    }
  };
})();
