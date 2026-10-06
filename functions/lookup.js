// SPDX-License-Identifier: MIT

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
  const zappable = source?.zappable === true;
  return {
    zappable,
    lud16: zappable ? boundedString(source.lud16, 320) : null
  };
}

function withProfileZap(identity, profile) {
  const zap = profile && profile.zap;
  if (!zap || typeof zap !== 'object' || Array.isArray(zap)) return identity;
  return {
    ...identity,
    ...zapFields(zap)
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
    if (profileSnap.exists) {
      body.activeIdentity = withProfileZap(body.activeIdentity, profileSnap.data() || {});
    }
  }

  return {
    status: 200,
    body
  };
}
