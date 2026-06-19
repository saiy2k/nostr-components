#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { access, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue, Firestore } from '@google-cloud/firestore';
import { nip19, validateEvent, verifyEvent } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];

const DEFAULT_OUT = 'relay-directory-output.json';
const DEFAULT_FIRESTORE_ENTRIES_COLLECTION = 'nostrDirectoryEntries';
const DEFAULT_FIRESTORE_HANDLES_COLLECTION = 'nostrDirectoryHandles';
const DEFAULT_FIRESTORE_BACKFILL_RUNS_COLLECTION = 'relayBackfillRuns';
const DEFAULT_FIRESTORE_PROJECTION_RUNS_COLLECTION = 'relayProjectionRuns';
const DEFAULT_FIRESTORE_LIVE_RUNS_COLLECTION = 'relayLiveListenerRuns';
const DEFAULT_FIRESTORE_EVENTS_COLLECTION = 'nostrIdentityEvents';
const DEFAULT_FIRESTORE_QUEUE_COLLECTION = 'nostrProjectionQueue';
const DEFAULT_FIRESTORE_STATE_COLLECTION = 'relayCrawlerState';
const DEFAULT_FIRESTORE_GAPS_COLLECTION = 'relayCrawlerGaps';
const BACKFILL_KINDS = [10011, 0];
const LIVE_LISTENER_KINDS = BACKFILL_KINDS;
const CREATE_IF_MISSING_CONCURRENCY = 20;
const TWITTER_TAG = /^(?:twitter|x|com\.twitter):(.+)$/i;
const X_PROFILE_LINK = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})\b/i;
const TWEET_ID = /(\d{10,25})/;
const RESERVED_X_PATHS = new Set([
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
  'settings',
]);

