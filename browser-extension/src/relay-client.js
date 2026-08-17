// SPDX-License-Identifier: MIT

import { SimplePool, verifyEvent } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const REQUEST_SOURCE = 'nostr-components-relay-main';
  const RESPONSE_SOURCE = 'nostr-components-relay-extension';
  const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
  const REQUEST_ID_PATTERN = /^[0-9a-f]{32}$/;
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
      'wss://relay.damus.io',
      'wss://nostr.wine',
      'wss://relay.nostr.net',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://nostr-pub.wellorder.net',
      'wss://relay.getalby.com',
      'wss://relay.primal.net'
    ].map(normalizeURL)
  );

  let activeSession = null;
  const relayHealth = new Map();
  const recentReactionsByUrl = new Map();

  function rememberRecentReaction(event) {
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
  }

  function getRecentReactions(url) {
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

  function queryWithFastQuorum(pool, relays, filters) {
    const selectedRelays = selectQueryRelays(relays);
    const filterList = Array.isArray(filters) ? filters : [filters];
    const eventsById = new Map();
    const closers = [];

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
            if (completedRelays.has(relay)) continue;
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
            successfulResponses >= requiredResponses ||
            completedRelays.size === selectedRelays.length
          ) {
            finish();
          }
        }
        const options = {
          maxWait: QUERY_DEADLINE_MS,
          onevent(event) {
            if (event && event.id) eventsById.set(event.id, event);
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
    if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
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

  function validateReactionEvent(event) {
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
      !verifyEvent(event)
    ) {
      return null;
    }

    return event;
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

  async function handleRequest(pool, message) {
    const payload = message.payload;
    const relays = validateRelays(payload && payload.relays);
    if (!relays) {
      throw new Error('Relay request contains an unsupported relay list');
    }

    if (message.operation === 'getLikeState') {
      if (
        !payload ||
        Object.keys(payload).some((key) => key !== 'relays' && key !== 'url') ||
        !isAllowedContentUrl(payload.url)
      ) {
        throw new Error('Known-reaction request contains unexpected data');
      }

      const publicKey = await extension.storage.getKnownPubkey();
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
      const eventsById = new Map(
        [...queriedEvents, ...getRecentReactions(payload.url)].map((event) => [event.id, event])
      );
      const events = Array.from(eventsById.values());
      const ownEvents = publicKey ? events.filter((event) => event.pubkey === publicKey) : [];
      const latest = [...ownEvents].sort(
        (a, b) => b.created_at - a.created_at || (a.id === b.id ? 0 : a.id > b.id ? -1 : 1)
      )[0];
      return {
        ...summarizeReactionEvents(events),
        isLiked: latest?.content === '+' || latest?.content === ''
      };
    }

    if (message.operation === 'query') {
      const filter = validateFilter(payload.filter);
      if (!filter) {
        throw new Error('Relay request contains an unsupported filter');
      }
      return queryWithFastQuorum(pool, relays, filter);
    }

    if (message.operation === 'publish') {
      const event = validateReactionEvent(payload.event);
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
      rememberRecentReaction(event);
      return null;
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

    async function onMessage(event) {
      const message = event.data;
      if (
        event.source !== pageWindow ||
        event.origin !== pageWindow.location.origin ||
        !isAllowedPageOrigin(event.origin) ||
        !message ||
        message.source !== REQUEST_SOURCE ||
        message.channel !== channel ||
        !REQUEST_ID_PATTERN.test(String(message.requestId || ''))
      ) {
        return;
      }

      try {
        const result = await handleRequest(pool, message);
        pageWindow.postMessage(
          {
            source: RESPONSE_SOURCE,
            channel: channel,
            requestId: message.requestId,
            ok: true,
            result: result
          },
          event.origin
        );
      } catch (error) {
        pageWindow.postMessage(
          {
            source: RESPONSE_SOURCE,
            channel: channel,
            requestId: message.requestId,
            ok: false,
            error: error instanceof Error ? error.message : 'Relay request failed'
          },
          event.origin
        );
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
    isAllowedContentUrl: isAllowedContentUrl,
    isAllowedStatusUrl: isAllowedStatusUrl,
    validateFilter: validateFilter,
    validateReactionEvent: validateReactionEvent,
    validateRelays: validateRelays
  };
})();
