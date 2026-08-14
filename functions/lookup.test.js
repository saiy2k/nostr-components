// SPDX-License-Identifier: MIT

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directoryHandleId,
  lookupDirectoryHandle,
  normalizeTwitterHandle,
  publicDirectoryResponse
} from './lookup.js';

test('normalizes X handles and creates the production Firestore document id', function () {
  assert.equal(normalizeTwitterHandle('@Jack'), 'jack');
  assert.equal(directoryHandleId('Jack'), 'twitter:jack');
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

  const result = await lookupDirectoryHandle(db, 'Alice');
  assert.deepEqual(reads, [{ collection: 'nostrDirectoryHandles', id: 'twitter:alice' }]);
  assert.equal(result.status, 200);
  assert.equal(result.body.verified, false);
  assert.equal(result.body.pending, true);
});
