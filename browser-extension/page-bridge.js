// SPDX-License-Identifier: MIT

(function () {
  const REQUEST_SOURCE = "nostr-competency-extension";
  const RESPONSE_SOURCE = "nostr-competency-bridge";

  /** Send a signer response only to the current X/Twitter origin. */
  function postBridgeResponse(message) {
    window.postMessage(message, window.location.origin);
  }

  /** Accept only the kind-17 X status reactions supported by this extension. */
  function isAllowedReactionEvent(event) {
    if (
      !event ||
      event.kind !== 17 ||
      (event.content !== "+" && event.content !== "-") ||
      !Number.isInteger(event.created_at) ||
      !Array.isArray(event.tags)
    ) {
      return false;
    }

    const kindTag = event.tags.find(function (tag) {
      return Array.isArray(tag) && tag[0] === "k";
    });
    const identifierTag = event.tags.find(function (tag) {
      return Array.isArray(tag) && tag[0] === "i";
    });

    if (
      !kindTag ||
      kindTag[1] !== "web" ||
      !identifierTag ||
      !identifierTag[1]
    ) {
      return false;
    }

    try {
      const target = new URL(identifierTag[1]);
      return (
        (target.hostname === "x.com" || target.hostname === "twitter.com") &&
        /^\/[^/]+\/status\/\d+$/.test(target.pathname)
      );
    } catch (_error) {
      return false;
    }
  }

  /** Resolve the NIP-07 provider injected into the page's main world. */
  async function getNostrProvider() {
    const nostr = window.nostr;

    if (!nostr) {
      throw new Error("No NIP-07 signer found on window.nostr");
    }

    return nostr;
  }

  window.addEventListener("message", async function (event) {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (
      !data ||
      data.source !== REQUEST_SOURCE ||
      !data.type ||
      !data.requestId
    ) {
      return;
    }

    try {
      const nostr = await getNostrProvider();

      if (data.type === "GET_PUBLIC_KEY") {
        if (typeof nostr.getPublicKey !== "function") {
          throw new Error("The signer does not support getPublicKey()");
        }

        const pubkey = await nostr.getPublicKey();

        postBridgeResponse({
          source: RESPONSE_SOURCE,
          requestId: data.requestId,
          ok: true,
          pubkey: pubkey,
        });

        return;
      }

      if (data.type === "SIGN_EVENT") {
        if (typeof nostr.signEvent !== "function") {
          throw new Error("The signer does not support signEvent()");
        }

        if (!isAllowedReactionEvent(data.payload && data.payload.event)) {
          throw new Error(
            "Only Nostr reactions for X status URLs may be signed",
          );
        }

        const signedEvent = await nostr.signEvent(data.payload.event);

        postBridgeResponse({
          source: RESPONSE_SOURCE,
          requestId: data.requestId,
          ok: true,
          signedEvent: signedEvent,
        });

        return;
      }

      throw new Error("Unsupported bridge request: " + data.type);
    } catch (error) {
      postBridgeResponse({
        source: RESPONSE_SOURCE,
        requestId: data.requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown bridge error",
      });
    }
  });
})();
