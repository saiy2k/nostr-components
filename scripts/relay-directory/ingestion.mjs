// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { validateEvent, verifyEvent } from "nostr-tools";
import {
  DEFAULT_COLLECTIONS,
  firestoreSafeId,
  stripUndefined,
} from "./runtime.mjs";

export function queryRelay(url, filter, { timeoutMs, max }) {
  return new Promise((resolve) => {
    const events = [];
    const subscriptionId = `nc-${Math.random().toString(36).slice(2, 10)}`;
    let done = false;
    let ws;

    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {}
      resolve({ relay: url, events, reason });
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch (error) {
      finish(`constructor-error:${error.message}`);
      return;
    }

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify(["REQ", subscriptionId, { ...filter, limit: max }]),
      );
    });
    ws.addEventListener("message", (messageEvent) => {
      let message;
      try {
        message = JSON.parse(messageEvent.data);
      } catch {
        return;
      }
      if (
        message[0] === "EVENT" &&
        message[1] === subscriptionId &&
        message[2]?.id
      ) {
        events.push(message[2]);
        if (events.length >= max) finish("max");
      } else if (message[0] === "EOSE" && message[1] === subscriptionId) {
        finish("eose");
      } else if (message[0] === "CLOSED" && message[1] === subscriptionId) {
        finish(`closed:${message[2] || ""}`);
      }
    });
    ws.addEventListener("error", () => finish("ws-error"));
    ws.addEventListener("close", () => finish("close"));
  });
}

export function isValidSignedEvent(event) {
  try {
    return validateEvent(event) && verifyEvent(event);
  } catch {
    return false;
  }
}

export function buildBackfillEventWrite(event, relay, options = {}) {
  return buildIngestedEventWrite(event, relay, "backfill", options);
}

export function buildIngestedEventWrite(event, relay, mode, options = {}) {
  return {
    collection: options.firestoreEventsCollection || DEFAULT_COLLECTIONS.events,
    id: firestoreSafeId(event.id),
    data: stripUndefined({
      id: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      sourceRelays: FieldValue.arrayUnion(relay),
      event: normalizeEventForFirestore(event),
      eventJson: JSON.stringify(event),
      ingestion: {
        mode,
        lastRelay: relay,
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

export function buildRawEventIngestionWrites(event, relay, mode, options = {}) {
  return [
    buildIngestedEventWrite(event, relay, mode, options),
    buildProjectionQueueCreateWrite(event, mode, options),
  ];
}

export function buildProjectionQueueCreateWrite(event, mode, options = {}) {
  return {
    operation: "createIfMissing",
    collection: options.firestoreQueueCollection || DEFAULT_COLLECTIONS.queue,
    id: firestoreSafeId(event.id),
    data: stripUndefined({
      eventId: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      eventCreatedAt: event.created_at,
      sourceMode: mode,
      status: "pending",
      reason: "awaiting_projection",
      attempts: 0,
      nextAttemptAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function normalizeEventForFirestore(event) {
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    content: event.content || "",
    tags: (event.tags || []).map((tag) => ({
      values: tag.map((value) => String(value)),
    })),
    sig: event.sig,
  };
}

export function buildBackfillCheckpointWrite(
  {
    relay,
    kind,
    cursorUntil,
    oldestSeenAt,
    pageEvents,
    validPageEvents,
    lastReason,
    completed,
    pageLimit,
    boundaryTimestamp,
    boundarySeenIds,
    stuckCount,
  },
  options = {},
) {
  return {
    collection: options.firestoreStateCollection || DEFAULT_COLLECTIONS.state,
    id: backfillStateId(relay, kind, options.backfillStatePrefix || "backfill"),
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
      pagesProcessed: FieldValue.increment(1),
      relayEventsSeen: FieldValue.increment(pageEvents),
      validEventsSeen: FieldValue.increment(validPageEvents),
      completed,
      status: completed ? "complete" : "running",
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

export function backfillStateId(relay, kind, prefix = "backfill") {
  return firestoreSafeId(`${prefix}:${relay}:kind:${kind}`);
}
