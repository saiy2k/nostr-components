(function () {
  const STATUS_PATH_PATTERN = /^\/([^/]+)\/status\/(\d+)$/;
  const INJECT_DELAY_MS = 120;
  const RELAY_QUERY_TIMEOUT_MS = 2200;
  const RELAY_PUBLISH_TIMEOUT_MS = 2200;
  const KNOWN_PUBKEY_STORAGE_KEY = 'nostr-competency-known-pubkey';
  const REACTION_CACHE_STORAGE_PREFIX = 'nostr-competency-reaction:';
  const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nostr.wine',
    'wss://relay.nostr.net',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://nostr-pub.wellorder.net',
    'wss://relay.getalby.com',
    'wss://relay.primal.net'
  ];

  const BRIDGE_REQUEST_SOURCE = 'nostr-competency-extension';
  const BRIDGE_RESPONSE_SOURCE = 'nostr-competency-bridge';

  let injectTimer = null;
  let requestCounter = 0;
  let bridgePromise = null;
  let pubkeyPromise = null;
  let verifiedDirectoryPromise = null;
  const pendingBridgeRequests = new Map();
  const reactionStateCache = new Map();
  const reactionStateInFlight = new Map();

  window.addEventListener('message', function (event) {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== BRIDGE_RESPONSE_SOURCE || !data.requestId) {
      return;
    }

    const pending = pendingBridgeRequests.get(data.requestId);
    if (!pending) {
      return;
    }

    pendingBridgeRequests.delete(data.requestId);

    if (data.ok) {
      pending.resolve(data);
      return;
    }

    pending.reject(new Error(data.error || 'Bridge request failed'));
  });

  function scheduleInjection() {
    window.clearTimeout(injectTimer);
    injectTimer = window.setTimeout(processTweets, INJECT_DELAY_MS);
  }

  function normalizeTweetPath(href) {
    try {
      const url = new URL(href, window.location.origin);
      const match = url.pathname.match(STATUS_PATH_PATTERN);

      if (!match) {
        return null;
      }

      return {
        pathname: url.pathname,
        username: match[1],
        statusId: match[2],
        canonicalUrl: url.origin + url.pathname
      };
    } catch (_error) {
      return null;
    }
  }

  function getTweetInfo(article) {
    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));

    for (const link of links) {
      const parsed = normalizeTweetPath(link.getAttribute('href'));
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  function getExtensionRuntime() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime;
    }

    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime;
    }

    return null;
  }

  async function loadVerifiedDirectory() {
    if (verifiedDirectoryPromise) {
      return verifiedDirectoryPromise;
    }

    verifiedDirectoryPromise = (async function () {
      const runtime = getExtensionRuntime();

      if (!runtime) {
        throw new Error('Browser runtime API is not available');
      }

      const response = await fetch(runtime.getURL('verified-directory.json'));
      if (!response.ok) {
        throw new Error('Failed to load verified directory');
      }

      return response.json();
    })().catch(function (error) {
      verifiedDirectoryPromise = null;
      throw error;
    });

    return verifiedDirectoryPromise;
  }

  async function resolveVerifiedAuthor(handle) {
    const normalizedHandle = String(handle || '').trim().toLowerCase();
    if (!normalizedHandle) {
      return null;
    }

    const directory = await loadVerifiedDirectory();
    const entry = directory[normalizedHandle];

    if (!entry || entry.verified !== true) {
      return null;
    }

    return entry;
  }

  function createState(tweetInfo) {
    return {
      statusId: tweetInfo.statusId,
      canonicalUrl: tweetInfo.canonicalUrl,
      liked: false,
      busy: false,
      initialized: false,
      initPromise: null,
      pubkey: null
    };
  }

  function renderButtonState(button, state) {
    button.dataset.liked = state.liked ? 'true' : 'false';
    button.dataset.busy = state.busy ? 'true' : 'false';
    button.disabled = state.busy;
    button.setAttribute('aria-pressed', state.liked ? 'true' : 'false');
    button.setAttribute(
      'aria-label',
      state.liked ? 'Unlike this post with Nostr' : 'Like this post with Nostr'
    );
    button.setAttribute(
      'title',
      state.busy
        ? 'Sending Nostr reaction...'
        : state.liked
          ? 'Liked with Nostr'
          : 'Like with Nostr'
    );
  }

  function createNostrAction(tweetInfo) {
    const state = createState(tweetInfo);

    const slot = document.createElement('div');
    slot.className = 'nostr-competency-action-slot';
    slot.setAttribute('data-nostr-competency-like', 'true');
    slot.setAttribute('data-status-id', tweetInfo.statusId);
    slot.setAttribute('data-author-handle', tweetInfo.username);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nostr-competency-action-button';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'nostr-competency-action-icon-wrap';

    const icon = document.createElement('span');
    icon.className = 'nostr-competency-action-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" class="nostr-competency-action-svg">
        <path d="M7.5 10.75H4.75v8.5H7.5m0-8.5 3.48-6.31a1.52 1.52 0 0 1 2.84.94l-.36 3.12h3.8c1.2 0 2.08 1.13 1.79 2.3l-1.46 5.94a2.25 2.25 0 0 1-2.18 1.71H7.5"></path>
      </svg>
    `;

    iconWrap.appendChild(icon);
    button.appendChild(iconWrap);
    renderButtonState(button, state);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      void handleReactionClick(button, state, tweetInfo);
    });

    slot.appendChild(button);
    void initializeReactionState(button, state, { silent: true });
    return slot;
  }

  function findActionBar(article) {
    return article.querySelector('div[role="group"]');
  }

  async function injectIntoArticle(article) {
    const tweetInfo = getTweetInfo(article);
    if (!tweetInfo) {
      return;
    }

    const actionBar = findActionBar(article);
    if (!actionBar) {
      return;
    }

    const existing = actionBar.querySelector(
      `[data-nostr-competency-like="true"][data-status-id="${tweetInfo.statusId}"]`
    );

    if (existing) {
      return;
    }

    const verifiedAuthor = await resolveVerifiedAuthor(tweetInfo.username).catch(function () {
      return null;
    });

    if (!verifiedAuthor) {
      return;
    }

    actionBar.appendChild(createNostrAction(tweetInfo));
  }

  function processTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(function (article) {
      void injectIntoArticle(article);
    });
  }

  async function ensureBridgeInjected() {
    if (bridgePromise) {
      return bridgePromise;
    }

    bridgePromise = new Promise(function (resolve, reject) {
      const runtime = getExtensionRuntime();

      if (!runtime) {
        reject(new Error('Browser runtime API is not available'));
        return;
      }

      const script = document.createElement('script');
      script.src = runtime.getURL('page-bridge.js');
      script.onload = function () {
        script.remove();
        resolve();
      };
      script.onerror = function () {
        script.remove();
        reject(new Error('Failed to load the page bridge'));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return bridgePromise;
  }

  async function sendBridgeRequest(type, payload) {
    await ensureBridgeInjected();

    const requestId = 'nostr-competency-' + String(++requestCounter);

    return new Promise(function (resolve, reject) {
      pendingBridgeRequests.set(requestId, { resolve: resolve, reject: reject });

      window.postMessage(
        {
          source: BRIDGE_REQUEST_SOURCE,
          type: type,
          requestId: requestId,
          payload: payload || {}
        },
        '*'
      );

      window.setTimeout(function () {
        const pending = pendingBridgeRequests.get(requestId);
        if (!pending) {
          return;
        }

        pendingBridgeRequests.delete(requestId);
        reject(new Error('Timed out waiting for page signer'));
      }, 5000);
    });
  }

  async function getCurrentUserPubkey() {
    if (!pubkeyPromise) {
      pubkeyPromise = sendBridgeRequest('GET_PUBLIC_KEY')
        .then(function (response) {
          try {
            window.localStorage.setItem(KNOWN_PUBKEY_STORAGE_KEY, response.pubkey);
          } catch (_error) {
            // ignore storage failures
          }
          return response.pubkey;
        })
        .catch(function (error) {
          pubkeyPromise = null;
          throw error;
        });
    }

    return pubkeyPromise;
  }

  function createReactionEvent(url, content) {
    return {
      kind: 17,
      content: content,
      tags: [
        ['k', 'web'],
        ['i', url]
      ],
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  function getReactionCacheKey(url, pubkey) {
    return pubkey + '::' + url;
  }

  function getStoredKnownPubkey() {
    try {
      return window.localStorage.getItem(KNOWN_PUBKEY_STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  }

  function getStoredReactionState(url, pubkey) {
    try {
      const value = window.localStorage.getItem(
        REACTION_CACHE_STORAGE_PREFIX + getReactionCacheKey(url, pubkey)
      );

      if (value === 'liked') {
        return true;
      }

      if (value === 'unliked') {
        return false;
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  function storeReactionState(url, pubkey, liked) {
    try {
      window.localStorage.setItem(
        REACTION_CACHE_STORAGE_PREFIX + getReactionCacheKey(url, pubkey),
        liked ? 'liked' : 'unliked'
      );
    } catch (_error) {
      // ignore storage failures
    }
  }

  function queryEvents(filter) {
    const eventsById = new Map();
    const subscriptionId = 'sub-' + String(Date.now()) + '-' + Math.random().toString(16).slice(2);

    return new Promise(function (resolve) {
      const sockets = [];
      let finishedCount = 0;
      let settled = false;
      let timeoutId = null;

      function finishSocket(ws) {
        if (ws.__nostrCompetencyDone) {
          return;
        }

        ws.__nostrCompetencyDone = true;
        finishedCount += 1;

        if (finishedCount >= DEFAULT_RELAYS.length) {
          settle();
        }
      }

      function settle() {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);

        for (const ws of sockets) {
          try {
            ws.close();
          } catch (_error) {
            // ignore close errors
          }
        }

        resolve(Array.from(eventsById.values()));
      }

      timeoutId = window.setTimeout(settle, RELAY_QUERY_TIMEOUT_MS);

      DEFAULT_RELAYS.forEach(function (relayUrl) {
        let ws;

        try {
          ws = new WebSocket(relayUrl);
          sockets.push(ws);
        } catch (_error) {
          finishedCount += 1;
          return;
        }

        ws.addEventListener('open', function () {
          try {
            ws.send(JSON.stringify(['REQ', subscriptionId, filter]));
          } catch (_error) {
            finishSocket(ws);
          }
        });

        ws.addEventListener('message', function (messageEvent) {
          let data;

          try {
            data = JSON.parse(messageEvent.data);
          } catch (_error) {
            return;
          }

          if (!Array.isArray(data) || data.length < 2) {
            return;
          }

          if (data[0] === 'EVENT' && data[1] === subscriptionId && data[2]) {
            const event = data[2];
            const key = event.id || event.pubkey + ':' + String(event.created_at);
            const existing = eventsById.get(key);

            if (!existing || Number(existing.created_at) < Number(event.created_at)) {
              eventsById.set(key, event);
            }
          }

          if (data[0] === 'EOSE' && data[1] === subscriptionId) {
            finishSocket(ws);
          }
        });

        ws.addEventListener('error', function () {
          finishSocket(ws);
        });

        ws.addEventListener('close', function () {
          finishSocket(ws);
        });
      });

      if (DEFAULT_RELAYS.length === 0) {
        settle();
        return;
      }

      if (finishedCount >= DEFAULT_RELAYS.length) {
        settle();
      }
    });
  }

  async function fetchLatestUserReaction(url, pubkey) {
    const events = await queryEvents({
      kinds: [17],
      authors: [pubkey],
      '#k': ['web'],
      '#i': [url],
      limit: 5
    });

    if (events.length === 0) {
      return null;
    }

    events.sort(function (a, b) {
      return Number(b.created_at || 0) - Number(a.created_at || 0);
    });

    return events[0];
  }

  async function resolveLikedState(url, pubkey) {
    const cacheKey = getReactionCacheKey(url, pubkey);

    if (reactionStateCache.has(cacheKey)) {
      return reactionStateCache.get(cacheKey);
    }

    if (reactionStateInFlight.has(cacheKey)) {
      return reactionStateInFlight.get(cacheKey);
    }

    const pending = fetchLatestUserReaction(url, pubkey)
      .then(function (latestReaction) {
        const liked = !!latestReaction && latestReaction.content !== '-';
        reactionStateCache.set(cacheKey, liked);
        storeReactionState(url, pubkey, liked);
        reactionStateInFlight.delete(cacheKey);
        return liked;
      })
      .catch(function (error) {
        reactionStateInFlight.delete(cacheKey);
        throw error;
      });

    reactionStateInFlight.set(cacheKey, pending);
    return pending;
  }

  function publishEventToRelays(event) {
    return new Promise(function (resolve) {
      const payload = JSON.stringify(['EVENT', event]);
      const sockets = [];
      let finishedCount = 0;
      let openCount = 0;
      let okCount = 0;
      let explicitFailureCount = 0;
      let settled = false;
      let timeoutId = null;

      function finishSocket(ws) {
        if (ws.__nostrCompetencyDone) {
          return;
        }

        ws.__nostrCompetencyDone = true;
        finishedCount += 1;

        if (finishedCount >= DEFAULT_RELAYS.length) {
          settle();
        }
      }

      function settle() {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);

        for (const ws of sockets) {
          try {
            ws.close();
          } catch (_error) {
            // ignore close errors
          }
        }

        resolve({
          ok: okCount > 0 || (openCount > 0 && explicitFailureCount < openCount),
          openCount: openCount,
          okCount: okCount,
          explicitFailureCount: explicitFailureCount
        });
      }

      timeoutId = window.setTimeout(settle, RELAY_PUBLISH_TIMEOUT_MS);

      DEFAULT_RELAYS.forEach(function (relayUrl) {
        let ws;

        try {
          ws = new WebSocket(relayUrl);
          sockets.push(ws);
        } catch (_error) {
          explicitFailureCount += 1;
          finishedCount += 1;
          return;
        }

        ws.addEventListener('open', function () {
          openCount += 1;

          try {
            ws.send(payload);
          } catch (_error) {
            explicitFailureCount += 1;
            finishSocket(ws);
          }
        });

        ws.addEventListener('message', function (messageEvent) {
          let data;

          try {
            data = JSON.parse(messageEvent.data);
          } catch (_error) {
            return;
          }

          if (!Array.isArray(data) || data[0] !== 'OK' || data[1] !== event.id) {
            return;
          }

          if (data[2] === true) {
            okCount += 1;
          } else {
            explicitFailureCount += 1;
          }

          finishSocket(ws);
        });

        ws.addEventListener('error', function () {
          explicitFailureCount += 1;
          finishSocket(ws);
        });

        ws.addEventListener('close', function () {
          finishSocket(ws);
        });
      });

      if (DEFAULT_RELAYS.length === 0) {
        settle();
        return;
      }

      if (finishedCount >= DEFAULT_RELAYS.length) {
        settle();
      }
    });
  }

  async function initializeReactionState(button, state, options) {
    if (state.initialized) {
      return;
    }

    if (state.initPromise) {
      return state.initPromise;
    }

    state.initPromise = (async function () {
      const silent = !!(options && options.silent);
      let pubkey = silent ? getStoredKnownPubkey() : null;

      if (!pubkey) {
        pubkey = await getCurrentUserPubkey();
      }

      state.pubkey = pubkey;
      const storedReactionState = getStoredReactionState(state.canonicalUrl, pubkey);

      if (storedReactionState !== null) {
        state.liked = storedReactionState;
        renderButtonState(button, state);
      }

      state.liked = await resolveLikedState(state.canonicalUrl, pubkey);
      state.initialized = true;
      renderButtonState(button, state);
    })()
      .catch(function (error) {
        state.initPromise = null;

        if (!options || !options.silent) {
          throw error;
        }
      })
      .finally(function () {
        state.initPromise = null;
      });

    return state.initPromise;
  }

  async function handleReactionClick(button, state, tweetInfo) {
    if (state.busy) {
      return;
    }

    state.busy = true;
    renderButtonState(button, state);

    try {
      await initializeReactionState(button, state, { silent: false });

      const nextContent = state.liked ? '-' : '+';
      const unsignedEvent = createReactionEvent(tweetInfo.canonicalUrl, nextContent);
      const response = await sendBridgeRequest('SIGN_EVENT', { event: unsignedEvent });
      const signedEvent = response.signedEvent;
      const publishResult = await publishEventToRelays(signedEvent);

      if (!publishResult.ok) {
        throw new Error('Unable to publish reaction to relays');
      }

      state.liked = nextContent !== '-';
      state.initialized = true;
      if (state.pubkey) {
        reactionStateCache.set(
          getReactionCacheKey(state.canonicalUrl, state.pubkey),
          state.liked
        );
        storeReactionState(state.canonicalUrl, state.pubkey, state.liked);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Nostr error';
      window.alert(
        'Nostr Like could not complete.\n\n' +
          message +
          '\n\nMake sure a NIP-07 extension such as Alby or nos2x is installed and unlocked.'
      );
    } finally {
      state.busy = false;
      renderButtonState(button, state);
    }
  }

  const observer = new MutationObserver(function () {
    scheduleInjection();
  });

  function startObserver() {
    if (!document.body) {
      window.requestAnimationFrame(startObserver);
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleInjection();
  }

  startObserver();
  window.addEventListener('load', scheduleInjection);
  window.addEventListener('popstate', scheduleInjection);
})();
