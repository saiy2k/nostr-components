// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  buildBackfillCheckpointWrite,
  buildBackfillEventWrite,
  buildBackfillGapWrite,
  buildFirestoreWrites,
  buildLiveEventWrite,
  buildLiveHeartbeatWrite,
  buildProjectionQueueClaimData,
  buildProjectionQueueFailureWrites,
  buildProjectionProcessingWrites,
  buildProjectionQueueCreateWrite,
  buildProjectionQueueWrites,
  buildProjectionRawFailureWrites,
  buildRunSummaryWrite,
  computeWotScores,
  createRunMetrics,
  decideBackfillCursor,
  extractDirectoryInputs,
  extractTweetId,
  finishRunMetrics,
  firestoreRawDocToNostrEvent,
  firestoreTimestampToMs,
  lightningAddressToLnurlp,
  liveStateId,
  normalizeTwitterHandle,
  percentile,
  projectionStatusForRawEvent,
  queueDocIsClaimable,
  queueStatusForProjection,
  rememberSeenEventId,
} from './relay-directory-crawler.mjs';

const PUBKEY = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
const NPUB = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg';

describe('normalizeTwitterHandle', () => {
  it('normalizes handles and X/Twitter profile URLs', () => {
    expect(normalizeTwitterHandle('@Jack')).toBe('jack');
    expect(normalizeTwitterHandle('https://x.com/Bebop2077_')).toBe('bebop2077_');
    expect(normalizeTwitterHandle('https://twitter.com/alice/status/123')).toBe('alice');
  });

  it('rejects invalid handles', () => {
    expect(normalizeTwitterHandle('this-has-dashes')).toBeNull();
    expect(normalizeTwitterHandle('waytoolongtwitterhandle')).toBeNull();
    expect(normalizeTwitterHandle('https://x.com/i/communities/1747149501561778581')).toBeNull();
  });
});

describe('extractTweetId', () => {
  it('extracts a numeric tweet id from URLs or raw ids', () => {
    expect(extractTweetId('2064733905014440088')).toBe('2064733905014440088');
    expect(extractTweetId('https://x.com/alice/status/2064733905014440088?s=20')).toBe(
      '2064733905014440088'
    );
    expect(extractTweetId('AldenCo18783')).toBeNull();
  });
});

describe('extractDirectoryInputs', () => {
  it('extracts verifiable NIP-39 candidates and claimed-only leads', () => {
    const { candidates, claimed, metadataByPubkey } = extractDirectoryInputs([
      {
        id: 'evt1',
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1,
        content: '',
        tags: [['i', 'twitter:Alice', 'https://x.com/Alice/status/2064733905014440088']],
      },
      {
        id: 'evt2',
        kind: 0,
        pubkey: PUBKEY,
        created_at: 2,
        content: JSON.stringify({
          name: 'Alice',
          lud16: 'alice@getalby.com',
          about: 'X: https://x.com/alice',
        }),
        tags: [],
      },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        handle: 'alice',
        npub: NPUB,
        proofTweetId: '2064733905014440088',
        sourceKind: 10011,
      }),
    ]);
    expect(claimed).toEqual([
      expect.objectContaining({
        handle: 'alice',
        identityStatus: 'claimed',
        source: 'kind0.about',
      }),
    ]);
    const metadata = metadataByPubkey.get(PUBKEY);
    expect(metadata).toBeDefined();
    expect(metadata?.lud16).toBe('alice@getalby.com');
  });
});

describe('lightningAddressToLnurlp', () => {
  it('converts lud16 to a LNURL-pay metadata endpoint', () => {
    expect(lightningAddressToLnurlp('alice@getalby.com')).toBe(
      'https://getalby.com/.well-known/lnurlp/alice'
    );
  });
});

describe('computeWotScores', () => {
  it('adds ranking signals without changing identity status or auto-zap policy', () => {
    const claimed = {
      handle: 'alice',
      pubkey: PUBKEY,
      identityStatus: 'claimed',
      autoZapAllowed: false,
    };

    const scored = computeWotScores([claimed], [
      {
        id: 'follow',
        kind: 3,
        pubkey: '1111111111111111111111111111111111111111111111111111111111111111',
        created_at: 1,
        content: '',
        tags: [['p', PUBKEY]],
        sig: 'invalid-for-test',
      },
    ]);

    expect(scored[0].identityStatus).toBe('claimed');
    expect(scored[0].autoZapAllowed).toBe(false);
    expect(scored[0].wot.note).toContain('not identity proof');
  });
});