function parseArgs(argv) {
  const args = {
    mode: 'project',
    relays: DEFAULT_RELAYS,
    out: DEFAULT_OUT,
    timeoutMs: 12000,
    maxProofs: 250,
    verifyTweets: true,
    checkZaps: true,
    firestoreProject: process.env.FIRESTORE_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null,
    firestoreDatabase: process.env.FIRESTORE_DATABASE || '(default)',
    firestoreEntriesCollection: process.env.FIRESTORE_ENTRIES_COLLECTION || DEFAULT_FIRESTORE_ENTRIES_COLLECTION,
    firestoreHandlesCollection: process.env.FIRESTORE_HANDLES_COLLECTION || DEFAULT_FIRESTORE_HANDLES_COLLECTION,
    firestoreBackfillRunsCollection: process.env.FIRESTORE_BACKFILL_RUNS_COLLECTION || DEFAULT_FIRESTORE_BACKFILL_RUNS_COLLECTION,
    firestoreProjectionRunsCollection: process.env.FIRESTORE_PROJECTION_RUNS_COLLECTION || DEFAULT_FIRESTORE_PROJECTION_RUNS_COLLECTION,
    firestoreLiveRunsCollection: process.env.FIRESTORE_LIVE_RUNS_COLLECTION || DEFAULT_FIRESTORE_LIVE_RUNS_COLLECTION,
    firestoreEventsCollection: process.env.FIRESTORE_EVENTS_COLLECTION || DEFAULT_FIRESTORE_EVENTS_COLLECTION,
    firestoreQueueCollection: process.env.FIRESTORE_QUEUE_COLLECTION || DEFAULT_FIRESTORE_QUEUE_COLLECTION,
    firestoreStateCollection: process.env.FIRESTORE_STATE_COLLECTION || DEFAULT_FIRESTORE_STATE_COLLECTION,
    firestoreGapsCollection: process.env.FIRESTORE_GAPS_COLLECTION || DEFAULT_FIRESTORE_GAPS_COLLECTION,
    writeFirestore: process.env.WRITE_FIRESTORE === '1',
    backfillPageLimit: Number(process.env.BACKFILL_PAGE_LIMIT || 500),
    backfillMaxPageLimit: Number(process.env.BACKFILL_MAX_PAGE_LIMIT || 2000),
    backfillMaxPages: Number(process.env.BACKFILL_MAX_PAGES || 25),
    backfillUntil: process.env.BACKFILL_UNTIL ? Number(process.env.BACKFILL_UNTIL) : Math.floor(Date.now() / 1000),
    backfillSince: process.env.BACKFILL_SINCE ? Number(process.env.BACKFILL_SINCE) : 0,
    backfillResume: process.env.BACKFILL_RESUME !== '0',
    backfillStatePrefix: process.env.BACKFILL_STATE_PREFIX || 'backfill',
    projectionLimit: Number(process.env.PROJECTION_LIMIT || 1000),
    projectionSource: process.env.PROJECTION_SOURCE || 'queue',
    projectionWorkerId: process.env.PROJECTION_WORKER_ID || `projection:${os.hostname()}:${process.pid}`,
    projectionLockMs: Number(process.env.PROJECTION_LOCK_MS || 10 * 60 * 1000),
    projectionExternalRetryMs: Number(process.env.PROJECTION_EXTERNAL_RETRY_MS || 15 * 60 * 1000),
    updateProcessingStatus: process.env.UPDATE_PROCESSING_STATUS !== '0',
    liveDurationMs: Number(process.env.LIVE_DURATION_MS || 0),
    liveFlushLimit: Number(process.env.LIVE_FLUSH_LIMIT || 25),
    liveFlushIntervalMs: Number(process.env.LIVE_FLUSH_INTERVAL_MS || 5000),
    liveHeartbeatIntervalMs: Number(process.env.LIVE_HEARTBEAT_INTERVAL_MS || 30000),
    liveReconnectMinMs: Number(process.env.LIVE_RECONNECT_MIN_MS || 1000),
    liveReconnectMaxMs: Number(process.env.LIVE_RECONNECT_MAX_MS || 30000),
    liveSeenCacheLimit: Number(process.env.LIVE_SEEN_CACHE_LIMIT || 50000),
    liveConnectTimeoutMs: Number(process.env.LIVE_CONNECT_TIMEOUT_MS || 15000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = (flagName) => {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${flagName} requires a value.`);
      }
      return value;
    };
    if (arg === '--mode') args.mode = next('--mode');
    else if (arg === '--backfill') {
      args.mode = 'backfill';
      args.writeFirestore = true;
      args.out = null;
    }
    else if (arg === '--live-listen') {
      args.mode = 'live';
      args.writeFirestore = true;
      args.out = null;
    }
    else if (arg === '--project-directory') {
      args.mode = 'project';
      args.writeFirestore = true;
      args.out = null;
    }
    else if (arg === '--relays') args.relays = next('--relays').split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--out') args.out = next('--out');
    else if (arg === '--timeout-ms') args.timeoutMs = Number(next('--timeout-ms'));
    else if (arg === '--max-proofs') args.maxProofs = Number(next('--max-proofs'));
    else if (arg === '--firestore') args.writeFirestore = true;
    else if (arg === '--firestore-project') {
      args.firestoreProject = next('--firestore-project');
      args.writeFirestore = true;
    }
    else if (arg === '--firestore-database') args.firestoreDatabase = next('--firestore-database');
    else if (arg === '--firestore-entries-collection') args.firestoreEntriesCollection = next('--firestore-entries-collection');
    else if (arg === '--firestore-handles-collection') args.firestoreHandlesCollection = next('--firestore-handles-collection');
    else if (arg === '--firestore-backfill-runs-collection') args.firestoreBackfillRunsCollection = next('--firestore-backfill-runs-collection');
    else if (arg === '--firestore-projection-runs-collection') args.firestoreProjectionRunsCollection = next('--firestore-projection-runs-collection');
    else if (arg === '--firestore-live-runs-collection') args.firestoreLiveRunsCollection = next('--firestore-live-runs-collection');
    else if (arg === '--firestore-events-collection') args.firestoreEventsCollection = next('--firestore-events-collection');
    else if (arg === '--firestore-queue-collection') args.firestoreQueueCollection = next('--firestore-queue-collection');
    else if (arg === '--firestore-state-collection') args.firestoreStateCollection = next('--firestore-state-collection');
    else if (arg === '--firestore-gaps-collection') args.firestoreGapsCollection = next('--firestore-gaps-collection');
    else if (arg === '--backfill-page-limit') args.backfillPageLimit = Number(next('--backfill-page-limit'));
    else if (arg === '--backfill-max-page-limit') args.backfillMaxPageLimit = Number(next('--backfill-max-page-limit'));
    else if (arg === '--backfill-max-pages') args.backfillMaxPages = Number(next('--backfill-max-pages'));
    else if (arg === '--backfill-until') args.backfillUntil = Number(next('--backfill-until'));
    else if (arg === '--backfill-since') args.backfillSince = Number(next('--backfill-since'));
    else if (arg === '--no-backfill-resume') args.backfillResume = false;
    else if (arg === '--backfill-state-prefix') args.backfillStatePrefix = next('--backfill-state-prefix');
    else if (arg === '--projection-limit') args.projectionLimit = Number(next('--projection-limit'));
    else if (arg === '--projection-source') args.projectionSource = next('--projection-source');
    else if (arg === '--projection-worker-id') args.projectionWorkerId = next('--projection-worker-id');
    else if (arg === '--projection-lock-ms') args.projectionLockMs = Number(next('--projection-lock-ms'));
    else if (arg === '--projection-external-retry-ms') args.projectionExternalRetryMs = Number(next('--projection-external-retry-ms'));
    else if (arg === '--live-duration-ms') args.liveDurationMs = Number(next('--live-duration-ms'));
    else if (arg === '--live-flush-limit') args.liveFlushLimit = Number(next('--live-flush-limit'));
    else if (arg === '--live-flush-interval-ms') args.liveFlushIntervalMs = Number(next('--live-flush-interval-ms'));
    else if (arg === '--live-heartbeat-interval-ms') args.liveHeartbeatIntervalMs = Number(next('--live-heartbeat-interval-ms'));
    else if (arg === '--live-reconnect-min-ms') args.liveReconnectMinMs = Number(next('--live-reconnect-min-ms'));
    else if (arg === '--live-reconnect-max-ms') args.liveReconnectMaxMs = Number(next('--live-reconnect-max-ms'));
    else if (arg === '--live-seen-cache-limit') args.liveSeenCacheLimit = Number(next('--live-seen-cache-limit'));
    else if (arg === '--live-connect-timeout-ms') args.liveConnectTimeoutMs = Number(next('--live-connect-timeout-ms'));
    else if (arg === '--no-processing-status') args.updateProcessingStatus = false;
    else if (arg === '--no-json') args.out = null;
    else if (arg === '--no-tweet-verify') args.verifyTweets = false;
    else if (arg === '--no-zap-check') args.checkZaps = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['backfill', 'project', 'live'].includes(args.mode)) {
    throw new Error('--mode must be backfill, project, or live.');
  }
  if (!args.relays.length) throw new Error('At least one relay is required.');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('--timeout-ms must be positive.');
  if (!Number.isFinite(args.maxProofs) || args.maxProofs < 0) throw new Error('--max-proofs must be >= 0.');
  if (!Number.isFinite(args.backfillPageLimit) || args.backfillPageLimit <= 0) {
    throw new Error('--backfill-page-limit must be positive.');
  }
  if (!Number.isFinite(args.backfillMaxPageLimit) || args.backfillMaxPageLimit < args.backfillPageLimit) {
    throw new Error('--backfill-max-page-limit must be >= --backfill-page-limit.');
  }
  if (!Number.isFinite(args.backfillMaxPages) || args.backfillMaxPages <= 0) {
    throw new Error('--backfill-max-pages must be positive.');
  }
  if (!Number.isFinite(args.backfillUntil) || args.backfillUntil <= 0) {
    throw new Error('--backfill-until must be a positive unix timestamp.');
  }
  if (!Number.isFinite(args.backfillSince) || args.backfillSince < 0) {
    throw new Error('--backfill-since must be a unix timestamp >= 0.');
  }
  if (!args.backfillStatePrefix || /[\/#?]/.test(args.backfillStatePrefix)) {
    throw new Error('--backfill-state-prefix must be non-empty and must not contain /, #, or ?.');
  }
  if (!Number.isFinite(args.projectionLimit) || args.projectionLimit <= 0) {
    throw new Error('--projection-limit must be positive.');
  }
  if (!['queue', 'raw'].includes(args.projectionSource)) {
    throw new Error('--projection-source must be queue or raw.');
  }
  if (!args.projectionWorkerId) {
    throw new Error('--projection-worker-id must be non-empty.');
  }
  if (!Number.isFinite(args.projectionLockMs) || args.projectionLockMs <= 0) {
    throw new Error('--projection-lock-ms must be positive.');
  }
  if (!Number.isFinite(args.projectionExternalRetryMs) || args.projectionExternalRetryMs <= 0) {
    throw new Error('--projection-external-retry-ms must be positive.');
  }
  if (!Number.isFinite(args.liveDurationMs) || args.liveDurationMs < 0) {
    throw new Error('--live-duration-ms must be >= 0. Use 0 to run until stopped.');
  }
  if (!Number.isFinite(args.liveFlushLimit) || args.liveFlushLimit <= 0) {
    throw new Error('--live-flush-limit must be positive.');
  }
  if (!Number.isFinite(args.liveFlushIntervalMs) || args.liveFlushIntervalMs <= 0) {
    throw new Error('--live-flush-interval-ms must be positive.');
  }
  if (!Number.isFinite(args.liveHeartbeatIntervalMs) || args.liveHeartbeatIntervalMs <= 0) {
    throw new Error('--live-heartbeat-interval-ms must be positive.');
  }
  if (!Number.isFinite(args.liveReconnectMinMs) || args.liveReconnectMinMs <= 0) {
    throw new Error('--live-reconnect-min-ms must be positive.');
  }
  if (!Number.isFinite(args.liveReconnectMaxMs) || args.liveReconnectMaxMs < args.liveReconnectMinMs) {
    throw new Error('--live-reconnect-max-ms must be >= --live-reconnect-min-ms.');
  }
  if (!Number.isFinite(args.liveSeenCacheLimit) || args.liveSeenCacheLimit <= 0) {
    throw new Error('--live-seen-cache-limit must be positive.');
  }
  if (!Number.isFinite(args.liveConnectTimeoutMs) || args.liveConnectTimeoutMs <= 0) {
    throw new Error('--live-connect-timeout-ms must be positive.');
  }
  if ((args.writeFirestore || args.mode === 'backfill' || args.mode === 'project' || args.mode === 'live') && !args.firestoreProject) {
    throw new Error('--firestore-project or GOOGLE_CLOUD_PROJECT is required for backfill/project/live modes.');
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run crawl:directory -- [options]

Build a verified X/Twitter -> Nostr directory from stored relay data.

Requires Node.js 22+ for the native WebSocket client used to query relays.

Options:
  --mode <backfill|project|live>
                             Run historical backfill, Firestore projection, or live listener. Default: project
  --backfill                 Shorthand for --mode backfill --firestore --no-json.
  --live-listen              Shorthand for --mode live --firestore --no-json.
  --project-directory        Shorthand for --mode project --firestore --no-json.
  --relays <csv>             Relays to query. Default: ${DEFAULT_RELAYS.join(',')}
  --out <file>               JSON output path. Default: ${DEFAULT_OUT}
  --timeout-ms <n>           Per-relay timeout. Default: 12000
  --max-proofs <n>           Max proof tweets to verify; 0 means all. Default: 250
  --firestore                Enable Firestore writes.
  --firestore-project <id>   GCP project for Firestore. Implies --firestore.
  --firestore-database <id>  Firestore database id. Default: (default)
  --firestore-entries-collection <name>
                             Per-directory-record collection. Default: ${DEFAULT_FIRESTORE_ENTRIES_COLLECTION}
  --firestore-handles-collection <name>
                             Per-handle summary collection. Default: ${DEFAULT_FIRESTORE_HANDLES_COLLECTION}
  --firestore-backfill-runs-collection <name>
                             Backfill run summary collection. Default: ${DEFAULT_FIRESTORE_BACKFILL_RUNS_COLLECTION}
  --firestore-projection-runs-collection <name>
                             Projection run summary collection. Default: ${DEFAULT_FIRESTORE_PROJECTION_RUNS_COLLECTION}
  --firestore-live-runs-collection <name>
                             Live listener run summary collection. Default: ${DEFAULT_FIRESTORE_LIVE_RUNS_COLLECTION}
  --firestore-events-collection <name>
                             Raw event collection for backfill. Default: ${DEFAULT_FIRESTORE_EVENTS_COLLECTION}
  --firestore-queue-collection <name>
                             Projection queue collection. Default: ${DEFAULT_FIRESTORE_QUEUE_COLLECTION}
  --firestore-state-collection <name>
                             Checkpoint collection for backfill/listeners. Default: ${DEFAULT_FIRESTORE_STATE_COLLECTION}
  --firestore-gaps-collection <name>
                             Known backfill gap collection. Default: ${DEFAULT_FIRESTORE_GAPS_COLLECTION}
  --backfill-page-limit <n>  Events requested per relay/kind page. Default: 500
  --backfill-max-page-limit <n>
                             Largest retry page size for stuck same-timestamp pages. Default: 2000
  --backfill-max-pages <n>   Max pages per relay/kind in this process. Default: 25
  --backfill-until <unix>    Start cursor for historical crawl. Default: now
  --backfill-since <unix>    Stop after events older than this timestamp. Default: 0
  --no-backfill-resume       Ignore stored Firestore cursor and start from --backfill-until.
  --backfill-state-prefix <s>
                             Prefix for backfill checkpoint ids. Use "overlap" for live recovery windows.
  --projection-limit <n>     Max raw event docs read for directory projection. Default: 1000
  --projection-source <queue|raw>
                             Read projection work from queue or raw events. Default: queue
  --projection-worker-id <s> Worker id written to claimed queue docs. Default: host/process id
  --projection-lock-ms <n>   Queue claim lease duration. Default: 600000
  --projection-external-retry-ms <n>
                             Retry delay for temporary external proof failures. Default: 900000
  --live-duration-ms <n>     Live listener runtime before clean shutdown; 0 means until stopped. Default: 0
  --live-flush-limit <n>     Buffered valid events before Firestore flush. Default: 25
  --live-flush-interval-ms <n>
                             Max time between live event flushes. Default: 5000
  --live-heartbeat-interval-ms <n>
                             Live relay heartbeat interval. Default: 30000
  --live-reconnect-min-ms <n>
                             Initial relay reconnect delay. Default: 1000
  --live-reconnect-max-ms <n>
                             Max relay reconnect delay. Default: 30000
  --live-seen-cache-limit <n>
                             Max event ids remembered for live in-memory dedupe. Default: 50000
  --live-connect-timeout-ms <n>
                             Max time to wait for relay WebSocket open. Default: 15000
  --no-processing-status     Do not write processing fields back to raw event docs.
  --no-json                  Skip local JSON output.
  --no-tweet-verify          Extract candidates only; do not fetch X/Twitter.
  --no-zap-check             Skip LNURL/NIP-57 zappability checks.
`);
}

function queryRelay(url, filter, { timeoutMs, max }) {
  return new Promise((resolve) => {
    const events = [];
    const sub = `nc-${Math.random().toString(36).slice(2, 10)}`;
    let done = false;
    let ws;

    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {}
      resolve({ relay: url, events, reason });
    };

    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch (error) {
      finish(`constructor-error:${error.message}`);
      return;
    }

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['REQ', sub, { ...filter, limit: max }]));
    });
    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg[0] === 'EVENT' && msg[1] === sub && msg[2]?.id) {
        events.push(msg[2]);
        if (events.length >= max) finish('max');
      } else if (msg[0] === 'EOSE' && msg[1] === sub) {
        finish('eose');
      } else if (msg[0] === 'CLOSED' && msg[1] === sub) {
        finish(`closed:${msg[2] || ''}`);
      }
    });
    ws.addEventListener('error', () => finish('ws-error'));
    ws.addEventListener('close', () => finish('close'));
  });
}

function latestReplaceable(events) {
  const latest = new Map();
  for (const event of events) {
    if (!isValidSignedEvent(event)) continue;
    const key = `${event.kind}:${event.pubkey}`;
    const previous = latest.get(key);
    if (!previous || event.created_at > previous.created_at) latest.set(key, event);
  }
  return [...latest.values()];
}

function isValidSignedEvent(event) {
  try {
    return validateEvent(event) && verifyEvent(event);
  } catch {
    return false;
  }
}

