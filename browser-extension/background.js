// SPDX-License-Identifier: MIT

if (typeof importScripts === 'function') {
  importScripts('lib/zap-http.js');
}

const DIRECTORY_LOOKUP_ENDPOINT =
  'https://us-central1-nostr-components.cloudfunctions.net/lookupDirectoryHandle';
const LOOKUP_TIMEOUT_MS = 5000;
const ZAP_HTTP_TIMEOUT_MS = 10000;
const ZAP_HTTP_MAX_BYTES = 64 * 1024;

function normalizeHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

async function lookupDirectoryHandle(message) {
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
    operation = lookupDirectoryHandle(message);
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
