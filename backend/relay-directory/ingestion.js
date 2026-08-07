// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import NDK from "@nostr-dev-kit/ndk";
import { validateEvent, verifyEvent } from "nostr-tools";
import {
  DEFAULT_COLLECTIONS,
  serializeFirestoreDataForJson,
  stripUndefined,
} from "./runtime.js";
import { backfillStateId, firestoreSafeId } from "./utils.js";

/** Leave headroom under Firestore's 1 MiB document limit for metadata fields. */
export const MAX_DEAD_LETTER_PAYLOAD_BYTES = 700_000;

export function createNdkRelayClient(url) {
  const ndk = new NDK({ explicitRelayUrls: [url] });
  return {
    connect: (timeoutMs) => ndk.connect(timeoutMs),
    subscribe(filter, { max, onEvent, onEose, onClosed }) {
      const subscription = ndk.subscribe(
        Number.isFinite(max) ? { ...filter, limit: max } : filter,
        {
          closeOnEose: false,
          dontSaveToCache: true,
          groupable: false,
          relayUrls: [url],
        },
      );
      subscription.on("event", (event) => onEvent(event.rawEvent()));
      subscription.on("eose", () => onEose?.());
      subscription.on("closed", (_relay, reason) => onClosed?.(reason));
      return () => subscription.stop();
    },
    close() {
      for (const relay of [...ndk.pool.relays.values()]) {
        try {
          relay.disconnect();
        } catch {}
      }
      for (const relayUrl of [...ndk.pool.relays.keys()]) {
        try {
          ndk.pool.removeRelay(relayUrl);
        } catch {}
      }
    },
  };
}

export function queryRelay(
  url,
  filter,
  { timeoutMs, max, client: existingClient },
  clientFactory = createNdkRelayClient,
) {
  return new Promise((resolve) => {
    const events = [];
    const client = existingClient || clientFactory(url);
    const ownsClient = !existingClient;
    let stopSubscription = null;
    let done = false;

    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        stopSubscription?.();
      } catch {}
      if (ownsClient) {
        try {
          client.close?.();
        } catch {}
      }
      resolve({ relay: url, events, reason });
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    Promise.resolve(ownsClient ? client.connect(timeoutMs) : undefined)
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

/**
 * Dead-letter a failed handle write. payloadJson is stringified so nested
 * arrays / other Firestore-illegal shapes cannot break the failure doc itself.
 * Document IDs are deterministic so cursor retries upsert the same failure doc.
 */
export function buildHandleWriteFailureWrite(
  { write, error, relay, kind, cursorUntil, failedAt = new Date().toISOString() },
  options = {},
) {
  const claims = Array.isArray(write?.data?.claims) ? write.data.claims : [];
  const claimIds = claims.map((claim) => claim?.claimId).filter(Boolean);
  const sourceEventIds = [
    ...new Set(
      claims
        .map((claim) => claim?.sourceEventId || claim?.claimId)
        .filter(Boolean),
    ),
  ];
  const payload = buildSizeSafeDeadLetterPayload(write?.data || {});
  return {
    collection:
      options.firestoreHandleWriteFailuresCollection ||
      DEFAULT_COLLECTIONS.handleWriteFailures,
    id: handleWriteFailureId({
      targetDocumentId: write?.id,
      relay,
      kind,
      cursorUntil,
      claimIds,
    }),
    data: stripUndefined({
      status: "pending_review",
      handle: write?.handle || write?.data?.handle || null,
      targetCollection: write?.collection || null,
      targetDocumentId: write?.id || null,
      relay,
      kind,
      cursorUntil,
      claimIds,
      sourceEventIds,
      errorMessage: String(error?.message || error || "unknown"),
      errorCode: error?.code || null,
      payloadJson: payload.payloadJson,
      payloadByteLength: payload.payloadByteLength,
      payloadTruncated: payload.payloadTruncated,
      payloadSha256: payload.payloadSha256,
      failedAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

export function handleWriteFailureId({
  targetDocumentId,
  relay,
  kind,
  cursorUntil,
  claimIds = [],
}) {
  const claimKey = claimIds.length
    ? createHash("sha256")
        .update([...claimIds].map(String).sort().join(","))
        .digest("hex")
        .slice(0, 16)
    : "none";
  return firestoreSafeId(
    `${targetDocumentId || "unknown"}:${relay || ""}:kind:${kind ?? ""}:until:${cursorUntil ?? ""}:claims:${claimKey}`,
  );
}

export function buildSizeSafeDeadLetterPayload(
  data,
  maxBytes = MAX_DEAD_LETTER_PAYLOAD_BYTES,
) {
  const serialized = serializeFirestoreDataForJson(data || {});
  const fullJson = JSON.stringify(serialized);
  const fullLength = Buffer.byteLength(fullJson, "utf8");
  if (fullLength <= maxBytes) {
    return {
      payloadJson: fullJson,
      payloadByteLength: fullLength,
      payloadTruncated: false,
      payloadSha256: null,
    };
  }

  const payloadSha256 = createHash("sha256").update(fullJson).digest("hex");
  const claims = Array.isArray(serialized.claims) ? serialized.claims : [];
  const summary = {
    truncated: true,
    handle: serialized.handle ?? null,
    platform: serialized.platform ?? null,
    pendingClaimCount: serialized.pendingClaimCount ?? null,
    projectionStatus: serialized.projectionStatus ?? null,
    claimCount: claims.length,
    claimIds: claims
      .map((claim) => claim?.claimId)
      .filter(Boolean)
      .slice(0, 50),
    originalByteLength: fullLength,
    payloadSha256,
  };
  const payloadJson = JSON.stringify(summary);
  return {
    payloadJson,
    payloadByteLength: fullLength,
    payloadTruncated: true,
    payloadSha256,
  };
}