function normalizeTwitterHandle(value) {
  if (!value) return null;
  let handle = String(value).trim();
  const urlMatch = handle.match(X_PROFILE_LINK);
  if (urlMatch) handle = urlMatch[1];
  handle = handle.replace(/^@/, '').split(/[/?#\s]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  if (RESERVED_X_PATHS.has(handle.toLowerCase())) return null;
  return handle.toLowerCase();
}

function extractTweetId(value) {
  const match = String(value || '').match(TWEET_ID);
  return match ? match[1] : null;
}

function safeJson(content) {
  try {
    return JSON.parse(content || '{}');
  } catch {
    return {};
  }
}

function hexToNpub(hex) {
  return nip19.npubEncode(hex);
}

function extractDirectoryInputs(events) {
  const candidatesByKey = new Map();
  const claimedByKey = new Map();
  const metadataByPubkey = new Map();

  for (const event of events) {
    const metadata = event.kind === 0 ? safeJson(event.content) : null;
    if (metadata) {
      metadataByPubkey.set(event.pubkey, {
        pubkey: event.pubkey,
        npub: hexToNpub(event.pubkey),
        name: metadata.name || metadata.display_name || null,
        nip05: metadata.nip05 || null,
        lud16: metadata.lud16 || null,
        lud06: metadata.lud06 || null,
        website: metadata.website || null,
        about: metadata.about || null,
      });
    }

    for (const tag of event.tags || []) {
      if (tag[0] !== 'i' || !tag[1]) continue;
      const tagMatch = String(tag[1]).match(TWITTER_TAG);
      if (!tagMatch) continue;

      const handle = normalizeTwitterHandle(tagMatch[1]);
      const proofTweetId = extractTweetId(tag[2]);
      if (!handle || !proofTweetId) continue;

      const key = `${handle}:${event.pubkey}:${proofTweetId}`;
      candidatesByKey.set(key, {
        platform: 'twitter',
        handle,
        pubkey: event.pubkey,
        npub: hexToNpub(event.pubkey),
        proofTweetId,
        sourceKind: event.kind,
        sourceEventId: event.id,
        sourceCreatedAt: event.created_at,
      });
    }

    if (!metadata) continue;
    for (const field of ['website', 'about']) {
      const match = String(metadata[field] || '').match(X_PROFILE_LINK);
      const handle = normalizeTwitterHandle(match?.[1]);
      if (!handle) continue;
      const key = `${handle}:${event.pubkey}:${field}`;
      claimedByKey.set(key, {
        platform: 'twitter',
        handle,
        pubkey: event.pubkey,
        npub: hexToNpub(event.pubkey),
        source: `kind0.${field}`,
        sourceKind: event.kind,
        sourceEventId: event.id,
        sourceCreatedAt: event.created_at,
        identityStatus: 'claimed',
      });
    }
  }

  return {
    candidates: [...candidatesByKey.values()].sort(sortCandidate),
    claimed: [...claimedByKey.values()].sort(sortClaim),
    metadataByPubkey,
  };
}

function sortCandidate(a, b) {
  return a.handle.localeCompare(b.handle) || a.pubkey.localeCompare(b.pubkey);
}

function sortClaim(a, b) {
  return a.handle.localeCompare(b.handle) || a.source.localeCompare(b.source);
}

function syndicationToken(tweetId) {
  try {
    const id = BigInt(tweetId);
    const divisor = 1000000000000000n;
    const scaled = Number(id / divisor) + Number(id % divisor) / Number(divisor);
    return (scaled * Math.PI).toString(36).replace(/(0+|\.)/g, '') || 'a';
  } catch {
    return 'a';
  }
}

async function fetchTweet(tweetId, handleHint, timeoutMs) {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  const failures = [];
  if (bearerToken) {
    const official = await fetchTweetViaXApi(tweetId, bearerToken, timeoutMs);
    if (official.ok) return official;
    failures.push(official);
    if (official.retryable && official.rateLimited) return official;
  }

  const syndication = await fetchTweetViaSyndication(tweetId, timeoutMs);
  if (syndication.ok) return syndication;
  failures.push(syndication);
  if (syndication.retryable && syndication.rateLimited) return syndication;

  const oembed = await fetchTweetViaOembed(tweetId, handleHint, timeoutMs);
  if (oembed.ok) return oembed;
  failures.push(oembed);

  return mostImportantTweetFetchFailure(failures);
}

async function fetchTweetViaXApi(tweetId, bearerToken, timeoutMs) {
  try {
    const params = new URLSearchParams({
      expansions: 'author_id',
      'tweet.fields': 'author_id,text',
      'user.fields': 'username',
    });
    const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return tweetFetchHttpFailure('x-api', response);
    const json = await response.json();
    const user = json.includes?.users?.find((candidate) => candidate.id === json.data?.author_id);
    if (!json.data?.text || !user?.username) {
      return tweetFetchFailure('x-api', 'tweet_unavailable', { retryable: false });
    }
    return {
      ok: true,
      tweet: {
        text: json.data.text,
        handle: user.username,
        userId: user.id,
        source: 'x-api',
      },
    };
  } catch (error) {
    return tweetFetchFailure('x-api', fetchErrorReason(error), { retryable: true });
  }
}

async function fetchTweetViaSyndication(tweetId, timeoutMs) {
  const failures = [];
  for (const token of [syndicationToken(tweetId), 'a']) {
    try {
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const failure = tweetFetchHttpFailure('syndication', response);
        failures.push(failure);
        if (failure.retryable && failure.rateLimited) return failure;
        continue;
      }
      const json = await response.json();
      if (!json?.text || !json.user?.screen_name) continue;
      return {
        ok: true,
        tweet: {
          text: json.text,
          handle: json.user.screen_name,
          userId: json.user.id_str || json.user.id || null,
          source: 'syndication',
        },
      };
    } catch (error) {
      failures.push(tweetFetchFailure('syndication', fetchErrorReason(error), { retryable: true }));
    }
  }
  return mostImportantTweetFetchFailure(failures, tweetFetchFailure('syndication', 'tweet_unavailable', { retryable: false }));
}

async function fetchTweetViaOembed(tweetId, handleHint, timeoutMs) {
  try {
    const tweetUrl = `https://twitter.com/${handleHint || 'i'}/status/${tweetId}`;
    const url = `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(tweetUrl)}`;
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return tweetFetchHttpFailure('oembed', response);
    const json = await response.json();
    const handle = normalizeTwitterHandle(json.author_url);
    const text = stripHtml(json.html || '');
    if (!handle || !text) return tweetFetchFailure('oembed', 'tweet_unavailable', { retryable: false });
    return {
      ok: true,
      tweet: {
        text,
        handle,
        userId: null,
        source: 'oembed',
      },
    };
  } catch (error) {
    return tweetFetchFailure('oembed', fetchErrorReason(error), { retryable: true });
  }
}

function tweetFetchHttpFailure(source, response) {
  const status = response.status;
  const rateLimitResetAt = response.headers?.get?.('x-rate-limit-reset') || null;
  const retryAfter = response.headers?.get?.('retry-after') || null;
  const retryable = status === 429 || status === 408 || status >= 500;
  return tweetFetchFailure(source, status === 429 ? 'rate_limited' : `http_${status}`, {
    retryable,
    rateLimited: status === 429,
    status,
    rateLimitResetAt,
    retryAfter,
  });
}

function tweetFetchFailure(source, reason, extra = {}) {
  return {
    ok: false,
    source,
    reason,
    retryable: Boolean(extra.retryable),
    rateLimited: Boolean(extra.rateLimited),
    status: extra.status || null,
    rateLimitResetAt: extra.rateLimitResetAt || null,
    retryAfter: extra.retryAfter || null,
  };
}

function mostImportantTweetFetchFailure(failures, fallback = null) {
  const candidates = failures.filter(Boolean);
  return candidates.find((failure) => failure.rateLimited)
    || candidates.find((failure) => failure.retryable)
    || candidates[0]
    || fallback
    || tweetFetchFailure('unknown', 'tweet_unavailable', { retryable: false });
}

function fetchErrorReason(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return 'network_error';
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function verifyCandidate(candidate, timeoutMs) {
  const result = await fetchTweet(candidate.proofTweetId, candidate.handle, timeoutMs);
  if (!result.ok) {
    if (result.retryable) {
      return {
        ...candidate,
        identityStatus: 'retry_later',
        retryReason: result.reason,
        retrySource: result.source,
        retryRateLimited: result.rateLimited,
        rateLimitResetAt: result.rateLimitResetAt,
        retryAfter: result.retryAfter,
      };
    }
    return { ...candidate, identityStatus: 'rejected', rejectionReason: 'proof-tweet-unavailable' };
  }

  const tweet = result.tweet;
  const tweetHandle = normalizeTwitterHandle(tweet.handle);
  if (tweetHandle !== candidate.handle) {
    return {
      ...candidate,
      identityStatus: 'rejected',
      rejectionReason: 'proof-author-mismatch',
      proofAuthor: tweetHandle,
      proofSource: tweet.source,
      xUserId: tweet.userId,
    };
  }

  if (!tweet.text.includes(candidate.npub)) {
    return {
      ...candidate,
      identityStatus: 'rejected',
      rejectionReason: 'npub-not-in-proof-tweet',
      proofAuthor: tweetHandle,
      proofSource: tweet.source,
      xUserId: tweet.userId,
    };
  }

  return {
    ...candidate,
    identityStatus: 'verified',
    proofAuthor: tweetHandle,
    proofSource: tweet.source,
    xUserId: tweet.userId,
    verifiedAt: new Date().toISOString(),
  };
}

function getMetadata(metadataByPubkey, pubkey) {
  return metadataByPubkey.get(pubkey) || {
    pubkey,
    npub: hexToNpub(pubkey),
    name: null,
    nip05: null,
    lud16: null,
    lud06: null,
    website: null,
    about: null,
  };
}

async function checkZapSupport(record, metadata, timeoutMs) {
  const lightningAddress = metadata.lud16 || null;
  if (!lightningAddress) {
    return { ...record, lud16: null, zappable: false, zapReason: 'missing-lud16' };
  }

  const lnurlp = lightningAddressToLnurlp(lightningAddress);
  if (!lnurlp) {
    return { ...record, lud16: lightningAddress, zappable: false, zapReason: 'invalid-lud16' };
  }

  try {
    const response = await fetch(lnurlp, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { ...record, lud16: lightningAddress, zappable: false, zapReason: `lnurl-http-${response.status}` };
    }
    const json = await response.json();
    const zappable = json.allowsNostr === true && isHexPubkey(json.nostrPubkey);
    return {
      ...record,
      lud16: lightningAddress,
      lnurlp,
      zappable,
      zapReason: zappable ? 'nip57-ready' : 'lnurl-does-not-allow-nostr',
      lnurlAllowsNostr: json.allowsNostr === true,
      lnurlNostrPubkey: isHexPubkey(json.nostrPubkey) ? json.nostrPubkey : null,
    };
  } catch {
    return { ...record, lud16: lightningAddress, lnurlp, zappable: false, zapReason: 'lnurl-fetch-failed' };
  }
}

function lightningAddressToLnurlp(lud16) {
  const parts = String(lud16 || '').trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return `https://${parts[1]}/.well-known/lnurlp/${encodeURIComponent(parts[0])}`;
}

function isHexPubkey(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ''));
}

