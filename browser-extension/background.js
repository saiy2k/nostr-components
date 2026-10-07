// SPDX-License-Identifier: MIT

if (typeof importScripts === 'function') {
  importScripts('lib/zap-http.js');
}

const DIRECTORY_API_ORIGIN =
  'https://us-central1-nostr-components.cloudfunctions.net';
const DIRECTORY_LOOKUP_ENDPOINT = DIRECTORY_API_ORIGIN + '/lookupAtlasHandle';
const LOOKUP_TIMEOUT_MS = 5000;
const ACTIVITY_TIMEOUT_MS = 5000;
const PROFILE_TIMEOUT_MS = 8000;
const INGEST_TIMEOUT_MS = 15000;
const ZAP_HTTP_TIMEOUT_MS = 10000;
const ZAP_HTTP_MAX_BYTES = 64 * 1024;
const HEX_64 = /^[0-9a-f]{64}$/i;
const PROFILE_LIMIT = 50;
const ACTIVITY_ITEM_LIMIT = 20;

function normalizeHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

async function lookupAtlasHandle(message) {
  const handle = normalizeHandle(message.handle);
  if (!handle) {
    throw new Error('Invalid X handle');
  }

  const url = new URL(DIRECTORY_LOOKUP_ENDPOINT);
  url.searchParams.set('platform', 'twitter');
  url.searchParams.set('handle', handle);

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    const result = await response.json();
    if (response.status === 404 && result && result.found === false) {
      return result;
    }
    if (!response.ok) {
      throw new Error('Directory lookup failed with status ' + response.status);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

function hexList(value, limit) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parts = value.split(',').map(function (part) {
    return part.trim().toLowerCase();
  }).filter(Boolean);
  if (parts.length === 0 || parts.length > limit) return null;
  if (parts.some(function (part) { return !HEX_64.test(part); })) return null;
  return parts;
}

function activityItems(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parts = value.split(',').map(function (part) {
    return part.trim().toLowerCase();
  }).filter(Boolean);
  if (parts.length === 0 || parts.length > ACTIVITY_ITEM_LIMIT) return null;
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon === -1) {
      if (!HEX_64.test(part)) return null;
      continue;
    }
    if (!HEX_64.test(part.slice(0, colon)) || !HEX_64.test(part.slice(colon + 1))) {
      return null;
    }
  }
  return parts;
}

async function fetchDirectoryJson(url, timeoutMs, init) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      method: init && init.method ? init.method : 'GET',
      headers: Object.assign(
        { Accept: 'application/json' },
        init && init.body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: init && init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_error) {
      throw new Error('Directory API returned invalid JSON');
    }
    if (!response.ok) {
      throw new Error('Directory API failed with status ' + response.status);
    }
    return json;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function lookupNostrProfiles(message) {
  const pubkeys = hexList(message.pubkeys, PROFILE_LIMIT);
  if (!pubkeys) throw new Error('Invalid profile lookup');
  const fresh = message.fresh === '1';
  if (fresh && pubkeys.length !== 1) throw new Error('Invalid profile lookup');
  if (message.fresh !== undefined && message.fresh !== '1') {
    throw new Error('Invalid profile lookup');
  }
  const url = new URL(DIRECTORY_API_ORIGIN + '/lookupNostrProfiles');
  url.searchParams.set('pubkeys', pubkeys.join(','));
  if (fresh) url.searchParams.set('fresh', '1');
  return fetchDirectoryJson(url.toString(), PROFILE_TIMEOUT_MS);
}

async function getUrlActivity(message) {
  const items = activityItems(message.items);
  if (!items) throw new Error('Invalid URL activity lookup');
  const url = new URL(DIRECTORY_API_ORIGIN + '/getUrlActivity');
  url.searchParams.set('item', items.join(','));
  return fetchDirectoryJson(url.toString(), ACTIVITY_TIMEOUT_MS);
}