describe('buildFirestoreWrites', () => {
  it('creates entry and handle documents for Firestore persistence', () => {
    const writes = buildFirestoreWrites(
      {
        generatedAt: '2026-06-16T13:00:00.000Z',
        strategy: { identityProof: 'test' },
        relays: ['wss://relay.example'],
        relayResults: { kind10011: [], kind0: [] },
        stats: {
          profileEvents: 1,
          verifiableCandidates: 1,
          proofTweetsAttempted: 1,
          verified: 1,
          rejected: 0,
          claimedOnly: 0,
          zappableVerified: 1,
          autoZapAllowed: 1,
        },
        directory: [
          {
            platform: 'twitter',
            handle: 'alice',
            pubkey: PUBKEY,
            npub: NPUB,
            identityStatus: 'verified',
            directoryStatus: 'verified_zappable',
            zappable: true,
            autoZapAllowed: true,
            wot: { score: 42 },
          },
        ],
        rejected: [],
      },
      {
        firestoreEntriesCollection: 'entries',
        firestoreHandlesCollection: 'handles',
      }
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({
      collection: 'entries',
      id: `twitter:alice:${PUBKEY}`,
      data: expect.objectContaining({
        handle: 'alice',
        runId: '2026-06-16T13:00:00_000Z',
        autoZapAllowed: true,
      }),
    });
    expect(writes[1]).toMatchObject({
      collection: 'handles',
      id: 'twitter:alice',
      data: expect.objectContaining({
        handle: 'alice',
        best: expect.objectContaining({
          entryId: `twitter:alice:${PUBKEY}`,
          autoZapAllowed: true,
        }),
      }),
    });
  });
});

describe('backfill Firestore writes', () => {
  it('stores raw relay events by event id', () => {
    const write = buildBackfillEventWrite(
      {
        id: 'event/with.unsafe#chars',
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1710000000,
        content: '',
        tags: [['i', 'twitter:alice', 'https://x.com/alice/status/2064733905014440088']],
        sig: 'sig',
      },
      'wss://relay.example',
      { firestoreEventsCollection: 'events' }
    );

    expect(write).toMatchObject({
      collection: 'events',
      id: 'event_with_unsafe_chars',
      data: {
        id: 'event/with.unsafe#chars',
        kind: 10011,
        pubkey: PUBKEY,
        createdAt: 1710000000,
        event: expect.objectContaining({
          id: 'event/with.unsafe#chars',
          tags: [{ values: ['i', 'twitter:alice', 'https://x.com/alice/status/2064733905014440088'] }],
        }),
        eventJson: expect.stringContaining('twitter:alice'),
      },
    });
  });

  it('creates a projection queue doc only when missing', () => {
    const write = buildProjectionQueueCreateWrite(
      {
        id: 'queue-event',
        kind: 0,
        pubkey: PUBKEY,
        created_at: 1710000000,
      },
      'backfill',
      { firestoreQueueCollection: 'queue' }
    );

    expect(write).toMatchObject({
      operation: 'createIfMissing',
      collection: 'queue',
      id: 'queue-event',
      data: expect.objectContaining({
        eventId: 'queue-event',
        kind: 0,
        pubkey: PUBKEY,
        sourceMode: 'backfill',
        status: 'pending',
        reason: 'awaiting_projection',
        attempts: 0,
      }),
    });
  });

  it('stores resumable relay-kind backfill checkpoints', () => {
    const write = buildBackfillCheckpointWrite(
      {
        relay: 'wss://relay.example',
        kind: 10011,
        cursorUntil: 1709999999,
        oldestSeenAt: 1710000000,
        pageEvents: 10,
        validPageEvents: 8,
        lastReason: 'eose',
        completed: false,
      },
      { firestoreStateCollection: 'state' }
    );

    expect(write).toMatchObject({
      collection: 'state',
      id: 'backfill:wss:__relay_example:kind:10011',
      data: expect.objectContaining({
        relay: 'wss://relay.example',
        kind: 10011,
        cursorUntil: 1709999999,
        oldestSeenAt: 1710000000,
        status: 'running',
        lastReason: 'eose',
      }),
    });
  });

  it('stores overlap backfill checkpoints separately from historical checkpoints', () => {
    const write = buildBackfillCheckpointWrite(
      {
        relay: 'wss://relay.example',
        kind: 0,
        cursorUntil: 500,
        oldestSeenAt: 450,
        pageEvents: 10,
        validPageEvents: 9,
        lastReason: 'eose',
        completed: false,
      },
      {
        firestoreStateCollection: 'state',
        backfillStatePrefix: 'overlap',
      }
    );

    expect(write).toMatchObject({
      collection: 'state',
      id: 'overlap:wss:__relay_example:kind:0',
      data: expect.objectContaining({
        mode: 'backfill',
        statePrefix: 'overlap',
        status: 'running',
      }),
    });
  });

  it('stores known backfill gaps before skipping stuck timestamps', () => {
    const write = buildBackfillGapWrite(
      {
        relay: 'wss://relay.example',
        kind: 10011,
        timestamp: 498,
        reason: 'stuck_same_timestamp',
        pageLimit: 2000,
        seenEventIds: ['a', 'b'],
      },
      { firestoreGapsCollection: 'gaps' }
    );

    expect(write).toMatchObject({
      collection: 'gaps',
      id: 'wss:__relay_example:kind:10011:timestamp:498',
      data: expect.objectContaining({
        relay: 'wss://relay.example',
        kind: 10011,
        timestamp: 498,
        reason: 'stuck_same_timestamp',
        seenEventIds: ['a', 'b'],
      }),
    });
  });
});

describe('live listener Firestore writes', () => {
  it('stores live events without overwriting projection processing state', () => {
    const write = buildLiveEventWrite(
      {
        id: 'live-event',
        kind: 10011,
        pubkey: PUBKEY,
        created_at: 1710000001,
        content: '',
        tags: [['i', 'twitter:alice', 'https://x.com/alice/status/2064733905014440088']],
        sig: 'sig',
      },
      'wss://relay.example',
      { firestoreEventsCollection: 'events' }
    );

    expect(write).toMatchObject({
      collection: 'events',
      id: 'live-event',
      data: {
        id: 'live-event',
        kind: 10011,
        pubkey: PUBKEY,
        createdAt: 1710000001,
        ingestion: expect.objectContaining({
          mode: 'live',
          lastRelay: 'wss://relay.example',
        }),
      },
    });
    expect(write.data.processing).toBeUndefined();
    expect(write.data.ingestion.needsProjection).toBeUndefined();
  });

  it('keeps live event id dedupe bounded', () => {
    const seen = new Set();
    const queue = [];

    expect(rememberSeenEventId('a', seen, queue, 2)).toBe(true);
    expect(rememberSeenEventId('b', seen, queue, 2)).toBe(true);
    expect(rememberSeenEventId('a', seen, queue, 2)).toBe(false);
    expect(rememberSeenEventId('c', seen, queue, 2)).toBe(true);

    expect([...seen]).toEqual(['b', 'c']);
    expect(queue).toEqual(['b', 'c']);
  });

  it('stores live relay heartbeat state by relay id', () => {
    const write = buildLiveHeartbeatWrite(
      {
        relay: 'wss://relay.example',
        status: 'connected',
        mode: 'live',
        connected: true,
        lastEventAt: '2026-06-19T10:00:00.000Z',
        attempts: 2,
      },
      { firestoreStateCollection: 'state' }
    );

    expect(liveStateId('wss://relay.example')).toBe('live:wss:__relay_example');
    expect(write).toMatchObject({
      collection: 'state',
      id: 'live:wss:__relay_example',
      data: expect.objectContaining({
        relay: 'wss://relay.example',
        mode: 'live',
        status: 'connected',
        connected: true,
        connectAttempts: 2,
      }),
    });
  });
});

describe('decideBackfillCursor', () => {
  const base = {
    defaultPageLimit: 100,
    maxPageLimit: 400,
    stuckCount: 0,
    pageLimit: 100,
    boundaryTimestamp: null,
    boundarySeenIds: [],
  };

  it('moves the cursor to the oldest timestamp when the page progresses backward', () => {
    const decision = decideBackfillCursor({
      ...base,
      cursorUntil: 500,
      pageOldest: 498,
      pageEvents: [
        { id: 'a', created_at: 500 },
        { id: 'b', created_at: 498 },
      ],
    });

    expect(decision).toMatchObject({
      action: 'progress',
      cursorUntil: 498,
      boundaryTimestamp: 498,
      boundarySeenIds: ['b'],
      stuckCount: 0,
    });
  });

  it('keeps the same cursor when same-timestamp boundary has new event ids', () => {
    const decision = decideBackfillCursor({
      ...base,
      cursorUntil: 498,
      pageOldest: 498,
      boundaryTimestamp: 498,
      boundarySeenIds: ['a', 'b'],
      pageEvents: [
        { id: 'a', created_at: 498 },
        { id: 'b', created_at: 498 },
        { id: 'c', created_at: 498 },
      ],
    });

    expect(decision).toMatchObject({
      action: 'drain-boundary',
      cursorUntil: 498,
      boundarySeenIds: ['a', 'b', 'c'],
      stuckCount: 0,
    });
  });

  it('increases page limit before skipping a same-timestamp page with no new ids', () => {
    const decision = decideBackfillCursor({
      ...base,
      cursorUntil: 498,
      pageOldest: 498,
      boundaryTimestamp: 498,
      boundarySeenIds: ['a', 'b'],
      pageEvents: [
        { id: 'a', created_at: 498 },
        { id: 'b', created_at: 498 },
      ],
    });

    expect(decision).toMatchObject({
      action: 'increase-limit',
      cursorUntil: 498,
      pageLimit: 200,
      stuckCount: 1,
      gap: null,
    });
  });

  it('records a gap and skips the timestamp after max page limit is exhausted', () => {
    const decision = decideBackfillCursor({
      ...base,
      cursorUntil: 498,
      pageOldest: 498,
      pageLimit: 400,
      boundaryTimestamp: 498,
      boundarySeenIds: ['a', 'b'],
      pageEvents: [
        { id: 'a', created_at: 498 },
        { id: 'b', created_at: 498 },
      ],
    });

    expect(decision).toMatchObject({
      action: 'skip-gap',
      cursorUntil: 497,
      pageLimit: 100,
      boundaryTimestamp: null,
      boundarySeenIds: [],
      stuckCount: 0,
      gap: {
        timestamp: 498,
        reason: 'stuck_same_timestamp',
        pageLimit: 400,
        seenEventIds: ['a', 'b'],
      },
    });
  });
});

describe('projection helpers', () => {
  it('rebuilds exact Nostr events from Firestore eventJson', () => {
    const event = {
      id: 'evt-json',
      kind: 10011,
      pubkey: PUBKEY,
      created_at: 1710000000,
      content: '',
      tags: [['i', 'twitter:alice', 'https://x.com/alice/status/2064733905014440088']],
      sig: 'sig',
    };

    expect(firestoreRawDocToNostrEvent({ eventJson: JSON.stringify(event) })).toEqual(event);
  });

  it('rebuilds Nostr events from Firestore-safe tag objects', () => {
    expect(
      firestoreRawDocToNostrEvent({
        event: {
          id: 'evt-safe',
          kind: 10011,
          pubkey: PUBKEY,
          created_at: 1710000000,
          content: '',
          tags: [{ values: ['i', 'twitter:alice', 'proof'] }],
          sig: 'sig',
        },
      })
    ).toMatchObject({
      id: 'evt-safe',
      tags: [['i', 'twitter:alice', 'proof']],
    });
  });

  it('classifies projection processing statuses', () => {
    expect(
      projectionStatusForRawEvent('verified-event', new Set(['verified-event']), new Set(['verified-event']), new Map())
    ).toEqual({
      processingStatus: 'processed',
      identityStatus: 'verified',
      reason: 'verified_identity_proof',
    });
    expect(
      projectionStatusForRawEvent('claimed-event', new Set(['claimed-event']), new Set(), new Map())
    ).toEqual({
      processingStatus: 'processed',
      identityStatus: 'claimed',
      reason: 'claimed_identity_signal',
    });
    expect(
      projectionStatusForRawEvent('ignored-event', new Set(), new Set(), new Map())
    ).toEqual({
      processingStatus: 'ignored',
      identityStatus: 'none',
      reason: 'no_identity_signal',
    });
    expect(
      projectionStatusForRawEvent(
        'rejected-event',
        new Set(['rejected-event']),
        new Set(),
        new Map([['rejected-event', 'proof_author_mismatch']])
      )
    ).toEqual({
      processingStatus: 'processed',
      identityStatus: 'rejected',
      reason: 'proof_author_mismatch',
    });
  });

  it('maps projection results to terminal queue statuses', () => {
    expect(queueStatusForProjection({ processingStatus: 'processed' })).toBe('done');
    expect(queueStatusForProjection({ processingStatus: 'ignored' })).toBe('ignored');
    expect(queueStatusForProjection({ processingStatus: 'retry_later' })).toBe('retry_later');
  });

  it('claims only due or expired queue docs', () => {
    const now = Date.parse('2026-06-19T12:00:00.000Z');

    expect(queueDocIsClaimable({ status: 'pending' }, now)).toBe(true);
    expect(
      queueDocIsClaimable(
        {
          status: 'retry_later',
          nextAttemptAt: new Date('2026-06-19T12:00:01.000Z'),
        },
        now
      )
    ).toBe(false);
    expect(
      queueDocIsClaimable(
        {
          status: 'processing',
          lockedBy: 'worker-a',
          lockExpiresAt: new Date('2026-06-19T11:59:59.000Z'),
        },
        now
      )
    ).toBe(true);
    expect(
      queueDocIsClaimable(
        {
          status: 'processing',
          lockedBy: 'worker-a',
          lockExpiresAt: new Date('2026-06-19T12:00:01.000Z'),
        },
        now
      )
    ).toBe(false);
    expect(queueDocIsClaimable({ status: 'done' }, now)).toBe(false);
  });

  it('builds queue claim writes with worker ownership and lock expiry', () => {
    const lockExpiresAt = new Date('2026-06-19T12:10:00.000Z');
    const data = buildProjectionQueueClaimData('worker-a', lockExpiresAt);

    expect(data).toMatchObject({
      status: 'processing',
      lockedBy: 'worker-a',
      lockExpiresAt,
    });
  });

  it('normalizes Firestore-like timestamps for retry and lock comparisons', () => {
    expect(firestoreTimestampToMs({ seconds: 10, nanoseconds: 500000000 })).toBe(10500);
    expect(firestoreTimestampToMs(new Date('1970-01-01T00:00:11.000Z'))).toBe(11000);
    expect(firestoreTimestampToMs('1970-01-01T00:00:12.000Z')).toBe(12000);
  });

  it('builds processing writes for raw event docs after projection', () => {
    const writes = buildProjectionProcessingWrites(
      [
        { id: 'verified-doc', data: { id: 'verified-event' } },
        { id: 'claimed-doc', data: { id: 'claimed-event' } },
        { id: 'ignored-doc', data: { id: 'ignored-event' } },
        { id: 'rejected-doc', data: { id: 'rejected-event' } },
      ],
      {
        generatedAt: '2026-06-18T00:00:00.000Z',
        directory: [
          {
            sourceEventId: 'verified-event',
            identityStatus: 'verified',
          },
          {
            sourceEventId: 'claimed-event',
            identityStatus: 'claimed',
          },
        ],
        rejected: [
          {
            sourceEventId: 'rejected-event',
            rejectionReason: 'npub-not-in-proof-tweet',
          },
        ],
      },
      { firestoreEventsCollection: 'events' }
    );

    expect(writes).toHaveLength(4);
    expect(writes[0]).toMatchObject({
      collection: 'events',
      id: 'verified-doc',
      data: {
        processing: expect.objectContaining({
          status: 'processed',
          reason: 'verified_identity_proof',
        }),
        identity: {
          status: 'verified',
          reason: 'verified_identity_proof',
        },
      },
    });
    expect(writes[2]).toMatchObject({
      id: 'ignored-doc',
      data: {
        processing: expect.objectContaining({
          status: 'ignored',
          reason: 'no_identity_signal',
        }),
        identity: {
          status: 'none',
          reason: 'no_identity_signal',
        },
      },
    });
    expect(writes[3]).toMatchObject({
      id: 'rejected-doc',
      data: {
        identity: {
          status: 'rejected',
          reason: 'npub-not-in-proof-tweet',
        },
      },
    });
  });

  it('builds queue completion writes after projection', () => {
    const writes = buildProjectionQueueWrites(
      [
        { id: 'verified-doc', data: { id: 'verified-event' } },
        { id: 'ignored-doc', data: { id: 'ignored-event' } },
      ],
      {
        directory: [
          {
            sourceEventId: 'verified-event',
            identityStatus: 'verified',
          },
        ],
        rejected: [],
      },
      { firestoreQueueCollection: 'queue' }
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({
      collection: 'queue',
      id: 'verified-event',
      data: expect.objectContaining({
        eventId: 'verified-event',
        status: 'done',
        reason: 'verified_identity_proof',
        lockedBy: null,
        lockExpiresAt: null,
      }),
    });
    expect(writes[1]).toMatchObject({
      collection: 'queue',
      id: 'ignored-event',
      data: expect.objectContaining({
        eventId: 'ignored-event',
        status: 'ignored',
        reason: 'no_identity_signal',
      }),
    });
  });

  it('keeps claimed queue docs retryable when external proof verification stops', () => {
    const writes = buildProjectionQueueWrites(
      [
        { id: 'event-a', data: { id: 'event-a' } },
        { id: 'event-b', data: { id: 'event-b' } },
      ],
      {
        strategy: {
          proofVerificationStoppedReason: 'x_rate_limited',
        },
        directory: [],
        rejected: [],
        retryLater: [],
      },
      {
        firestoreQueueCollection: 'queue',
        projectionExternalRetryMs: 60000,
      }
    );

    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write).toMatchObject({
        collection: 'queue',
        data: expect.objectContaining({
          status: 'retry_later',
          reason: 'x_rate_limited',
          processingStatus: 'retry_later',
          identityStatus: 'unknown',
          lockedBy: null,
          lockExpiresAt: null,
        }),
      });
      expect(write.data.nextAttemptAt).toBeInstanceOf(Date);
    }
  });

  it('marks missing raw queue docs as failed', () => {
    const writes = buildProjectionQueueFailureWrites(
      [
        {
          id: 'queue-doc',
          eventId: 'missing-event',
          data: { eventId: 'missing-event' },
        },
      ],
      'missing_raw_event',
      { firestoreQueueCollection: 'queue' }
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      collection: 'queue',
      id: 'missing-event',
      data: expect.objectContaining({
        eventId: 'missing-event',
        status: 'failed',
        reason: 'missing_raw_event',
        processingStatus: 'failed',
        identityStatus: 'unknown',
      }),
    });
  });

  it('marks corrupt raw docs as failed', () => {
    const writes = buildProjectionRawFailureWrites(
      [{ id: 'raw-doc', data: { id: 'bad-event' } }],
      { firestoreEventsCollection: 'events' }
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      collection: 'events',
      id: 'raw-doc',
      data: {
        processing: expect.objectContaining({
          status: 'failed',
          reason: 'invalid_raw_event',
        }),
        identity: {
          status: 'unknown',
          reason: 'invalid_raw_event',
        },
      },
    });
  });
});