function computeWotScores(records, allEvents) {
  const followers = new Map();
  const reports = new Map();
  const assertions = new Map();

  for (const event of allEvents) {
    if (!isValidSignedEvent(event)) continue;

    if (event.kind === 3) {
      for (const tag of event.tags || []) {
        if (tag[0] !== 'p' || !isHexPubkey(tag[1])) continue;
        followers.set(tag[1], (followers.get(tag[1]) || 0) + 1);
      }
    }

    if (event.kind === 1984) {
      for (const tag of event.tags || []) {
        if (tag[0] !== 'p' || !isHexPubkey(tag[1])) continue;
        reports.set(tag[1], (reports.get(tag[1]) || 0) + 1);
      }
    }

    if (event.kind === 30382) {
      const target = event.tags?.find((tag) => tag[0] === 'd' && isHexPubkey(tag[1]))?.[1];
      if (!target) continue;
      const rank = numericTag(event.tags, 'rank');
      const followerCount = numericTag(event.tags, 'followers');
      const current = assertions.get(target) || { rank: null, followers: null, assertionCount: 0 };
      assertions.set(target, {
        rank: Math.max(current.rank || 0, rank || 0) || null,
        followers: Math.max(current.followers || 0, followerCount || 0) || null,
        assertionCount: current.assertionCount + 1,
      });
    }
  }

  return records.map((record) => {
    const followerCount = followers.get(record.pubkey) || 0;
    const reportCount = reports.get(record.pubkey) || 0;
    const assertion = assertions.get(record.pubkey) || { rank: null, followers: null, assertionCount: 0 };
    const followScore = Math.min(35, Math.log10(followerCount + 1) * 18);
    const assertionScore = assertion.rank ? Math.min(35, assertion.rank * 0.35) : 0;
    const activityScore = assertion.followers ? Math.min(20, Math.log10(assertion.followers + 1) * 7) : 0;
    const proofScore = record.identityStatus === 'verified' ? 10 : 0;
    const penalty = Math.min(40, reportCount * 10);
    const score = Math.max(0, Math.min(100, Math.round(followScore + assertionScore + activityScore + proofScore - penalty)));

    return {
      ...record,
      wot: {
        score,
        followerGraphMentions: followerCount,
        nip85Rank: assertion.rank,
        nip85Followers: assertion.followers,
        nip85AssertionCount: assertion.assertionCount,
        reportCount,
        note: 'WoT is a ranking/risk signal only; it is not identity proof.',
      },
    };
  });
}

