// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};

  function createChannel() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sendInjectionRequest(channel) {
    const message = {
      type: 'INJECT_NOSTR_COMPONENTS',
      channel: channel
    };

    let response;
    if (typeof browser !== 'undefined' && browser.runtime) {
      response = await browser.runtime.sendMessage(message);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      response = await new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage(message, function (value) {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(value);
        });
      });
    } else {
      throw new Error('Browser runtime API is not available');
    }

    if (!response || response.ok !== true) {
      throw new Error((response && response.error) || 'Nostr component injection failed');
    }
  }

  const channel = createChannel();
  extension.relayClient.configure(channel);
  extension.componentLoader = {
    channel: channel,
    ready: sendInjectionRequest(channel)
  };
})();
