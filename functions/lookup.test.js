// SPDX-License-Identifier: MIT

import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import {
  handleDocumentId,
  lookupAtlasHandle,
  normalizeTwitterHandle,
  publicDirectoryResponse
} from './lookup.js';

test('normalizes X handles and creates the production Firestore document id', function () {
  assert.equal(normalizeTwitterHandle('@Jack'), 'jack');
  assert.equal(handleDocumentId('Jack'), 'twitter:jack');
  assert.equal(normalizeTwitterHandle('home'), null);
});

test('returns only sanitized active identity data', function () {
  const result = publicDirectoryResponse('jack', {
    projectionStatus: 'complete',
    pendingClaimCount: 0,
    claims: [{ secret: 'must-not-leak' }],
    activeIdentity: {
      status: 'verified',
      pubkey: 'a'.repeat(64),
      npub: 'npub1example',
      proofTweetId: '1234567890',
      zappable: true,
      lud16: 'jack@example.com',
      internalEvidence: 'must-not-leak'
    }
  });

  assert.equal(result.verified, true);
  assert.equal(result.activeIdentity.pubkey, 'a'.repeat(64));
  assert.equal('claims' in result, false);
  assert.equal('internalEvidence' in result.activeIdentity, false);
});

test('reads nostrDirectoryHandles by twitter handle', async function () {
  const reads = [];
  const db = {
    collection(collection) {
      return {
        doc(id) {
          reads.push({ collection, id });
          return {
            async get() {
              return {
                exists: true,
                data: () => ({ activeIdentity: null, pendingClaimCount: 1 })
              };
            }
          };
        }
      };
    }
  };

  const result = await lookupAtlasHandle(db, 'Alice');
  assert.deepEqual(reads, [{ collection: 'nostrDirectoryHandles', id: 'twitter:alice' }]);
  assert.equal(result.status, 200);
  assert.equal(result.body.verified, false);
  assert.equal(result.body.pending, true);
});

test('uses nostrProfiles.zap when a signed profile exists', async function () {
  const pubkey = 'b'.repeat(64);
  const docs = {
    'nostrDirectoryHandles/twitter:alice': {
      activeIdentity: {
        status: 'verified',
        pubkey,
        zappable: false,
        lud16: 'stale@example.com'
      }
    },
    [`nostrProfiles/${pubkey}`]: {
      zap: {
        zappable: true,
        lud16: 'alice@example.com',
        transient: false
      }
    }
  };
  const db = {
    collection(collection) {
      return {
        doc(id) {
          return {
            async get() {
              const data = docs[`${collection}/${id}`];
              return { exists: data !== undefined, data: () => data || null };
            }
          };
        }
      };
    }
  };

  const result = await lookupAtlasHandle(db, 'alice');
  assert.equal(result.body.activeIdentity.zappable, true);
  assert.equal(result.body.activeIdentity.lud16, 'alice@example.com');

  docs[`nostrProfiles/${pubkey}`].zap = {
    zappable: false,
    lud16: 'alice@example.com',
    transient: false
  };
  const hidden = await lookupAtlasHandle(db, 'alice');
  assert.equal(hidden.body.activeIdentity.zappable, false);
  assert.equal(hidden.body.activeIdentity.lud16, null);
});

test('keeps an unfinished zap check null and returns the signed profile', async function () {
  const secret = generateSecretKey();
  const pubkey = getPublicKey(secret);
  const profileEvent = finalizeEvent({
    kind: 0,
    created_at: 1_700_000_000,
    tags: [],
    content: '{"name":"Ada"}'
  }, secret);
  const relayListEvent = finalizeEvent({
    kind: 10002,
    created_at: 1_700_000_000,
    tags: [['r', 'wss://relay.ditto.pub']],
    content: ''
  }, secret);
  const writeRelays = [
    'wss://relay.ditto.pub',
    'wss://nostr.mom',
    'wss://relay.damus.io',
    'https://not-a-relay.example'
  ];
  const docs = {
    'nostrDirectoryHandles/twitter:ada': {
      activeIdentity: {
        status: 'verified',
        pubkey,
        zappable: true,
        lud16: 'stale@example.com'
      }
    },
    [`nostrProfiles/${pubkey}`]: {
      kind0Json: JSON.stringify(profileEvent),
      relayListJson: JSON.stringify(relayListEvent),
      writeRelays,
      zap: { zappable: null, transient: true }
    }
  };
  const db = docDb(docs);

  const result = await lookupAtlasHandle(db, 'ada');
  assert.equal(result.body.activeIdentity.zappable, null);
  assert.equal(result.body.activeIdentity.lud16, null);
  assert.deepEqual(result.body.activeIdentity.profileEvent, profileEvent);
  assert.deepEqual(result.body.activeIdentity.relayListEvent, relayListEvent);
  const decoded = nip19.decode(result.body.activeIdentity.nprofile);
  assert.equal(decoded.type, 'nprofile');
  assert.equal(decoded.data.pubkey, pubkey);
  assert.deepEqual(decoded.data.relays, writeRelays.slice(0, 2));

  docs[`nostrProfiles/${pubkey}`].kind0Json = JSON.stringify({
    kind: 0,
    pubkey,
    content: '{"name":"Ada"}'
  });
  const unsigned = await lookupAtlasHandle(db, 'ada');
  assert.equal(unsigned.body.activeIdentity.profileEvent, null);
  assert.deepEqual(unsigned.body.activeIdentity.relayListEvent, relayListEvent);
});

test('leaves zap unknown when neither the profile nor the claim has a finished check', async function () {
  const pubkey = 'e'.repeat(64);
  const db = docDb({
    'nostrDirectoryHandles/twitter:ada': {
      activeIdentity: { status: 'verified', pubkey }
    }
  });

  const result = await lookupAtlasHandle(db, 'ada');
  assert.equal(result.body.activeIdentity.zappable, null);
  assert.equal(result.body.activeIdentity.lud16, null);
  assert.equal(result.body.activeIdentity.profileEvent, null);
  assert.equal(result.body.activeIdentity.nprofile.startsWith('nprofile1'), true);
});

function docDb(docs) {
  return {
    collection(collection) {
      return {
        doc(id) {
          return {
            async get() {
              const data = docs[`${collection}/${id}`];
              return { exists: data !== undefined, data: () => data || null };
            }
          };
        }
      };
    }
  };
}

test('keeps claim zap fields when the profile document is missing', async function () {
  const pubkey = 'c'.repeat(64);
  const db = {
    collection(collection) {
      return {
        doc() {
          return {
            async get() {
              if (collection === 'nostrProfiles') return { exists: false, data: () => null };
              return {
                exists: true,
                data: () => ({
                  activeIdentity: {
                    status: 'verified',
                    pubkey,
                    zappable: true,
                    lud16: 'kept@example.com'
                  }
                })
              };
            }
          };
        }
      };
    }
  };

  const result = await lookupAtlasHandle(db, 'alice');
  assert.equal(result.body.activeIdentity.zappable, true);
  assert.equal(result.body.activeIdentity.lud16, 'kept@example.com');
});
