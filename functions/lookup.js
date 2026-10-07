// SPDX-License-Identifier: MIT

import { nip19, verifyEvent } from 'nostr-tools';

const RESERVED_X_HANDLES = new Set([
  'compose',
  'explore',
  'hashtag',
  'home',
  'i',
  'intent',
  'messages',
  'notifications',
  'search',
  'share',
  'settings'
]);

export function normalizeTwitterHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').split(/[/?#\s]/)[0].toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle) || RESERVED_X_HANDLES.has(handle)) {
    return null;
  }
  return handle;
}

export function handleDocumentId(handle) {
  const normalized = normalizeTwitterHandle(handle);
  return normalized ? 'twitter:' + normalized : null;
}

function boundedString(value, maximumLength) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximumLength) : null;
}

export function publicDirectoryResponse(handle, data) {
  const active = data && data.activeIdentity;
  const verified = !!(
    active &&
    active.status === 'verified' &&
    /^[0-9a-f]{64}$/i.test(String(active.pubkey || ''))
  );

  const response = {
    found: true,
    verified: verified,
    platform: 'twitter',
    handle: handle,
    projectionStatus: boundedString(data && data.projectionStatus, 40),
    pending: Number((data && data.pendingClaimCount) || 0) > 0,
    activeIdentity: null
  };

  if (verified) {
    response.activeIdentity = {
      status: 'verified',
      pubkey: String(active.pubkey).toLowerCase(),
      npub: boundedString(active.npub, 80),
      proofTweetId: boundedString(active.proofTweetId, 30),
      verifiedAt: boundedString(active.verifiedAt, 50),
      ...zapFields(active)
    };
  }

  return response;
}

function zapFields(source) {
  if (source?.zappable === true) {
    return {
      zappable: true,
      lud16: boundedString(source.lud16, 320)
    };
  }
  if (source?.zappable === false) {
    return { zappable: false, lud16: null };
  }
  return { zappable: null, lud16: null };
}

function storedEvent(value, kind, pubkey) {
  if (!value) return null;
  let event = value;
  if (typeof value === 'string') {
    try {
      event = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  if (event.kind !== kind) return null;
  if (String(event.pubkey || '').toLowerCase() !== pubkey) return null;
  try {
    if (!verifyEvent(event)) return null;
  } catch {
    return null;
  }
  return event;
}

function nprofileFor(pubkey, profile) {
  const relays = [];
  const listed = Array.isArray(profile?.writeRelays) ? profile.writeRelays : [];
  for (const value of listed) {
    if (relays.length >= 2) break;
    if (typeof value === 'string' && value.startsWith('wss://')) relays.push(value);
  }
  try {
    return nip19.nprofileEncode({ pubkey, relays });
  } catch {
    return null;
  }
}

function identityWithProfile(identity, profile) {
  const zap = profile ? zapFields(profile.zap) : {
    zappable: identity.zappable,
    lud16: identity.lud16
  };
  return {
    ...identity,
    ...zap,
    profileEvent: profile ? storedEvent(profile.kind0Json, 0, identity.pubkey) : null,
    relayListEvent: profile ? storedEvent(profile.relayListJson, 10002, identity.pubkey) : null,
    nprofile: nprofileFor(identity.pubkey, profile)
  };
}

export async function lookupAtlasHandle(db, value, options = {}) {
  const handle = normalizeTwitterHandle(value);
  if (!handle) {
    return { status: 400, body: { error: 'invalid_handle' } };
  }

  const collection = options.collection || 'nostrDirectoryHandles';
  const snapshot = await db.collection(collection).doc(handleDocumentId(handle)).get();
  if (!snapshot.exists) {
    return {
      status: 404,
      body: {
        found: false,
        verified: false,
        platform: 'twitter',
        handle: handle,
        activeIdentity: null
      }
    };
  }

  const data = snapshot.data() || {};
  const body = publicDirectoryResponse(handle, data);
  if (body.activeIdentity?.pubkey) {
    const profiles = options.profilesCollection || 'nostrProfiles';
    const profileSnap = await db.collection(profiles).doc(body.activeIdentity.pubkey).get();
    const profile = profileSnap.exists ? profileSnap.data() || {} : null;
    body.activeIdentity = identityWithProfile(body.activeIdentity, profile);
  }

  return {
    status: 200,
    body
  };
}
