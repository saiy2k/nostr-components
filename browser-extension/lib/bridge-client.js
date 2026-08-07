// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const REQUEST_SOURCE = "nostr-competency-extension";
  const RESPONSE_SOURCE = "nostr-competency-bridge";
  const REQUEST_TIMEOUT_MS = 5000;
  const pendingRequests = new Map();
  let bridgePromise = null;
  let pubkeyRequest = null;

  /** Resolve the extension runtime needed to inject the page bridge. */
  function getRuntime() {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return chrome.runtime;
    }
    if (typeof browser !== "undefined" && browser.runtime) {
      return browser.runtime;
    }
    return null;
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== RESPONSE_SOURCE || !data.requestId) {
      return;
    }

    const pending = pendingRequests.get(data.requestId);
    if (!pending) {
      return;
    }

    pendingRequests.delete(data.requestId);
    window.clearTimeout(pending.timeoutId);
    if (data.ok) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(data.error || "Bridge request failed"));
    }
  });

  /** Inject the NIP-07 bridge once into the page's main execution world. */
  function ensureBridgeInjected() {
    if (bridgePromise) {
      return bridgePromise;
    }

    bridgePromise = new Promise(function (resolve, reject) {
      const runtime = getRuntime();
      if (!runtime) {
        reject(new Error("Browser runtime API is not available"));
        return;
      }

      const script = document.createElement("script");
      script.src = runtime.getURL("page-bridge.js");
      script.onload = function () {
        script.remove();
        resolve();
      };
      script.onerror = function () {
        script.remove();
        bridgePromise = null;
        reject(new Error("Failed to load the page bridge"));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return bridgePromise;
  }

  /** Send a correlated, timeout-bounded request to the page bridge. */
  async function sendRequest(type, payload) {
    await ensureBridgeInjected();
    const randomPart = crypto.getRandomValues(new Uint32Array(2)).join("-");
    const requestId = "nostr-competency-" + randomPart;

    return new Promise(function (resolve, reject) {
      const timeoutId = window.setTimeout(function () {
        pendingRequests.delete(requestId);
        reject(new Error("Timed out waiting for page signer"));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(requestId, {
        resolve: resolve,
        reject: reject,
        timeoutId: timeoutId,
      });

      window.postMessage(
        {
          source: REQUEST_SOURCE,
          type: type,
          requestId: requestId,
          payload: payload || {},
        },
        window.location.origin,
      );
    });
  }

  /** Read and validate the active NIP-07 account without persistent promise caching. */
  function getCurrentUserPubkey() {
    if (pubkeyRequest) {
      return pubkeyRequest;
    }

    pubkeyRequest = sendRequest("GET_PUBLIC_KEY")
      .then(function (response) {
        const pubkey = String(response.pubkey || "").toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(pubkey)) {
          throw new Error("The NIP-07 signer returned an invalid public key");
        }
        return pubkey;
      })
      .finally(function () {
        pubkeyRequest = null;
      });

    return pubkeyRequest;
  }

  extension.bridge = {
    sendRequest: sendRequest,
    getCurrentUserPubkey: getCurrentUserPubkey,
  };
})();
