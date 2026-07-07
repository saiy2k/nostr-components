// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import NDK from "@nostr-dev-kit/ndk";
import { validateEvent, verifyEvent } from "nostr-tools";
import { DEFAULT_COLLECTIONS, stripUndefined } from "./runtime.js";
import { backfillStateId, firestoreSafeId } from "./utils.js";

export function createNdkRelayClient(url) {
  const ndk = new NDK({ explicitRelayUrls: [url] });
  return {
    connect: (timeoutMs) => ndk.connect(timeoutMs),
    subscribe(filter, { max, onEvent, onEose, onClosed }) {
      const subscription = ndk.subscribe(
        { ...filter, limit: max },
        {
          closeOnEose: false,
          dontSaveToCache: true,
          groupable: false,
          relayUrls: [url],
        },
        false,
      );
      subscription.on("event", (event) => onEvent(event.rawEvent()));
      subscription.on("eose", onEose);
      subscription.on("closed", (_relay, reason) => onClosed(reason));
      subscription.start();
      return () => subscription.stop();
    },
    close() {
      for (const relayUrl of [...ndk.pool.relays.keys()]) {
        ndk.pool.removeRelay(relayUrl);
      }
    },
  };
}

export function queryRelay(
  url,
  filter,
  { timeoutMs, max },
  clientFactory = createNdkRelayClient,
) {
  return new Promise((resolve) => {
    const events = [];
    const client = clientFactory(url);
    let stopSubscription = null;
    let done = false;

    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stopSubscription?.();
      client.close?.();
      resolve({ relay: url, events, reason });
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    Promise.resolve(client.connect(timeoutMs))
      .then(() => {
        if (done) return;
        stopSubscription = client.subscribe(filter, {
          max,
          onEvent(event) {
            if (done || !event?.id) return;
            events.push(event);
            if (events.length >= max) finish("max");
          },
          onEose: () => finish("eose"),
          onClosed: (reason) => finish(`closed:${reason || ""}`),
        });
      })
      .catch((error) => finish(`connection-error:${error.message}`));
  });
}

export function isValidSignedEvent(event) {
  try {
    return validateEvent(event) && verifyEvent(event);
  } catch {
    return false;
  }
}

export function buildBackfillCheckpointWrite(
  {
    relay,
    kind,
    cursorUntil,
    oldestSeenAt,
    pageEvents = 0,
    validPageEvents = 0,
    pagesProcessed = 0,
    lastReason,
    completed,
    status,
    pageLimit,
    boundaryTimestamp,
    boundarySeenIds,
    stuckCount,
  },
  options = {},
) {
  return {
    collection: options.firestoreStateCollection || DEFAULT_COLLECTIONS.state,
    id: backfillStateId(relay, kind, options.backfillStatePrefix),
    data: stripUndefined({
      relay,
      kind,
      mode: "backfill",
      statePrefix: options.backfillStatePrefix || "backfill",
      cursorUntil,
      oldestSeenAt,
      pageLimit,
      boundaryTimestamp,
      boundarySeenIds,
      stuckCount,
      pagesProcessed: FieldValue.increment(pagesProcessed),
      relayEventsSeen: FieldValue.increment(pageEvents),
      validEventsSeen: FieldValue.increment(validPageEvents),
      completed,
      status: status || (completed ? "complete" : "running"),
      lastReason,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

export function buildBackfillGapWrite(
  { relay, kind, timestamp, reason, pageLimit, seenEventIds },
  options = {},
) {
  return {
    collection: options.firestoreGapsCollection || DEFAULT_COLLECTIONS.gaps,
    id: firestoreSafeId(`${relay}:kind:${kind}:timestamp:${timestamp}`),
    data: stripUndefined({
      relay,
      kind,
      timestamp,
      reason,
      pageLimit,
      seenEventIds,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}
