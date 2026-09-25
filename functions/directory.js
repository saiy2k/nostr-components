// SPDX-License-Identifier: MIT

import { FieldPath } from "firebase-admin/firestore";
import { nip19 } from "nostr-tools";
import { normalizeTwitterHandle } from "./lookup.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10_000;
const MAX_CURSOR_POSITION = 1_000_000;
const MAX_SEARCH_LENGTH = 255;
const CURSOR_PATTERN = /^twitter:[a-z0-9_]{1,15}$/;
const NIP05_PATTERN = /^[a-z0-9_.+-]+@[a-z0-9.-]+$/i;
const X_PROFILE_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?[a-z0-9_]{1,15})(?:[/?#].*)?$/i;

function boundedString(value, length) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

// Read the current identity from handles, not potentially obsolete entry records.
// Deliberately omit claim evidence, retry state, and payment routing fields.
export function publicDirectoryProfile(id, data) {
  const handle = id.startsWith("twitter:") ? id.slice(8) : "";
  const active = data?.activeIdentity;
  if (
    !CURSOR_PATTERN.test(id) ||
    normalizeTwitterHandle(handle) !== handle ||
    (data?.platform && data.platform !== "twitter") ||
    (data?.handle && data.handle !== handle) ||
    active?.status !== "verified" ||
    typeof active.pubkey !== "string" ||
    !/^[0-9a-f]{64}$/i.test(active.pubkey)
  ) {
    return null;
  }

  return {
    id,
    platform: "twitter",
    handle,
    pubkey: active.pubkey.toLowerCase(),
    verified: true,
    name: boundedString(active.metadata?.name, 100) || handle,
    nip05: boundedString(active.metadata?.nip05, 255),
  };
}

export function directorySearchFilter(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_SEARCH_LENGTH) {
    throw new TypeError("invalid_search");
  }

  const search = value.trim();
  if (!search) return null;

  if (search.toLowerCase().startsWith("npub1")) {
    try {
      const decoded = nip19.decode(search.toLowerCase());
      if (decoded.type === "npub" && /^[0-9a-f]{64}$/.test(decoded.data)) {
        return { field: "activeIdentity.pubkey", value: decoded.data };
      }
    } catch {
      // Invalid public identifiers are safe empty searches, not server errors.
    }
    return { matchesNothing: true };
  }

  if (NIP05_PATTERN.test(search)) {
    return {
      field: "activeIdentity.metadata.nip05",
      value: search,
    };
  }

  const profileMatch = search.match(X_PROFILE_PATTERN);
  const handle = normalizeTwitterHandle(
    profileMatch ? profileMatch[1] : search,
  );
  return handle ? { field: "handle", value: handle } : { matchesNothing: true };
}

function validatedInteger(value, fallback, maximum, error) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9][0-9]*)$/.test(value) ||
    Number(value) > maximum
  ) {
    throw new TypeError(error);
  }
  return Number(value);
}

export async function listDirectoryProfiles(db, parameters = {}, options = {}) {
  const cursor = parameters.cursor;
  if (
    cursor !== undefined &&
    (typeof cursor !== "string" || !CURSOR_PATTERN.test(cursor))
  ) {
    return { status: 400, body: { error: "invalid_cursor" } };
  }

  let pageSize;
  let offset;
  let search;
  try {
    pageSize = validatedInteger(
      parameters.limit,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
      "invalid_limit",
    );
    if (pageSize === 0) throw new TypeError("invalid_limit");
    offset = validatedInteger(
      parameters.offset,
      0,
      cursor === undefined ? MAX_OFFSET : MAX_CURSOR_POSITION,
      "invalid_offset",
    );
    search = directorySearchFilter(parameters.search);
  } catch (error) {
    const code =
      error instanceof TypeError &&
      ["invalid_limit", "invalid_offset", "invalid_search"].includes(
        error.message,
      )
        ? error.message
        : "invalid_search";
    return { status: 400, body: { error: code } };
  }

  if (search?.matchesNothing) {
    return {
      status: 200,
      body: { profiles: [], total: 0, offset, nextCursor: null },
    };
  }

  let query = db
    .collection(options.collection || "nostrDirectoryHandles")
    .where("activeIdentity.status", "==", "verified");
  if (search) query = query.where(search.field, "==", search.value);

  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;
  query = query.orderBy(FieldPath.documentId());
  if (cursor !== undefined) query = query.startAfter(cursor);
  else if (offset > 0) query = query.offset(offset);
  const snapshot = await query
    .select(
      "platform",
      "handle",
      "activeIdentity.status",
      "activeIdentity.pubkey",
      "activeIdentity.metadata.name",
      "activeIdentity.metadata.nip05",
    )
    .limit(pageSize + 1)
    .get();
  const documents = snapshot.docs.slice(0, pageSize);

  return {
    status: 200,
    body: {
      profiles: documents
        .map((doc) => publicDirectoryProfile(doc.id, doc.data()))
        .filter(Boolean),
      total,
      offset,
      nextCursor: snapshot.docs.length > pageSize ? documents.at(-1).id : null,
    },
  };
}

export function createDirectoryListHandler(db, options = {}) {
  return async function handleDirectoryList(request, response) {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.status(405).json({ error: "method_not_allowed" });
      return;
    }
    try {
      const result = await listDirectoryProfiles(db, request.query, options);
      if (result.status === 200) {
        response.set("Cache-Control", "public, max-age=60, s-maxage=60");
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error("Directory listing failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ error: "directory_unavailable" });
    }
  };
}
