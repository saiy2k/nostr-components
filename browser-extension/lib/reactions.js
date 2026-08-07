// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const eventsByUrl = new Map();
  const eventsInFlight = new Map();

  /** Create an unsigned NIP-25 external-content reaction. */
  function createReactionEvent(url, content) {
    if (content !== "+" && content !== "-") {
      throw new Error("Reaction content must be + or -");
    }
    return {
      kind: 17,
      content: content,
      tags: [
        ["k", "web"],
        ["i", extension.url.normalizeURL(url)],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /** Select each author's latest reaction for count and liked-state derivation. */
  function latestEventsByAuthor(events) {
    const latest = new Map();
    for (const event of events || []) {
      if (!event || !event.pubkey) {
        continue;
      }
      const current = latest.get(event.pubkey);
      const eventCreatedAt = Number(event.created_at || 0);
      const currentCreatedAt = Number((current && current.created_at) || 0);
      if (
        !current ||
        eventCreatedAt > currentCreatedAt ||
        (eventCreatedAt === currentCreatedAt &&
          String(event.id) > String(current.id))
      ) {
        latest.set(event.pubkey, event);
      }
    }
    return latest;
  }

  /** Summarize the current like count and one account's liked state. */
  function summarize(events, pubkey) {
    const latest = latestEventsByAuthor(events);
    let likeCount = 0;
    for (const event of latest.values()) {
      if (event.content !== "-") {
        likeCount += 1;
      }
    }
    const currentUserEvent = pubkey ? latest.get(pubkey) : null;
    return {
      likeCount: likeCount,
      isLiked: !!currentUserEvent && currentUserEvent.content !== "-",
    };
  }

  /** Query and cache reactions for a normalized URL over the shared relay pool. */
  async function fetchEvents(url, options) {
    const normalizedUrl = extension.url.normalizeURL(url);
    const force = !!(options && options.force);
    if (!force && eventsByUrl.has(normalizedUrl)) {
      return eventsByUrl.get(normalizedUrl);
    }
    if (eventsInFlight.has(normalizedUrl)) {
      return eventsInFlight.get(normalizedUrl);
    }

    const pending = extension.relayPool
      .query({
        kinds: [17],
        "#k": ["web"],
        "#i": [normalizedUrl],
        limit: 1000,
      })
      .then(function (events) {
        eventsByUrl.set(normalizedUrl, events);
        eventsInFlight.delete(normalizedUrl);
        return events;
      })
      .catch(function (error) {
        eventsInFlight.delete(normalizedUrl);
        throw error;
      });

    eventsInFlight.set(normalizedUrl, pending);
    return pending;
  }

  /** Merge an acknowledged local publish into the cached reaction set. */
  function applyPublishedEvent(url, event) {
    const normalizedUrl = extension.url.normalizeURL(url);
    const events = eventsByUrl.get(normalizedUrl) || [];
    eventsByUrl.set(normalizedUrl, [
      event,
      ...events.filter((item) => item.id !== event.id),
    ]);
  }

  extension.reactions = {
    createReactionEvent: createReactionEvent,
    summarize: summarize,
    fetchEvents: fetchEvents,
    applyPublishedEvent: applyPublishedEvent,
  };
})();