function numericTag(tags, name) {
  const value = tags?.find((tag) => tag[0] === name)?.[1];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function runCrawler(args) {
  if (args.mode === 'backfill') return runBackfill(args);
  if (args.mode === 'project') return runProjection(args);
  if (args.mode === 'live') return runLiveListener(args);
  throw new Error(`Unsupported mode: ${args.mode}`);
}

async function buildDirectoryOutputFromEvents({ events, args, relayResults = null, source = 'events' }) {
  const profileEvents = latestReplaceable(events);
  const { candidates, claimed, metadataByPubkey } = extractDirectoryInputs(profileEvents);
  const proofLimit = args.maxProofs === 0 ? candidates.length : Math.min(args.maxProofs, candidates.length);

  console.log(`Found ${profileEvents.length} latest profile/identity events.`);
  console.log(`Detected ${candidates.length} verifiable Twitter proof candidates and ${claimed.length} claimed-only leads.`);

  const verifiedOrRejected = [];
  const retryLater = [];
  let proofVerificationStoppedReason = null;
  let proofTweetsAttempted = 0;
  if (args.verifyTweets) {
    console.log(`Verifying ${proofLimit}/${candidates.length} proof tweets...`);
    for (const candidate of candidates.slice(0, proofLimit)) {
      proofTweetsAttempted += 1;
      const result = await verifyCandidate(candidate, args.timeoutMs);
      if (result.identityStatus === 'retry_later') {
        retryLater.push(result);
        if (result.retryRateLimited) {
          proofVerificationStoppedReason = 'x_rate_limited';
          break;
        }
      } else {
        verifiedOrRejected.push(result);
      }
    }
    for (const candidate of candidates.slice(proofTweetsAttempted)) {
      retryLater.push({
        ...candidate,
        identityStatus: 'retry_later',
        retryReason: proofVerificationStoppedReason || 'max_proof_limit_reached',
        retrySource: 'crawler',
        retryRateLimited: proofVerificationStoppedReason === 'x_rate_limited',
      });
    }
  } else {
    verifiedOrRejected.push(...candidates.map((candidate) => ({ ...candidate, identityStatus: 'candidate' })));
  }

  let verified = verifiedOrRejected.filter((record) => record.identityStatus === 'verified');
  const rejected = verifiedOrRejected.filter((record) => record.identityStatus === 'rejected');

  verified = verified.map((record) => ({
    ...record,
    metadata: getMetadata(metadataByPubkey, record.pubkey),
  }));

  if (args.checkZaps && verified.length) {
    console.log(`Checking NIP-57 zappability for ${verified.length} verified records...`);
    const checked = [];
    for (const record of verified) {
      checked.push(await checkZapSupport(record, record.metadata, args.timeoutMs));
    }
    verified = checked;
  }

  let allDirectoryRecords = [
    ...verified.map((record) => ({
      ...record,
      directoryStatus: record.zappable ? 'verified_zappable' : 'verified_not_zappable',
    })),
    ...claimed.map((record) => ({
      ...record,
      metadata: getMetadata(metadataByPubkey, record.pubkey),
      directoryStatus: 'claimed_unverified',
      zappable: false,
      autoZapAllowed: false,
    })),
  ];

  allDirectoryRecords = allDirectoryRecords.map((record) => ({
    ...record,
    autoZapAllowed: record.identityStatus === 'verified' && record.zappable === true,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    source,
    strategy: {
      identityProof: 'NIP-39 kind:10011 i tags, with legacy kind:0 i tags accepted',
      proofVerification: args.verifyTweets
        ? 'proof tweet must be authored by handle and contain exact npub'
        : 'disabled by --no-tweet-verify',
      proofVerificationStoppedReason,
      zapPolicy: 'auto-zap requires verified identity and LNURL allowsNostr',
      wotPolicy: 'WoT/NIP-85 is ranking and risk only, never identity proof',
    },
    relays: args.relays,
    relayResults,
    stats: {
      profileEvents: profileEvents.length,
      verifiableCandidates: candidates.length,
      proofTweetsPlanned: args.verifyTweets ? proofLimit : 0,
      proofTweetsAttempted,
      proofTweetsChecked: proofTweetsAttempted,
      proofRetriesScheduled: retryLater.length,
      proofVerificationStopped: Boolean(proofVerificationStoppedReason),
      verified: verified.length,
      rejected: rejected.length,
      claimedOnly: claimed.length,
      zappableVerified: verified.filter((record) => record.zappable).length,
      autoZapAllowed: allDirectoryRecords.filter((record) => record.autoZapAllowed).length,
    },
    directory: allDirectoryRecords.sort(sortDirectoryRecord),
    rejected,
    retryLater,
  };

  return output;
}

async function runBackfill(args, FirestoreCtor = Firestore) {
  const runMetrics = createRunMetrics('backfill');
  await assertFirestoreCredentialsAvailable();
  const db = new FirestoreCtor({
    projectId: args.firestoreProject,
    databaseId: args.firestoreDatabase,
  });
  const startedAt = new Date().toISOString();
  const totals = {
    relayKindCursors: 0,
    pages: 0,
    relayEvents: 0,
    validEvents: 0,
    uniqueEventsWritten: 0,
    completedCursors: 0,
    gapsWritten: 0,
  };
  const cursorSummaries = [];

  console.log(
    `Backfilling ${BACKFILL_KINDS.join(',')} from ${args.relays.length} relays into ${args.firestoreProject}/${args.firestoreDatabase}...`
  );

  for (const relay of args.relays) {
    for (const kind of BACKFILL_KINDS) {
      totals.relayKindCursors += 1;
      const summary = await runBackfillCursor(db, relay, kind, args);
      totals.pages += summary.pages;
      totals.relayEvents += summary.relayEvents;
      totals.validEvents += summary.validEvents;
      totals.uniqueEventsWritten += summary.uniqueEventsWritten;
      totals.gapsWritten += summary.gapsWritten;
      if (summary.completed) totals.completedCursors += 1;
      cursorSummaries.push(summary);
    }
  }

  const output = {
    mode: 'backfill',
    run: finishRunMetrics(runMetrics, totals),
    startedAt,
    finishedAt: new Date().toISOString(),
    relays: args.relays,
    kinds: BACKFILL_KINDS,
    stats: totals,
    cursors: cursorSummaries,
      firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      eventsCollection: args.firestoreEventsCollection,
      queueCollection: args.firestoreQueueCollection,
      stateCollection: args.firestoreStateCollection,
      gapsCollection: args.firestoreGapsCollection,
    },
  };

  await commitFirestoreWrites(db, [buildRunSummaryWrite(output.run, output, args.firestoreBackfillRunsCollection)]);
  logRunSummary(output.run);

  if (args.out) await writeJson(args.out, output);
  printBackfillSummary(output, args);
  return output;
}

async function runProjection(args, FirestoreCtor = Firestore) {
  const runMetrics = createRunMetrics('projection');
  await assertFirestoreCredentialsAvailable();
  const db = new FirestoreCtor({
    projectId: args.firestoreProject,
    databaseId: args.firestoreDatabase,
  });

  console.log(
    `Projecting up to ${args.projectionLimit} identity events from ${args.projectionSource}...`
  );

  const queueStatusCountsBefore = args.projectionSource === 'queue'
    ? await countProjectionQueueStatuses(db, args)
    : null;
  const queueDocs = args.projectionSource === 'queue' ? await claimProjectionQueueDocs(db, args) : [];
  const rawRead = args.projectionSource === 'queue'
    ? await readRawIdentityEventDocsForQueue(db, queueDocs, args)
    : { rawDocs: await readRawIdentityEventDocs(db, args), missingQueueDocs: [] };
  const rawDocs = rawRead.rawDocs;
  const eventDocs = rawDocs.map((doc) => ({
    ...doc,
    event: firestoreRawDocToNostrEvent(doc.data),
  }));
  const validRawDocs = eventDocs.filter((doc) => doc.event && isValidSignedEvent(doc.event));
  const invalidRawDocs = eventDocs.filter((doc) => !doc.event || !isValidSignedEvent(doc.event));
  const events = validRawDocs.map((doc) => doc.event);

  const output = await buildDirectoryOutputFromEvents({
    events,
    args: { ...args, includeWot: false },
    relayResults: null,
    source: 'firestore-projection',
  });
  output.firestore = {
    project: args.firestoreProject,
    database: args.firestoreDatabase,
    eventsCollection: args.firestoreEventsCollection,
    queueCollection: args.firestoreQueueCollection,
    entriesCollection: args.firestoreEntriesCollection,
    handlesCollection: args.firestoreHandlesCollection,
  };
  output.stats.rawEventDocsRead = rawDocs.length;
  output.stats.missingRawEventDocs = rawRead.missingQueueDocs.length;
  output.stats.invalidRawEventDocs = invalidRawDocs.length;
  output.stats.queueDocsRead = queueDocs.length;
  output.stats.validRawEvents = events.length;
  output.stats.queueStatusCountsBefore = queueStatusCountsBefore;
  output.run = finishRunMetrics(runMetrics, {
    queueDocsRead: queueDocs.length,
    queueDocsClaimed: queueDocs.length,
    rawEventDocsRead: rawDocs.length,
    missingRawEventDocs: rawRead.missingQueueDocs.length,
    invalidRawEventDocs: invalidRawDocs.length,
    validRawEvents: events.length,
    directoryRecords: output.directory.length,
    rejected: output.rejected.length,
    proofRetriesScheduled: output.stats.proofRetriesScheduled,
    proofVerificationStopped: output.stats.proofVerificationStopped,
    verified: output.stats.verified,
    claimedOnly: output.stats.claimedOnly,
    ...(queueStatusCountsBefore ? prefixObjectKeys(queueStatusCountsBefore, 'queueBefore') : {}),
  });

  const writes = [
    ...buildFirestoreWrites(output, args),
    ...(args.updateProcessingStatus ? buildProjectionProcessingWrites(validRawDocs, output, args) : []),
    ...(args.updateProcessingStatus ? buildProjectionQueueWrites(validRawDocs, output, args) : []),
    ...(args.updateProcessingStatus ? buildProjectionRawFailureWrites(invalidRawDocs, args) : []),
    ...(args.updateProcessingStatus ? buildProjectionQueueFailureWrites(rawRead.missingQueueDocs, 'missing_raw_event', args) : []),
    ...(args.updateProcessingStatus ? buildProjectionQueueFailureWrites(invalidRawDocs, 'invalid_raw_event', args) : []),
    buildRunSummaryWrite(output.run, output, args.firestoreProjectionRunsCollection),
  ];
  await commitFirestoreWrites(db, writes);
  logRunSummary(output.run);

  if (args.out) await writeJson(args.out, output);
  printSummary(output, args);
  console.log(`  raw event docs read:  ${rawDocs.length}`);
  console.log(`  queue docs read:      ${queueDocs.length}`);
  console.log(`  valid raw events:     ${events.length}`);
  console.log(`  firestore events:     ${args.firestoreEventsCollection}`);
  return output;
}

async function runLiveListener(args, FirestoreCtor = Firestore) {
  const runMetrics = createRunMetrics('live-listener');
  await assertFirestoreCredentialsAvailable();
  const db = new FirestoreCtor({
    projectId: args.firestoreProject,
    databaseId: args.firestoreDatabase,
  });
  const startedAt = new Date().toISOString();
  const stopController = new AbortController();
  const totals = {
    relayCount: args.relays.length,
    connectAttempts: 0,
    reconnects: 0,
    relayDisconnects: 0,
    relayErrors: 0,
    eventsReceived: 0,
    validEventsBuffered: 0,
    validEventsWritten: 0,
    invalidEventsDropped: 0,
    duplicateEvents: 0,
    flushes: 0,
    heartbeatWrites: 0,
  };
  const seenEventIds = new Set();
  const seenEventIdQueue = [];
  const buffer = [];
  let stopReason = 'stopped';
  let flushInFlight = Promise.resolve();

  const stop = (reason) => {
    if (stopController.signal.aborted) return;
    stopReason = reason;
    stopController.abort(reason);
  };

  const signalHandlers = [];
  if (typeof process !== 'undefined') {
    for (const signalName of ['SIGINT', 'SIGTERM']) {
      const handler = () => stop(signalName);
      process.once(signalName, handler);
      signalHandlers.push([signalName, handler]);
    }
  }

  let durationTimer = null;
  if (args.liveDurationMs > 0) {
    durationTimer = setTimeout(() => stop('duration_elapsed'), args.liveDurationMs);
  }

  const flushBuffer = async () => {
    if (!buffer.length) return;
    const writes = buffer.slice();
    const rawEventWrites = writes.filter((write) => write.collection === args.firestoreEventsCollection && !write.operation).length;
    await commitFirestoreWrites(db, writes);
    buffer.splice(0, writes.length);
    totals.validEventsWritten += rawEventWrites;
    totals.flushes += 1;
  };

  const scheduleFlush = () => {
    flushInFlight = flushInFlight.then(flushBuffer, flushBuffer);
    return flushInFlight;
  };

  const flushInterval = setInterval(() => {
    scheduleFlush();
  }, args.liveFlushIntervalMs);

  console.log(
    `Listening to ${args.relays.length} relays for live kinds ${LIVE_LISTENER_KINDS.join(',')} into ${args.firestoreProject}/${args.firestoreDatabase}...`
  );

  const listeners = args.relays.map((relay) => listenRelayLive(relay, args, {
    signal: stopController.signal,
    onConnectAttempt: () => {
      totals.connectAttempts += 1;
    },
    onReconnect: () => {
      totals.reconnects += 1;
    },
    onDisconnect: () => {
      totals.relayDisconnects += 1;
    },
    onError: () => {
      totals.relayErrors += 1;
    },
    onEvent: (event) => {
      totals.eventsReceived += 1;
      if (!isValidSignedEvent(event)) {
        totals.invalidEventsDropped += 1;
        return;
      }
      if (seenEventIds.has(event.id)) {
        totals.duplicateEvents += 1;
        return;
      }
      rememberSeenEventId(event.id, seenEventIds, seenEventIdQueue, args.liveSeenCacheLimit);
      buffer.push(...buildRawEventIngestionWrites(event, relay, 'live', args));
      totals.validEventsBuffered += 1;
      if (buffer.length >= args.liveFlushLimit) scheduleFlush();
    },
    onHeartbeat: async (status) => {
      await commitFirestoreWrites(db, [buildLiveHeartbeatWrite(status, args)]);
      totals.heartbeatWrites += 1;
    },
  }));

  await Promise.all(listeners);
  clearInterval(flushInterval);
  if (durationTimer) clearTimeout(durationTimer);
  await scheduleFlush();

  for (const [signalName, handler] of signalHandlers) {
    process.removeListener(signalName, handler);
  }

  const output = {
    mode: 'live',
    run: finishRunMetrics(runMetrics, totals),
    startedAt,
    finishedAt: new Date().toISOString(),
    stopReason,
    relays: args.relays,
    kinds: LIVE_LISTENER_KINDS,
    stats: totals,
    firestore: {
      project: args.firestoreProject,
      database: args.firestoreDatabase,
      eventsCollection: args.firestoreEventsCollection,
      queueCollection: args.firestoreQueueCollection,
      stateCollection: args.firestoreStateCollection,
    },
  };

  await commitFirestoreWrites(db, [buildRunSummaryWrite(output.run, output, args.firestoreLiveRunsCollection)]);
  logRunSummary(output.run);
  if (args.out) await writeJson(args.out, output);
  printLiveSummary(output, args);
  return output;
}

function listenRelayLive(relay, args, callbacks) {
  const {
    signal,
    onConnectAttempt,
    onReconnect,
    onDisconnect,
    onError,
    onEvent,
    onHeartbeat,
  } = callbacks;

  return new Promise((resolve) => {
    let ws = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let connectTimer = null;
    let reconnectDelay = args.liveReconnectMinMs;
    let attempts = 0;
    let connected = false;
    let lastEventAt = null;
    let stopped = false;

    const cleanup = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (connectTimer) clearTimeout(connectTimer);
      try {
        ws?.close();
      } catch {}
      ws = null;
    };

    const heartbeat = async (status) => {
      if (!onHeartbeat) return;
      await onHeartbeat({
        relay,
        status,
        mode: 'live',
        connected,
        lastEventAt,
        attempts,
      });
    };

    const finish = async () => {
      if (stopped) return;
      stopped = true;
      cleanup();
      await heartbeat('stopped').catch(() => {});
      resolve();
    };

    const scheduleReconnect = () => {
      if (signal.aborted || stopped) {
        finish();
        return;
      }
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, args.liveReconnectMaxMs);
      onReconnect?.();
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (signal.aborted || stopped) {
        finish();
        return;
      }
      attempts += 1;
      onConnectAttempt?.();
      const sub = `nc-live-${Math.random().toString(36).slice(2, 10)}`;

      try {
        ws = new WebSocket(relay);
      } catch {
        onError?.();
        scheduleReconnect();
        return;
      }

      connectTimer = setTimeout(() => {
        onError?.();
        try {
          ws?.close();
        } catch {}
      }, args.liveConnectTimeoutMs);

      ws.addEventListener('open', () => {
        if (connectTimer) clearTimeout(connectTimer);
        connected = true;
        reconnectDelay = args.liveReconnectMinMs;
        const since = Math.floor(Date.now() / 1000);
        ws.send(JSON.stringify(['REQ', sub, { kinds: LIVE_LISTENER_KINDS, since }]));
        heartbeat('connected').catch(() => {});
        heartbeatTimer = setInterval(() => {
          heartbeat(connected ? 'connected' : 'disconnected').catch(() => {});
        }, args.liveHeartbeatIntervalMs);
      });

      ws.addEventListener('message', (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg[0] === 'EVENT' && msg[1] === sub && msg[2]?.id) {
          lastEventAt = new Date().toISOString();
          onEvent?.(msg[2], relay);
        } else if (msg[0] === 'CLOSED' && msg[1] === sub) {
          try {
            ws.close();
          } catch {}
        }
      });

      ws.addEventListener('error', () => {
        onError?.();
      });

      ws.addEventListener('close', () => {
        if (connectTimer) clearTimeout(connectTimer);
        connected = false;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (stopped || signal.aborted) return;
        onDisconnect?.();
        heartbeat('disconnected').finally(scheduleReconnect);
      });
    };

    signal.addEventListener('abort', finish, { once: true });
    connect();
  });
}

async function readRawIdentityEventDocs(db, args) {
  const querySnapshot = await db
    .collection(args.firestoreEventsCollection)
    .orderBy('createdAt', 'desc')
    .limit(args.projectionLimit)
    .get();
  return querySnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function readProjectionQueueDocs(db, args) {
  const docs = [];
  const perStatusLimit = Math.ceil(args.projectionLimit / 3);

  for (const status of ['pending', 'retry_later', 'processing']) {
    const querySnapshot = await db
      .collection(args.firestoreQueueCollection)
      .where('status', '==', status)
      .limit(perStatusLimit)
      .get();
    docs.push(...querySnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));
    if (docs.length >= args.projectionLimit) break;
  }

  return docs
    .sort((a, b) => (firestoreTimestampToMs(a.data?.createdAt) || 0) - (firestoreTimestampToMs(b.data?.createdAt) || 0))
    .slice(0, args.projectionLimit);
}

async function countProjectionQueueStatuses(db, args) {
  const statuses = ['pending', 'retry_later', 'processing', 'done', 'ignored', 'failed'];
  const counts = {};
  await Promise.all(statuses.map(async (status) => {
    try {
      const snapshot = await db
        .collection(args.firestoreQueueCollection)
        .where('status', '==', status)
        .count()
        .get();
      counts[status] = snapshot.data().count || 0;
    } catch (error) {
      counts[status] = null;
      counts.countError = firestoreErrorSummary(error);
    }
  }));
  return counts;
}

