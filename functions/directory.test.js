// SPDX-License-Identifier: MIT

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectoryListHandler,
  listDirectoryProfiles,
  publicDirectoryProfile
} from './directory.js';

function handleRecord(handle, overrides = {}) {
  return {
    platform: 'twitter',
    handle,
    claims: [{ evidence: 'private-evidence' }],
    activeIdentity: {
      status: 'verified',
      pubkey: 'A'.repeat(64),
      npub: 'npub1incorrect',
      metadata: {
        name: 'Alice',
        nip05: 'alice@example.com',
        about: 'not-public-here'
      },
      lud16: 'do-not-expose@example.com'
    },
    ...overrides
  };
}

function fakeDatabase(records) {
  const reads = [];
  return {
    reads,
    collection(name) {
      const operation = { name };
      reads.push(operation);
      return {
        where(field, operator, value) {
          operation.filter = [field, operator, value];
          return this;
        },
        orderBy(field) {
          operation.order = field;
          return this;
        },
        startAfter(cursor) {
          operation.cursor = cursor;
          return this;
        },
        select(...fields) {
          operation.fields = fields;
          return this;
        },
        limit(limit) {
          operation.limit = limit;
          return this;
        },
        async get() {
          return {
            docs: Object.entries(records)
              .filter(
                ([id, data]) =>
                  data.activeIdentity?.status === 'verified' &&
                  (!operation.cursor || id > operation.cursor)
              )
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, operation.limit)
              .map(([id, data]) => ({ id, data: () => data }))
          };
        }
      };
    }
  };
}

test('exposes an allowlist of current identity fields, never evidence or payment data', () => {
  assert.deepEqual(
    publicDirectoryProfile('twitter:alice', handleRecord('alice')),
    {
      id: 'twitter:alice',
      platform: 'twitter',
      handle: 'alice',
      pubkey: 'a'.repeat(64),
      verified: true,
      name: 'Alice',
      nip05: 'alice@example.com'
    }
  );
});

test('rejects unverified, malformed, mismatched, or unsupported records', () => {
  const valid = handleRecord('alice');
  for (const data of [
    { ...valid, activeIdentity: null },
    {
      ...valid,
      activeIdentity: { ...valid.activeIdentity, status: 'pending' }
    },
    {
      ...valid,
      activeIdentity: { ...valid.activeIdentity, pubkey: 'bad-key' }
    },
    { ...valid, platform: 'youtube' },
    { ...valid, handle: 'bob' }
  ]) {
    assert.equal(publicDirectoryProfile('twitter:alice', data), null);
  }
  assert.equal(
    publicDirectoryProfile('twitter:home', handleRecord('home')),
    null
  );
  assert.equal(publicDirectoryProfile('other:alice', valid), null);
});

test('handles absent metadata and bounds display fields', () => {
  const data = handleRecord('alice');
  delete data.activeIdentity.metadata;
  assert.equal(publicDirectoryProfile('twitter:alice', data).name, 'alice');
  assert.equal(publicDirectoryProfile('twitter:alice', data).nip05, '');
  data.activeIdentity.metadata = {
    name: 'n'.repeat(120),
    nip05: 'x'.repeat(300)
  };
  assert.equal(publicDirectoryProfile('twitter:alice', data).name.length, 100);
  assert.equal(publicDirectoryProfile('twitter:alice', data).nip05.length, 255);
});

test('paginates verified handles without duplicates and finishes with a null cursor', async () => {
  const db = fakeDatabase({
    'twitter:alice': handleRecord('alice'),
    'twitter:bob': handleRecord('bob', {
      activeIdentity: { status: 'pending' }
    }),
    'twitter:carol': handleRecord('carol'),
    'twitter:dave': handleRecord('dave')
  });
  const first = await listDirectoryProfiles(db, { limit: '2' });
  assert.deepEqual(
    first.body.profiles.map((p) => p.handle),
    ['alice', 'carol']
  );
  assert.equal(first.body.nextCursor, 'twitter:carol');
  const second = await listDirectoryProfiles(db, {
    limit: '2',
    cursor: first.body.nextCursor
  });
  assert.deepEqual(
    second.body.profiles.map((p) => p.handle),
    ['dave']
  );
  assert.equal(second.body.nextCursor, null);
  assert.equal(db.reads[0].limit, 3);
  assert.deepEqual(db.reads[0].filter, [
    'activeIdentity.status',
    '==',
    'verified'
  ]);
  assert.equal(db.reads[0].name, 'nostrDirectoryHandles');
  assert.equal(db.reads[0].fields.includes('claims'), false);
});

test('advances cursors even when every scanned profile is malformed', async () => {
  const db = fakeDatabase({
    'twitter:alice': handleRecord('alice', {
      activeIdentity: { status: 'verified', pubkey: 'invalid' }
    }),
    'twitter:bob': handleRecord('bob')
  });
  const result = await listDirectoryProfiles(db, { limit: '1' });
  assert.deepEqual(result.body.profiles, []);
  assert.equal(result.body.nextCursor, 'twitter:alice');
});

test('empty collections are successful and collection overrides stay server controlled', async () => {
  const db = fakeDatabase({});
  assert.deepEqual(
    await listDirectoryProfiles(
      db,
      { collection: 'ignored' },
      { collection: 'testHandles' }
    ),
    {
      status: 200,
      body: { profiles: [], nextCursor: null }
    }
  );
  assert.equal(db.reads[0].name, 'testHandles');
  assert.equal(db.reads[0].limit, 51);
});

test('rejects invalid limits and path-like or non-scalar cursors before reading Firestore', async () => {
  const db = fakeDatabase({});
  for (const limit of [
    '0',
    '101',
    '-1',
    '1.5',
    '1e2',
    'abc',
    '',
    ['2'],
    {},
    2
  ]) {
    assert.equal((await listDirectoryProfiles(db, { limit })).status, 400);
  }
  for (const cursor of [
    '',
    'twitter:alice/claims/secret',
    '../private',
    ['twitter:alice'],
    {},
    2
  ]) {
    assert.equal((await listDirectoryProfiles(db, { cursor })).status, 400);
  }
  assert.equal(db.reads.length, 0);
});

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

test('HTTP handler is read only and caches only successful responses', async () => {
  const db = fakeDatabase({});
  const handler = createDirectoryListHandler(db);
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const response = responseRecorder();
    await handler({ method, query: {} }, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'GET');
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
  assert.equal(db.reads.length, 0);
  const response = responseRecorder();
  await handler({ method: 'GET', query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers['Cache-Control'],
    'public, max-age=60, s-maxage=60'
  );
  const invalid = responseRecorder();
  await handler({ method: 'GET', query: { limit: '1000' } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.headers['Cache-Control'], 'no-store');
});

test('Firestore failures return a retryable error without internal details', async (context) => {
  context.mock.method(console, 'error', () => {});
  const handler = createDirectoryListHandler({
    collection() {
      throw new Error('private-project-details');
    }
  });
  const response = responseRecorder();
  await handler({ method: 'GET', query: {} }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'directory_unavailable' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});
