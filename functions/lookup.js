// SPDX-License-Identifier: MIT

const RESERVED_X_HANDLES = new Set([
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "search",
  "share",
  "settings",
]);

/** Normalize an X/Twitter handle to the relay-directory key format. */
export function normalizeTwitterHandle(value) {
  const handle = String(value || "")
    .trim()
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0]
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle) || RESERVED_X_HANDLES.has(handle)) {
    return null;
  }
  return handle;
}

/** Build the Firestore document id used by nostrDirectoryHandles. */
export function directoryHandleId(handle) {
  const normalized = normalizeTwitterHandle(handle);
  return normalized ? "twitter:" + normalized : null;
}

/** Return a trimmed, bounded public string or null. */
function boundedString(value, maximumLength) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximumLength) : null;
}

/** Project a Firestore handle document into the endpoint's public response. */
export function publicDirectoryResponse(handle, data) {
  const active = data && data.activeIdentity;
  const verified = !!(
    active &&
    active.status === "verified" &&
    /^[0-9a-f]{64}$/i.test(String(active.pubkey || ""))
  );

  const response = {
    found: true,
    verified: verified,
    platform: "twitter",
    handle: handle,
    projectionStatus: boundedString(data && data.projectionStatus, 40),
    pending: Number((data && data.pendingClaimCount) || 0) > 0,
    activeIdentity: null,
  };

  if (verified) {
    response.activeIdentity = {
      status: "verified",
      pubkey: String(active.pubkey).toLowerCase(),
      npub: boundedString(active.npub, 80),
      proofTweetId: boundedString(active.proofTweetId, 30),
      verifiedAt: boundedString(active.verifiedAt, 50),
      zappable: active.zappable === true,
      lud16: active.zappable === true ? boundedString(active.lud16, 320) : null,
    };
  }

  return response;
}

/** Read and sanitize one handle record from Firestore. */
export async function lookupDirectoryHandle(db, value, options = {}) {
  const handle = normalizeTwitterHandle(value);
  if (!handle) {
    return { status: 400, body: { error: "invalid_handle" } };
  }

  const collection = options.collection || "nostrDirectoryHandles";
  const snapshot = await db
    .collection(collection)
    .doc(directoryHandleId(handle))
    .get();
  if (!snapshot.exists) {
    return {
      status: 404,
      body: {
        found: false,
        verified: false,
        platform: "twitter",
        handle: handle,
        activeIdentity: null,
      },
    };
  }

  return {
    status: 200,
    body: publicDirectoryResponse(handle, snapshot.data() || {}),
  };
}
