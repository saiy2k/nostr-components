// SPDX-License-Identifier: MIT

const DIRECTORY_LOOKUP_ENDPOINT =
  "https://us-central1-gr-prod.cloudfunctions.net/lookupDirectoryHandle";
const LOOKUP_TIMEOUT_MS = 5000;
const RELAY_CHANNEL_PATTERN = /^[0-9a-f]{64}$/;

/** Resolve the exact X frame allowed to receive the Like component. */
function getXExecutionTarget(sender) {
  if (
    !sender ||
    !sender.tab ||
    !Number.isInteger(sender.tab.id) ||
    !chrome.scripting ||
    typeof chrome.scripting.executeScript !== "function"
  ) {
    throw new Error("Like component injection is unavailable");
  }

  if (typeof sender.url !== "string" || !Number.isInteger(sender.frameId)) {
    throw new Error(
      "Like component injection requires a validated sender frame",
    );
  }

  const senderUrl = new URL(sender.url);
  if (
    senderUrl.protocol !== "https:" ||
    senderUrl.port !== "" ||
    (senderUrl.hostname !== "x.com" && senderUrl.hostname !== "twitter.com")
  ) {
    throw new Error("Like component injection is restricted to X/Twitter");
  }

  return { tabId: sender.tab.id, frameIds: [sender.frameId] };
}

/** Install the request half of the relay bridge in MAIN world. Self-contained. */
function installRelayTransport(channel) {
  const requestSource = "nostr-components-relay-main";
  const responseSource = "nostr-components-relay-extension";
  const transportKey = "__nostrComponentsRelayTransport";
  const existing = globalThis[transportKey];
  if (existing && existing.__channel === channel) return;
  if (existing && typeof existing.__dispose === "function") {
    existing.__dispose();
  }

  const pending = new Map();

  /** Create an unpredictable identifier for one page-to-extension request. */
  function createRequestId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  /** Resolve only authenticated responses that belong to this bridge channel. */
  function onMessage(event) {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      !message ||
      message.source !== responseSource ||
      message.channel !== channel ||
      !pending.has(message.requestId)
    ) {
      return;
    }

    const request = pending.get(message.requestId);
    pending.delete(message.requestId);
    clearTimeout(request.timeoutId);
    if (message.ok === true) {
      request.resolve(message.result);
    } else {
      request.reject(new Error(message.error || "Relay request failed"));
    }
  }

  /** Send a bounded relay request from MAIN world to the isolated client. */
  function request(operation, payload) {
    return new Promise(function (resolve, reject) {
      const requestId = createRequestId();
      const timeoutId = setTimeout(
        function () {
          pending.delete(requestId);
          reject(new Error("Relay request timed out"));
        },
        operation === "publish" ? 12000 : 4000,
      );
      pending.set(requestId, {
        resolve: resolve,
        reject: reject,
        timeoutId: timeoutId,
      });
      window.postMessage(
        {
          source: requestSource,
          channel: channel,
          requestId: requestId,
          operation: operation,
          payload: payload,
        },
        window.location.origin,
      );
    });
  }

  window.addEventListener("message", onMessage);
  globalThis[transportKey] = Object.freeze({
    __channel: channel,
    query: function (relays, filter) {
      return request("query", { relays: relays, filter: filter });
    },
    getLikeState: function (relays, url) {
      return request("getLikeState", { relays: relays, url: url });
    },
    publish: function (relays, event) {
      return request("publish", { relays: relays, event: event });
    },
    __dispose: function () {
      window.removeEventListener("message", onMessage);
      for (const request of pending.values()) {
        clearTimeout(request.timeoutId);
        request.reject(new Error("Relay transport was replaced"));
      }
      pending.clear();
    },
  });
}

/** Install the transport first, then register the real component in MAIN. */
async function injectLikeComponent(message, sender) {
  if (!RELAY_CHANNEL_PATTERN.test(String(message.channel || ""))) {
    throw new Error("Invalid relay bridge channel");
  }

  const target = getXExecutionTarget(sender);
  await chrome.scripting.executeScript({
    target: target,
    func: installRelayTransport,
    args: [message.channel],
    world: "MAIN",
  });
  await chrome.scripting.executeScript({
    target: target,
    files: ["lib/nostr-like-button.js"],
    world: "MAIN",
  });
  return true;
}

/** Normalize and validate a public X handle before it reaches the backend. */
function normalizeHandle(value) {
  const handle = String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

/** Query the read-only Firestore directory function with a bounded timeout. */
async function lookupDirectoryHandle(message) {
  const handle = normalizeHandle(message.handle);
  if (!handle) {
    throw new Error("Invalid X handle");
  }

  const url = new URL(DIRECTORY_LOOKUP_ENDPOINT);
  url.searchParams.set("platform", "twitter");
  url.searchParams.set("handle", handle);

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const result = await response.json();
    if (response.status === 404 && result && result.found === false) {
      return result;
    }
    if (!response.ok) {
      throw new Error("Directory lookup failed with status " + response.status);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message) {
    return false;
  }

  let operation;
  if (message.type === "LOOKUP_DIRECTORY_HANDLE") {
    operation = lookupDirectoryHandle(message);
  } else if (message.type === "INJECT_NOSTR_LIKE_COMPONENT") {
    operation = injectLikeComponent(message, sender);
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
        error:
          error instanceof Error ? error.message : "Extension request failed",
      });
    },
  );

  return true;
});
