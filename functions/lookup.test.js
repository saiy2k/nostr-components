// SPDX-License-Identifier: MIT

import test from 'node:test';
import assert from 'node:assert/strict';
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
