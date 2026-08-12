// SPDX-License-Identifier: MIT

import { SimplePool, verifyEvent } from "nostr-tools";
import { normalizeURL } from "nostr-tools/utils";

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const REQUEST_SOURCE = "nostr-components-relay-main";
  const RESPONSE_SOURCE = "nostr-components-relay-extension";
  const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
  const REQUEST_ID_PATTERN = /^[0-9a-f]{32}$/;
  const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
  const HEX_128_PATTERN = /^[0-9a-f]{128}$/i;
  const ALLOWED_RELAY_URLS = new Set(
    [
      "wss://relay.damus.io",
      "wss://nostr.wine",
      "wss://relay.nostr.net",
      "wss://relay.nostr.band",
      "wss://nos.lol",
      "wss://nostr-pub.wellorder.net",
      "wss://relay.getalby.com",
      "wss://relay.primal.net",
    ].map(normalizeURL),
  );

  let activeSession = null;

  function isAllowedStatusUrl(value) {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "x.com" || url.hostname === "twitter.com") &&
        /^\/[^/]+\/status\/\d+\/?$/.test(url.pathname) &&
        url.port === "" &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === ""
      );
    } catch (_error) {
      return false;
    }
  }

  function validateRelays(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
      return null;
    }

    const normalized = [];
    for (const relay of value) {
      if (typeof relay !== "string") return null;
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
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const allowedKeys = new Set(["kinds", "#k", "#i", "authors", "limit"]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
      return null;
    }
    if (
      !Array.isArray(value.kinds) ||
      value.kinds.length !== 1 ||
      value.kinds[0] !== 17 ||
      !Array.isArray(value["#k"]) ||
      value["#k"].length !== 1 ||
      value["#k"][0] !== "web" ||
      !Array.isArray(value["#i"]) ||
      value["#i"].length !== 1 ||
      !isAllowedStatusUrl(value["#i"][0]) ||
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
      "#k": ["web"],
      "#i": [value["#i"][0]],
      ...(value.authors ? { authors: [value.authors[0].toLowerCase()] } : {}),
      limit: value.limit,
    };
  }

  function validateReactionEvent(event) {
    if (
      !event ||
      typeof event !== "object" ||
      event.kind !== 17 ||
      (event.content !== "+" && event.content !== "-") ||
      !Number.isInteger(event.created_at) ||
      event.created_at <= 0 ||
      !HEX_64_PATTERN.test(String(event.id || "")) ||
      !HEX_64_PATTERN.test(String(event.pubkey || "")) ||
      !HEX_128_PATTERN.test(String(event.sig || "")) ||
      !Array.isArray(event.tags) ||
      event.tags.length !== 2
    ) {
      return null;
    }

    const kindTags = event.tags.filter(
      (tag) => Array.isArray(tag) && tag.length === 2 && tag[0] === "k",
    );
    const identifierTags = event.tags.filter(
      (tag) => Array.isArray(tag) && tag.length === 2 && tag[0] === "i",
    );
    if (
      kindTags.length !== 1 ||
      kindTags[0][1] !== "web" ||
      identifierTags.length !== 1 ||
      !isAllowedStatusUrl(identifierTags[0][1]) ||
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
        url.protocol === "https:" &&
        url.port === "" &&
        (url.hostname === "x.com" || url.hostname === "twitter.com")
      );
    } catch (_error) {
      return false;
    }
  }

  async function handleRequest(pool, message) {
    const payload = message.payload;
    if (message.operation === "getKnownPublicKey") {
      if (!payload || Object.keys(payload).length !== 0) {
        throw new Error("Known-public-key request contains unexpected data");
      }
      return extension.storage.getKnownPubkey();
    }

    const relays = validateRelays(payload && payload.relays);
    if (!relays) {
      throw new Error("Relay request contains an unsupported relay list");
    }

    if (message.operation === "query") {
      const filter = validateFilter(payload.filter);
      if (!filter) {
        throw new Error("Relay request contains an unsupported filter");
      }
      return pool.querySync(relays, filter, { maxWait: 8000 });
    }

    if (message.operation === "publish") {
      const event = validateReactionEvent(payload.event);
      if (!event) {
        throw new Error("Relay request contains an invalid reaction event");
      }
      const publishes = pool.publish(relays, event);
      if (!Array.isArray(publishes) || publishes.length === 0) {
        throw new Error("No relay accepted the reaction event");
      }
      try {
        await Promise.any(publishes);
      } catch (_error) {
        throw new Error("No relay acknowledged the reaction event");
      }
      await extension.storage.setKnownPubkey(event.pubkey);
      return null;
    }

    throw new Error("Unsupported relay operation");
  }

  /** Install one authenticated page-message listener in the isolated world. */
  function configure(channel, options) {
    if (!CHANNEL_PATTERN.test(String(channel || ""))) {
      throw new Error("Invalid relay bridge channel");
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
        !REQUEST_ID_PATTERN.test(String(message.requestId || ""))
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
            result: result,
          },
          event.origin,
        );
      } catch (error) {
        pageWindow.postMessage(
          {
            source: RESPONSE_SOURCE,
            channel: channel,
            requestId: message.requestId,
            ok: false,
            error:
              error instanceof Error ? error.message : "Relay request failed",
          },
          event.origin,
        );
      }
    }

    pageWindow.addEventListener("message", onMessage);
    activeSession = {
      channel: channel,
      dispose: function () {
        pageWindow.removeEventListener("message", onMessage);
        if (typeof pool.destroy === "function") pool.destroy();
        if (activeSession && activeSession.channel === channel) {
          activeSession = null;
        }
      },
    };
    return activeSession;
  }

  extension.relayClient = {
    configure: configure,
    isAllowedStatusUrl: isAllowedStatusUrl,
    validateFilter: validateFilter,
    validateReactionEvent: validateReactionEvent,
    validateRelays: validateRelays,
  };
})();