async function claimProjectionQueueDocs(db, args) {
  const candidates = await readProjectionQueueDocs(db, args);
  const claimed = [];

  for (const candidate of candidates) {
    if (claimed.length >= args.projectionLimit) break;
    const claimedDoc = await claimProjectionQueueDoc(db, candidate, args);
    if (claimedDoc) claimed.push(claimedDoc);
  }

  return claimed;
}

async function claimProjectionQueueDoc(db, candidate, args) {
  const ref = db.collection(args.firestoreQueueCollection).doc(candidate.id);
  const nowMs = Date.now();
  const lockExpiresAt = new Date(nowMs + args.projectionLockMs);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (!queueDocIsClaimable(data, nowMs)) return null;

    transaction.set(ref, buildProjectionQueueClaimData(args.projectionWorkerId, lockExpiresAt), { merge: true });
    return {
      id: snapshot.id,
      data: {
        ...data,
        status: 'processing',
        lockedBy: args.projectionWorkerId,
        lockExpiresAt,
      },
    };
  });
}

function buildProjectionQueueClaimData(workerId, lockExpiresAt) {
  return stripUndefined({
    status: 'processing',
    lockedBy: workerId,
    lockExpiresAt,
    claimedAt: FieldValue.serverTimestamp(),
    attempts: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function queueDocIsClaimable(data, nowMs = Date.now()) {
  if (!data) return false;
  const status = data.status;
  if (!['pending', 'retry_later', 'processing'].includes(status)) return false;

  const nextAttemptAtMs = firestoreTimestampToMs(data.nextAttemptAt);
  if (status === 'retry_later' && nextAttemptAtMs && nextAttemptAtMs > nowMs) return false;

  const lockExpiresAtMs = firestoreTimestampToMs(data.lockExpiresAt);
  if (lockExpiresAtMs && lockExpiresAtMs > nowMs) return false;
  if (status === 'processing' && !lockExpiresAtMs) return false;

  return true;
}

async function readRawIdentityEventDocsForQueue(db, queueDocs, args) {
  const reads = queueDocs.map(async ({ id, data }) => {
    const eventId = data?.eventId || id;
    const doc = await db.collection(args.firestoreEventsCollection).doc(firestoreSafeId(eventId)).get();
    if (!doc.exists) return { missing: { id, data, eventId } };
    return { id: doc.id, data: doc.data(), queueId: id };
  });
  const results = await Promise.all(reads);
  return {
    rawDocs: results.filter((result) => result && !result.missing),
    missingQueueDocs: results.filter((result) => result?.missing).map((result) => result.missing),
  };
}

function firestoreRawDocToNostrEvent(data) {
  if (!data) return null;
  if (data.eventJson) {
    try {
      return JSON.parse(data.eventJson);
    } catch {
      return null;
    }
  }
  if (!data.event) return null;
  return {
    ...data.event,
    tags: (data.event.tags || []).map((tag) => Array.isArray(tag) ? tag : tag.values || []),
  };
}

function buildProjectionProcessingWrites(rawDocs, output, options = {}) {
  const statusByEventId = buildProjectionStatusByEventId(output);
  return rawDocs.map(({ id, data }) => {
    const eventId = data?.id || id;
    const status = projectionStatusForOutputRawEvent(output, eventId, statusByEventId);
    return {
      collection: options.firestoreEventsCollection || DEFAULT_FIRESTORE_EVENTS_COLLECTION,
      id,
      data: stripUndefined({
        processing: {
          status: status.processingStatus,
          reason: status.reason,
          processedAt: FieldValue.serverTimestamp(),
          projectionRunAt: output.generatedAt,
        },
        identity: {
          status: status.identityStatus,
          reason: status.reason,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }),
    };
  });
}

function buildProjectionQueueWrites(rawDocs, output, options = {}) {
  const statusByEventId = buildProjectionStatusByEventId(output);
  return rawDocs.map(({ id, data }) => {
    const eventId = data?.id || id;
    const status = projectionStatusForOutputRawEvent(output, eventId, statusByEventId);
    return {
      collection: options.firestoreQueueCollection || DEFAULT_FIRESTORE_QUEUE_COLLECTION,
      id: firestoreSafeId(eventId),
      data: stripUndefined({
        eventId,
        status: queueStatusForProjection(status),
        reason: status.reason,
        processingStatus: status.processingStatus,
        identityStatus: status.identityStatus,
        nextAttemptAt: status.processingStatus === 'retry_later'
          ? new Date(Date.now() + (options.projectionExternalRetryMs || 15 * 60 * 1000))
          : null,
        completedAt: FieldValue.serverTimestamp(),
        lockedBy: null,
        lockExpiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    };
  });
}

function buildProjectionRawFailureWrites(rawDocs, options = {}) {
  return rawDocs.map(({ id, data }) => {
    const eventId = data?.id || id;
    return {
      collection: options.firestoreEventsCollection || DEFAULT_FIRESTORE_EVENTS_COLLECTION,
      id,
      data: stripUndefined({
        processing: {
          status: 'failed',
          reason: 'invalid_raw_event',
          processedAt: FieldValue.serverTimestamp(),
        },
        identity: {
          status: 'unknown',
          reason: 'invalid_raw_event',
        },
        updatedAt: FieldValue.serverTimestamp(),
      }),
      eventId,
    };
  });
}

function buildProjectionQueueFailureWrites(queueDocs, reason, options = {}) {
  return queueDocs.map(({ id, data, eventId }) => ({
    collection: options.firestoreQueueCollection || DEFAULT_FIRESTORE_QUEUE_COLLECTION,
    id: firestoreSafeId(eventId || data?.eventId || data?.id || id),
    data: stripUndefined({
      eventId: eventId || data?.eventId || data?.id || id,
      status: 'failed',
      reason,
      processingStatus: 'failed',
      identityStatus: 'unknown',
      completedAt: FieldValue.serverTimestamp(),
      lockedBy: null,
      lockExpiresAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  }));
}

function projectionStatusForOutputRawEvent(output, eventId, statusByEventId) {
  if (output.strategy?.proofVerificationStoppedReason) {
    return {
      processingStatus: 'retry_later',
      identityStatus: 'unknown',
      reason: output.strategy.proofVerificationStoppedReason,
    };
  }
  return statusByEventId.get(eventId) || projectionStatusForRawEvent(eventId, new Set(), new Set(), new Map());
}

function buildProjectionStatusByEventId(output) {
  const usefulEventIds = new Set();
  const verifiedEventIds = new Set();
  const rejectedByEventId = new Map();
  const retryByEventId = new Map();

  for (const record of output.directory || []) {
    if (record.sourceEventId) usefulEventIds.add(record.sourceEventId);
    if (record.identityStatus === 'verified' && record.sourceEventId) verifiedEventIds.add(record.sourceEventId);
  }
  for (const record of output.rejected || []) {
    if (!record.sourceEventId) continue;
    usefulEventIds.add(record.sourceEventId);
    rejectedByEventId.set(record.sourceEventId, record.rejectionReason || 'identity_rejected');
  }
  for (const record of output.retryLater || []) {
    if (!record.sourceEventId) continue;
    retryByEventId.set(record.sourceEventId, record.retryReason || 'temporary_proof_fetch_failure');
  }

  const eventIds = new Set([...usefulEventIds, ...rejectedByEventId.keys(), ...retryByEventId.keys()]);
  const statuses = new Map();
  for (const eventId of eventIds) {
    statuses.set(eventId, projectionStatusForRawEvent(eventId, usefulEventIds, verifiedEventIds, rejectedByEventId, retryByEventId));
  }
  return statuses;
}

function queueStatusForProjection(status) {
  if (status.processingStatus === 'retry_later') return 'retry_later';
  return status.processingStatus === 'ignored' ? 'ignored' : 'done';
}

function projectionStatusForRawEvent(eventId, usefulEventIds, verifiedEventIds, rejectedByEventId, retryByEventId = new Map()) {
  if (retryByEventId.has(eventId)) {
    return { processingStatus: 'retry_later', identityStatus: 'unknown', reason: retryByEventId.get(eventId) };
  }
  if (verifiedEventIds.has(eventId)) {
    return { processingStatus: 'processed', identityStatus: 'verified', reason: 'verified_identity_proof' };
  }
  if (rejectedByEventId.has(eventId)) {
    return { processingStatus: 'processed', identityStatus: 'rejected', reason: rejectedByEventId.get(eventId) };
  }
  if (usefulEventIds.has(eventId)) {
    return { processingStatus: 'processed', identityStatus: 'claimed', reason: 'claimed_identity_signal' };
  }
  return { processingStatus: 'ignored', identityStatus: 'none', reason: 'no_identity_signal' };
}

async function runBackfillCursor(db, relay, kind, args) {
  const stateRef = db.collection(args.firestoreStateCollection).doc(backfillStateId(relay, kind, args.backfillStatePrefix));
  const previousState = args.backfillResume ? await readBackfillState(stateRef) : null;
  if (previousState?.status === 'complete') {
    console.log(`  ${relay} kind:${kind} already complete; use --no-backfill-resume to recrawl.`);
    return {
      relay,
      kind,
      pages: 0,
      relayEvents: 0,
      validEvents: 0,
      uniqueEventsWritten: 0,
      gapsWritten: 0,
      cursorUntil: previousState.cursorUntil,
      oldestSeenAt: previousState.oldestSeenAt,
      completed: true,
      lastReason: previousState.lastReason || 'already-complete',
    };
  }
  let until = previousState?.cursorUntil || args.backfillUntil;
  let pageLimit = previousState?.pageLimit || args.backfillPageLimit;
  let boundaryTimestamp = previousState?.boundaryTimestamp || null;
  let boundarySeenIds = new Set(previousState?.boundarySeenIds || []);
  let stuckCount = previousState?.stuckCount || 0;
  let completed = false;
  let lastReason = null;
  let oldestSeenAt = previousState?.oldestSeenAt || null;
  let pages = 0;
  let relayEvents = 0;
  let validEvents = 0;
  let uniqueEventsWritten = 0;
  let gapsWritten = 0;

  console.log(`  ${relay} kind:${kind} starting until=${until}`);

  while (pages < args.backfillMaxPages && until > args.backfillSince) {
    const page = await queryRelay(
      relay,
      { kinds: [kind], until },
      { timeoutMs: args.timeoutMs, max: pageLimit }
    );
    pages += 1;
    lastReason = page.reason;
    relayEvents += page.events.length;

    const valid = dedupeEvents(page.events).filter(isValidSignedEvent);
    validEvents += valid.length;
    uniqueEventsWritten += valid.length;

    const pageOldest = oldestCreatedAt(page.events);
    if (!page.events.length || !pageOldest || pageOldest <= args.backfillSince) {
      await commitFirestoreWrites(db, [
        ...valid.flatMap((event) => buildRawEventIngestionWrites(event, relay, 'backfill', args)),
        buildBackfillCheckpointWrite(
          {
            relay,
            kind,
            cursorUntil: pageOldest ? Math.max(pageOldest - 1, args.backfillSince) : until,
            oldestSeenAt: pageOldest ? Math.min(oldestSeenAt || pageOldest, pageOldest) : oldestSeenAt,
            pageEvents: page.events.length,
            validPageEvents: valid.length,
            lastReason,
            completed: true,
            pageLimit,
            boundaryTimestamp,
            boundarySeenIds: [...boundarySeenIds],
            stuckCount,
          },
          args
        ),
      ]);
      completed = true;
      break;
    }

    const decision = decideBackfillCursor({
      cursorUntil: until,
      pageOldest,
      pageEvents: page.events,
      boundaryTimestamp,
      boundarySeenIds,
      stuckCount,
      pageLimit,
      defaultPageLimit: args.backfillPageLimit,
      maxPageLimit: args.backfillMaxPageLimit,
    });
    until = decision.cursorUntil;
    pageLimit = decision.pageLimit;
    boundaryTimestamp = decision.boundaryTimestamp;
    boundarySeenIds = new Set(decision.boundarySeenIds);
    stuckCount = decision.stuckCount;
    oldestSeenAt = Math.min(oldestSeenAt || pageOldest, pageOldest);

    const writes = [
      ...valid.flatMap((event) => buildRawEventIngestionWrites(event, relay, 'backfill', args)),
      buildBackfillCheckpointWrite(
        {
          relay,
          kind,
          cursorUntil: until,
          oldestSeenAt,
          pageEvents: page.events.length,
          validPageEvents: valid.length,
          lastReason: decision.reason || lastReason,
          completed: false,
          pageLimit,
          boundaryTimestamp,
          boundarySeenIds: [...boundarySeenIds],
          stuckCount,
        },
        args
      ),
    ];

    if (decision.gap) {
      writes.push(buildBackfillGapWrite({ ...decision.gap, relay, kind }, args));
      gapsWritten += 1;
    }

    await commitFirestoreWrites(db, writes);
  }

  if (pages >= args.backfillMaxPages && until > args.backfillSince) {
    console.log(`    paused after ${pages} page(s), resume cursor=${until}`);
  } else {
    completed = true;
  }

  await stateRef.set(
    stripUndefined({
      relay,
      kind,
      mode: 'backfill',
      statePrefix: args.backfillStatePrefix,
      cursorUntil: until,
      oldestSeenAt,
      pageLimit,
      boundaryTimestamp,
      boundarySeenIds: [...boundarySeenIds],
      stuckCount,
      completed,
      status: completed ? 'complete' : 'paused',
      lastReason,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true }
  );

  console.log(
    `    pages=${pages} relayEvents=${relayEvents} validEvents=${validEvents} status=${completed ? 'complete' : 'paused'}`
  );

  return {
    relay,
    kind,
    pages,
    relayEvents,
    validEvents,
    uniqueEventsWritten,
    gapsWritten,
    cursorUntil: until,
    oldestSeenAt,
    completed,
    lastReason,
  };
}

async function readBackfillState(stateRef) {
  const docSnapshot = await stateRef.get();
  if (!docSnapshot.exists) return null;
  return docSnapshot.data() || null;
}

function dedupeEvents(events) {
  const byId = new Map();
  for (const event of events) {
    if (event?.id) byId.set(event.id, event);
  }
  return [...byId.values()];
}

function oldestCreatedAt(events) {
  let oldest = null;
  for (const event of events) {
    if (!Number.isFinite(event?.created_at)) continue;
    oldest = oldest === null ? event.created_at : Math.min(oldest, event.created_at);
  }
  return oldest;
}

function decideBackfillCursor({
  cursorUntil,
  pageOldest,
  pageEvents,
  boundaryTimestamp,
  boundarySeenIds,
  stuckCount,
  pageLimit,
  defaultPageLimit,
  maxPageLimit,
}) {
  if (pageOldest < cursorUntil) {
    const nextBoundaryIds = eventIdsAtTimestamp(pageEvents, pageOldest);
    return {
      action: 'progress',
      reason: 'older-events-found',
      cursorUntil: pageOldest,
      pageLimit: defaultPageLimit,
      boundaryTimestamp: pageOldest,
      boundarySeenIds: nextBoundaryIds,
      stuckCount: 0,
      gap: null,
    };
  }

  const currentBoundaryIds = eventIdsAtTimestamp(pageEvents, cursorUntil);
  const previousBoundaryIds = boundaryTimestamp === cursorUntil ? new Set(boundarySeenIds || []) : new Set();
  const mergedBoundaryIds = new Set([...previousBoundaryIds, ...currentBoundaryIds]);
  const newBoundaryIds = currentBoundaryIds.filter((id) => !previousBoundaryIds.has(id));

  if (newBoundaryIds.length) {
    return {
      action: 'drain-boundary',
      reason: 'new-boundary-events-found',
      cursorUntil,
      pageLimit,
      boundaryTimestamp: cursorUntil,
      boundarySeenIds: [...mergedBoundaryIds],
      stuckCount: 0,
      gap: null,
    };
  }

  if (pageLimit < maxPageLimit) {
    return {
      action: 'increase-limit',
      reason: 'same-boundary-no-new-events',
      cursorUntil,
      pageLimit: Math.min(pageLimit * 2, maxPageLimit),
      boundaryTimestamp: cursorUntil,
      boundarySeenIds: [...mergedBoundaryIds],
      stuckCount: stuckCount + 1,
      gap: null,
    };
  }

  return {
    action: 'skip-gap',
    reason: 'stuck-same-timestamp',
    cursorUntil: cursorUntil - 1,
    pageLimit: defaultPageLimit,
    boundaryTimestamp: null,
    boundarySeenIds: [],
    stuckCount: 0,
    gap: {
      relay: null,
      kind: null,
      timestamp: cursorUntil,
      reason: 'stuck_same_timestamp',
      pageLimit,
      seenEventIds: [...mergedBoundaryIds],
    },
  };
}

function eventIdsAtTimestamp(events, timestamp) {
  return dedupeEvents(events)
    .filter((event) => event.created_at === timestamp)
    .map((event) => event.id)
    .sort();
}

function rememberSeenEventId(eventId, seenEventIds, seenEventIdQueue, limit) {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  seenEventIdQueue.push(eventId);
  while (seenEventIdQueue.length > limit) {
    const expired = seenEventIdQueue.shift();
    seenEventIds.delete(expired);
  }
  return true;
}

function sortDirectoryRecord(a, b) {
  return a.handle.localeCompare(b.handle) || a.directoryStatus.localeCompare(b.directoryStatus);
}

async function writeJson(file, data) {
  const outPath = path.resolve(process.cwd(), file);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildFirestoreWrites(output, options = {}) {
  const entriesCollection = options.firestoreEntriesCollection || DEFAULT_FIRESTORE_ENTRIES_COLLECTION;
  const handlesCollection = options.firestoreHandlesCollection || DEFAULT_FIRESTORE_HANDLES_COLLECTION;
  const runId = firestoreSafeId(output.generatedAt);
  const writes = [];

  for (const record of output.directory) {
    writes.push({
      collection: entriesCollection,
      id: firestoreDirectoryRecordId(record),
      data: stripUndefined({
        ...record,
        runId,
        lastSeenAt: output.generatedAt,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  for (const summary of buildHandleSummaries(output.directory, output.generatedAt, runId)) {
    writes.push({
      collection: handlesCollection,
      id: firestoreHandleId(summary.platform, summary.handle),
      data: stripUndefined({
        ...summary,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  return writes;
}

async function commitFirestoreWrites(db, writes) {
  const normalWrites = [];
  const createIfMissingWrites = [];
  for (const write of writes) {
    if (write.operation === 'createIfMissing') {
      createIfMissingWrites.push(write);
    } else {
      normalWrites.push(write);
    }
  }

  await commitCreateIfMissingWrites(db, createIfMissingWrites);

  for (let i = 0; i < normalWrites.length; i += 450) {
    const batch = db.batch();
    for (const write of normalWrites.slice(i, i + 450)) {
      batch.set(db.collection(write.collection).doc(write.id), write.data, { merge: true });
    }
    await batch.commit();
  }
}

async function commitCreateIfMissingWrites(db, writes) {
  for (let i = 0; i < writes.length; i += CREATE_IF_MISSING_CONCURRENCY) {
    await Promise.all(
      writes
        .slice(i, i + CREATE_IF_MISSING_CONCURRENCY)
        .map((write) => createFirestoreDocIfMissing(db, write))
    );
  }
}

async function createFirestoreDocIfMissing(db, write) {
  try {
    await db.collection(write.collection).doc(write.id).create(write.data);
  } catch (error) {
    if (isAlreadyExistsError(error)) return;
    throw error;
  }
}

function isAlreadyExistsError(error) {
  return error?.code === 6 || /already exists/i.test(String(error?.message || ''));
}

function firestoreErrorSummary(error) {
  return stripUndefined({
    code: error?.code || null,
    message: String(error?.message || 'unknown').slice(0, 200),
  });
}

function firestoreTimestampToMs(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function assertFirestoreCredentialsAvailable() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  if (process.env.CLOUD_RUN_JOB || process.env.K_SERVICE || process.env.FUNCTION_NAME) return;

  const adcPath = getApplicationDefaultCredentialsPath();

  try {
    await access(adcPath);
  } catch {
    throw new Error(
      'Firestore write requires Application Default Credentials. Run `gcloud auth application-default login` locally, or run the crawler in Cloud Run with a Firestore-enabled service account.'
    );
  }
}

function getApplicationDefaultCredentialsPath() {
  if (process.env.CLOUDSDK_CONFIG) {
    return path.join(process.env.CLOUDSDK_CONFIG, 'application_default_credentials.json');
  }
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
  }
  return path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
}

function buildHandleSummaries(records, generatedAt, runId) {
  const byHandle = new Map();

  for (const record of records) {
    const key = firestoreHandleId(record.platform, record.handle);
    const current = byHandle.get(key) || {
      platform: record.platform,
      handle: record.handle,
      runId,
      lastSeenAt: generatedAt,
      recordCount: 0,
      verifiedCount: 0,
      zappableVerifiedCount: 0,
      autoZapAllowedCount: 0,
      best: null,
      records: [],
    };

    current.recordCount += 1;
    if (record.identityStatus === 'verified') current.verifiedCount += 1;
    if (record.identityStatus === 'verified' && record.zappable === true) current.zappableVerifiedCount += 1;
    if (record.autoZapAllowed === true) current.autoZapAllowedCount += 1;
    current.records.push({
      pubkey: record.pubkey,
      npub: record.npub,
      directoryStatus: record.directoryStatus,
      identityStatus: record.identityStatus,
      autoZapAllowed: record.autoZapAllowed,
      zappable: record.zappable,
      wotScore: record.wot?.score ?? null,
      entryId: firestoreDirectoryRecordId(record),
    });

    byHandle.set(key, current);
  }

  return [...byHandle.values()].map((summary) => ({
    ...summary,
    records: summary.records.sort(sortHandleSummaryRecord),
    best: summary.records.sort(sortHandleSummaryRecord)[0] || null,
  }));
}

function buildBackfillEventWrite(event, relay, options = {}) {
  return {
    collection: options.firestoreEventsCollection || DEFAULT_FIRESTORE_EVENTS_COLLECTION,
    id: firestoreSafeId(event.id),
    data: stripUndefined({
      id: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      sourceRelays: FieldValue.arrayUnion(relay),
      event: normalizeEventForFirestore(event),
      eventJson: JSON.stringify(event),
      ingestion: {
        mode: 'backfill',
        lastRelay: relay,
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function buildLiveEventWrite(event, relay, options = {}) {
  return {
    collection: options.firestoreEventsCollection || DEFAULT_FIRESTORE_EVENTS_COLLECTION,
    id: firestoreSafeId(event.id),
    data: stripUndefined({
      id: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      sourceRelays: FieldValue.arrayUnion(relay),
      event: normalizeEventForFirestore(event),
      eventJson: JSON.stringify(event),
      ingestion: {
        mode: 'live',
        lastRelay: relay,
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function buildRawEventIngestionWrites(event, relay, mode, options = {}) {
  return [
    mode === 'live' ? buildLiveEventWrite(event, relay, options) : buildBackfillEventWrite(event, relay, options),
    buildProjectionQueueCreateWrite(event, mode, options),
  ];
}

function buildProjectionQueueCreateWrite(event, mode, options = {}) {
  return {
    operation: 'createIfMissing',
    collection: options.firestoreQueueCollection || DEFAULT_FIRESTORE_QUEUE_COLLECTION,
    id: firestoreSafeId(event.id),
    data: stripUndefined({
      eventId: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      eventCreatedAt: event.created_at,
      sourceMode: mode,
      status: 'pending',
      reason: 'awaiting_projection',
      attempts: 0,
      nextAttemptAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function buildLiveHeartbeatWrite({
  relay,
  status,
  mode,
  connected,
  lastEventAt,
  attempts,
}, options = {}) {
  return {
    collection: options.firestoreStateCollection || DEFAULT_FIRESTORE_STATE_COLLECTION,
    id: liveStateId(relay),
    data: stripUndefined({
      relay,
      mode: mode || 'live',
      status,
      connected,
      lastEventAt,
      connectAttempts: attempts,
      heartbeatAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function normalizeEventForFirestore(event) {
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    content: event.content || '',
    tags: (event.tags || []).map((tag) => ({ values: tag.map((value) => String(value)) })),
    sig: event.sig,
  };
}

function buildBackfillCheckpointWrite({
  relay,
  kind,
  cursorUntil,
  oldestSeenAt,
  pageEvents,
  validPageEvents,
  lastReason,
  completed,
  pageLimit,
  boundaryTimestamp,
  boundarySeenIds,
  stuckCount,
}, options = {}) {
  return {
    collection: options.firestoreStateCollection || DEFAULT_FIRESTORE_STATE_COLLECTION,
    id: backfillStateId(relay, kind, options.backfillStatePrefix || 'backfill'),
    data: stripUndefined({
      relay,
      kind,
      mode: 'backfill',
      statePrefix: options.backfillStatePrefix || 'backfill',
      cursorUntil,
      oldestSeenAt,
      pageLimit,
      boundaryTimestamp,
      boundarySeenIds,
      stuckCount,
      pagesProcessed: FieldValue.increment(1),
      relayEventsSeen: FieldValue.increment(pageEvents),
      validEventsSeen: FieldValue.increment(validPageEvents),
      completed,
      status: completed ? 'complete' : 'running',
      lastReason,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function buildBackfillGapWrite({
  relay,
  kind,
  timestamp,
  reason,
  pageLimit,
  seenEventIds,
}, options = {}) {
  return {
    collection: options.firestoreGapsCollection || DEFAULT_FIRESTORE_GAPS_COLLECTION,
    id: firestoreSafeId(`${relay}:kind:${kind}:timestamp:${timestamp}`),
    data: stripUndefined({
      relay,
      kind,
      timestamp,
      reason,
      pageLimit,
      seenEventIds,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function backfillStateId(relay, kind, prefix = 'backfill') {
  return firestoreSafeId(`${prefix}:${relay}:kind:${kind}`);
}

function liveStateId(relay) {
  return firestoreSafeId(`live:${relay}`);
}

function sortHandleSummaryRecord(a, b) {
  const aStatus = statusRank(a);
  const bStatus = statusRank(b);
  return aStatus - bStatus || (b.wotScore || 0) - (a.wotScore || 0) || a.pubkey.localeCompare(b.pubkey);
}

function statusRank(record) {
  if (record.autoZapAllowed) return 0;
  if (record.directoryStatus === 'verified_not_zappable') return 1;
  if (record.identityStatus === 'verified') return 2;
  return 3;
}

function firestoreDirectoryRecordId(record) {
  return firestoreSafeId(`${record.platform}:${record.handle}:${record.pubkey}`);
}

function firestoreHandleId(platform, handle) {
  return firestoreSafeId(`${platform}:${handle}`);
}

function firestoreSafeId(value) {
  return String(value).replace(/[/.#[\]]/g, '_');
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value instanceof Date) return value;
  if (!value || typeof value !== 'object' || value instanceof FieldValue) return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) result[key] = stripUndefined(child);
  }
  return result;
}

function createRunMetrics(component, now = new Date()) {
  return {
    component,
    runId: `${component}-${firestoreSafeId(now.toISOString())}`,
    startedAt: now.toISOString(),
    startedMs: now.getTime(),
    timings: [],
  };
}

function finishRunMetrics(runMetrics, counters = {}, now = new Date()) {
  return stripUndefined({
    component: runMetrics.component,
    runId: runMetrics.runId,
    startedAt: runMetrics.startedAt,
    finishedAt: now.toISOString(),
    durationMs: now.getTime() - runMetrics.startedMs,
    memoryRssMb: memoryRssMb(),
    avgProcessingMs: average(runMetrics.timings),
    p95ProcessingMs: percentile(runMetrics.timings, 95),
    counters,
  });
}

function buildRunSummaryWrite(run, output, collection) {
  return {
    collection,
    id: run.runId,
    data: stripUndefined({
      ...run,
      mode: output.mode || output.source || run.component,
      source: output.source || null,
      stats: output.stats || null,
      firestore: output.firestore || null,
      relays: output.relays || null,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function logRunSummary(run) {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'crawler_run_summary',
    component: run.component,
    runId: run.runId,
    durationMs: run.durationMs,
    memoryRssMb: run.memoryRssMb,
    counters: run.counters,
  }));
}

function memoryRssMb() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * (percentileValue / 100)) - 1);
  return sorted[index];
}

function prefixObjectKeys(object, prefix) {
  return Object.fromEntries(
    Object.entries(object || {}).map(([key, value]) => [`${prefix}${key[0].toUpperCase()}${key.slice(1)}`, value])
  );
}

function printSummary(output, args) {
  console.log('\nDirectory crawl complete.');
  console.log(`  profile events:       ${output.stats.profileEvents}`);
  console.log(`  proof candidates:     ${output.stats.verifiableCandidates}`);
  console.log(`  proof tweets checked: ${output.stats.proofTweetsAttempted}`);
  console.log(`  verified:             ${output.stats.verified}`);
  console.log(`  claimed-only:         ${output.stats.claimedOnly}`);
  console.log(`  zappable verified:    ${output.stats.zappableVerified}`);
  console.log(`  auto-zap allowed:     ${output.stats.autoZapAllowed}`);
  if (args.out) console.log(`  output:               ${args.out}`);
  if (args.writeFirestore) {
    console.log(`  firestore project:    ${args.firestoreProject}`);
    console.log(`  firestore entries:    ${args.firestoreEntriesCollection}`);
  }
}

function printBackfillSummary(output, args) {
  console.log('\nBackfill complete.');
  console.log(`  relay/kind cursors:   ${output.stats.relayKindCursors}`);
  console.log(`  pages:                ${output.stats.pages}`);
  console.log(`  relay events:         ${output.stats.relayEvents}`);
  console.log(`  valid events:         ${output.stats.validEvents}`);
  console.log(`  event docs written:   ${output.stats.uniqueEventsWritten}`);
  console.log(`  gaps written:         ${output.stats.gapsWritten}`);
  console.log(`  completed cursors:    ${output.stats.completedCursors}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore events:     ${args.firestoreEventsCollection}`);
  console.log(`  firestore state:      ${args.firestoreStateCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

function printLiveSummary(output, args) {
  console.log('\nLive listener stopped.');
  console.log(`  stop reason:          ${output.stopReason}`);
  console.log(`  relays:               ${output.stats.relayCount}`);
  console.log(`  connect attempts:     ${output.stats.connectAttempts}`);
  console.log(`  reconnects:           ${output.stats.reconnects}`);
  console.log(`  relay disconnects:    ${output.stats.relayDisconnects}`);
  console.log(`  relay errors:         ${output.stats.relayErrors}`);
  console.log(`  events received:      ${output.stats.eventsReceived}`);
  console.log(`  valid events written: ${output.stats.validEventsWritten}`);
  console.log(`  invalid dropped:      ${output.stats.invalidEventsDropped}`);
  console.log(`  duplicates:           ${output.stats.duplicateEvents}`);
  console.log(`  firestore project:    ${args.firestoreProject}`);
  console.log(`  firestore events:     ${args.firestoreEventsCollection}`);
  console.log(`  firestore state:      ${args.firestoreStateCollection}`);
  if (args.out) console.log(`  output:               ${args.out}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  runCrawler(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
  buildBackfillCheckpointWrite,
  buildBackfillEventWrite,
  buildBackfillGapWrite,
  buildLiveEventWrite,
  buildLiveHeartbeatWrite,
  buildProjectionQueueCreateWrite,
  buildProjectionQueueClaimData,
  buildProjectionQueueFailureWrites,
  buildProjectionQueueWrites,
  buildProjectionRawFailureWrites,
  buildFirestoreWrites,
  buildRunSummaryWrite,
  buildProjectionProcessingWrites,
  computeWotScores,
  createRunMetrics,
  decideBackfillCursor,
  extractDirectoryInputs,
  extractTweetId,
  firestoreRawDocToNostrEvent,
  firestoreTimestampToMs,
  lightningAddressToLnurlp,
  liveStateId,
  normalizeTwitterHandle,
  projectionStatusForRawEvent,
  queueDocIsClaimable,
  queueStatusForProjection,
  rememberSeenEventId,
  finishRunMetrics,
  percentile,
  runCrawler,
};
