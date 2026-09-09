// SPDX-License-Identifier: MIT

import { FieldPath } from 'firebase-admin/firestore';
import { normalizeTwitterHandle } from './lookup.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const CURSOR_PATTERN = /^twitter:[a-z0-9_]{1,15}$/;

function boundedString(value, length) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

// Read the current identity from handles, not potentially obsolete entry records.
// Deliberately omit claim evidence, retry state, and payment routing fields.
export function publicDirectoryProfile(id, data) {
  const handle = id.startsWith('twitter:') ? id.slice(8) : '';
  const active = data?.activeIdentity;
  if (
    !CURSOR_PATTERN.test(id) ||
    normalizeTwitterHandle(handle) !== handle ||
    (data?.platform && data.platform !== 'twitter') ||
    (data?.handle && data.handle !== handle) ||
    active?.status !== 'verified' ||
    typeof active.pubkey !== 'string' ||
    !/^[0-9a-f]{64}$/i.test(active.pubkey)
  ) {
    return null;
  }

  return {
    id,
    platform: 'twitter',
    handle,
    pubkey: active.pubkey.toLowerCase(),
    verified: true,
    name: boundedString(active.metadata?.name, 100) || handle,
    nip05: boundedString(active.metadata?.nip05, 255)
  };
}

export async function listDirectoryProfiles(db, parameters = {}, options = {}) {
  const rawLimit = parameters.limit;
  if (
    rawLimit !== undefined &&
    (typeof rawLimit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(rawLimit))
  ) {
    return { status: 400, body: { error: 'invalid_limit' } };
  }
  const pageSize =
    rawLimit === undefined ? DEFAULT_PAGE_SIZE : Number(rawLimit);
  if (pageSize > MAX_PAGE_SIZE) {
    return { status: 400, body: { error: 'invalid_limit' } };
  }
  const cursor = parameters.cursor;
  if (
    cursor !== undefined &&
    (typeof cursor !== 'string' || !CURSOR_PATTERN.test(cursor))
  ) {
    return { status: 400, body: { error: 'invalid_cursor' } };
  }

  let query = db
    .collection(options.collection || 'nostrDirectoryHandles')
    .where('activeIdentity.status', '==', 'verified')
    .orderBy(FieldPath.documentId());
  if (cursor !== undefined) query = query.startAfter(cursor);
  const snapshot = await query
    .select(
      'platform',
      'handle',
      'activeIdentity.status',
      'activeIdentity.pubkey',
      'activeIdentity.metadata.name',
      'activeIdentity.metadata.nip05'
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
      // Advance over scanned documents even when a malformed record was skipped.
      nextCursor: snapshot.docs.length > pageSize ? documents.at(-1).id : null
    }
  };
}

export function createDirectoryListHandler(db, options = {}) {
  return async function handleDirectoryList(request, response) {
    response.set('Cache-Control', 'no-store');
    if (request.method !== 'GET') {
      response.set('Allow', 'GET');
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    try {
      const result = await listDirectoryProfiles(db, request.query, options);
      if (result.status === 200) {
        response.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      console.error('Directory listing failed', {
        message: error instanceof Error ? error.message : String(error)
      });
      response.status(503).json({ error: 'directory_unavailable' });
    }
  };
}