async function listUrlEvents(message) {
  const key = typeof message.key === 'string' ? message.key.trim().toLowerCase() : '';
  if (!HEX_64.test(key)) throw new Error('Invalid URL event list');
  const recipient = message.recipient === undefined || message.recipient === ''
    ? ''
    : String(message.recipient).trim().toLowerCase();
  if (recipient && !HEX_64.test(recipient)) throw new Error('Invalid URL event list');
  const url = new URL(DIRECTORY_API_ORIGIN + '/listUrlEvents');
  url.searchParams.set('key', key);
  if (recipient) url.searchParams.set('recipient', recipient);
  if (message.limit !== undefined && message.limit !== '') {
    if (!/^\d+$/.test(String(message.limit))) throw new Error('Invalid URL event list');
    url.searchParams.set('limit', String(message.limit));
  }
  return fetchDirectoryJson(url.toString(), ACTIVITY_TIMEOUT_MS);
}

async function listViewerReactions(message) {
  const pubkey = typeof message.pubkey === 'string' ? message.pubkey.trim().toLowerCase() : '';
  if (!HEX_64.test(pubkey)) throw new Error('Invalid viewer reaction list');
  const url = new URL(DIRECTORY_API_ORIGIN + '/listViewerReactions');
  url.searchParams.set('pubkey', pubkey);
  return fetchDirectoryJson(url.toString(), ACTIVITY_TIMEOUT_MS);
}

async function ingestUrlEvent(message) {
  const event = message.event;
  const relay = typeof message.relay === 'string' ? message.relay : '';
  if (
    !event ||
    typeof event !== 'object' ||
    (event.kind !== 17 && event.kind !== 9735) ||
    !relay.startsWith('wss://')
  ) {
    throw new Error('Invalid URL event');
  }
  return fetchDirectoryJson(
    DIRECTORY_API_ORIGIN + '/ingestUrlEvent',
    INGEST_TIMEOUT_MS,
    { method: 'POST', body: { event: event, relay: relay } }
  );
}

function isAllowedRequestSender(sender) {
  if (!sender || typeof sender.url !== 'string') return false;
  try {
    const senderUrl = new URL(sender.url);
    return (
      senderUrl.protocol === 'https:' &&
      senderUrl.port === '' &&
      [
        'x.com',
        'twitter.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube.com'
      ].includes(senderUrl.hostname)
    );
  } catch (_error) {
    return false;
  }
}

async function fetchHttpsJson(message, sender) {
  if (!isAllowedRequestSender(sender)) {
    throw new Error('HTTPS fetch is restricted to supported sites');
  }

  const normalized = globalThis.NostrLikeExtension?.zapHttp?.normalizeZapHttpUrl(message.url);
  if (!normalized) {
    throw new Error('HTTPS request contains an unsupported URL');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, ZAP_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    if (text.length > ZAP_HTTP_MAX_BYTES) {
      throw new Error('HTTPS response is too large');
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_error) {
      throw new Error('Invalid JSON from HTTPS endpoint');
    }
    return { status: response.status, json: json };
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message) {
    return false;
  }

  let operation;
  if (message.type === 'LOOKUP_DIRECTORY_HANDLE') {
    operation = lookupAtlasHandle(message);
  } else if (message.type === 'LOOKUP_NOSTR_PROFILES') {
    operation = lookupNostrProfiles(message);
  } else if (message.type === 'GET_URL_ACTIVITY') {
    operation = getUrlActivity(message);
  } else if (message.type === 'LIST_URL_EVENTS') {
    operation = listUrlEvents(message);
  } else if (message.type === 'LIST_VIEWER_REACTIONS') {
    operation = listViewerReactions(message);
  } else if (message.type === 'INGEST_URL_EVENT') {
    operation = ingestUrlEvent(message);
  } else if (message.type === 'FETCH_HTTPS_JSON') {
    operation = fetchHttpsJson(message, sender);
  } else {
    return false;
  }

  operation.then(
    function (result) {
      sendResponse({ ok: true, result: result });
    },
    function (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Extension request failed'
      });
    }
  );

  return true;
});