describe('run metrics helpers', () => {
  it('creates stable run ids and finishes with counters', () => {
    const run = createRunMetrics('projection', new Date('2026-06-19T10:00:00.000Z'));
    run.timings.push(10, 20, 100);

    const finished = finishRunMetrics(
      run,
      { eventsRead: 3, verified: 1 },
      new Date('2026-06-19T10:00:02.000Z')
    );

    expect(finished).toMatchObject({
      component: 'projection',
      runId: 'projection-2026-06-19T10:00:00_000Z',
      startedAt: '2026-06-19T10:00:00.000Z',
      finishedAt: '2026-06-19T10:00:02.000Z',
      durationMs: 2000,
      avgProcessingMs: 43,
      p95ProcessingMs: 100,
      counters: {
        eventsRead: 3,
        verified: 1,
      },
    });
    expect(finished.memoryRssMb).toBeGreaterThan(0);
  });

  it('calculates percentile from sorted position', () => {
    expect(percentile([100, 10, 20, 30], 50)).toBe(20);
    expect(percentile([100, 10, 20, 30], 95)).toBe(100);
    expect(percentile([], 95)).toBe(0);
  });

  it('builds one Firestore summary write per run', () => {
    const write = buildRunSummaryWrite(
      {
        component: 'backfill',
        runId: 'backfill-run',
        durationMs: 123,
        counters: { eventsWritten: 10 },
      },
      {
        mode: 'backfill',
        relays: ['wss://relay.example'],
        stats: { validEvents: 10 },
        firestore: { project: 'gr-prod' },
      },
      'backfillRuns'
    );

    expect(write).toMatchObject({
      collection: 'backfillRuns',
      id: 'backfill-run',
      data: expect.objectContaining({
        component: 'backfill',
        mode: 'backfill',
        durationMs: 123,
        counters: { eventsWritten: 10 },
        stats: { validEvents: 10 },
        relays: ['wss://relay.example'],
      }),
    });
  });
});
