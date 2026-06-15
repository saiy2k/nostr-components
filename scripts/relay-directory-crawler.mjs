#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nip19, validateEvent, verifyEvent } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];

const DEFAULT_OUT = 'sob-proposal-review/relay-directory-output.json';
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
    relays: DEFAULT_RELAYS,
    out: DEFAULT_OUT,
    timeoutMs: 12000,
    kind10011Limit: 1000,
    kind0Limit: 1500,
    maxProofs: 250,
    verifyTweets: true,
    checkZaps: true,
    includeWot: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--relays') args.relays = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--out') args.out = next();
    else if (arg === '--timeout-ms') args.timeoutMs = Number(next());
    else if (arg === '--kind10011-limit') args.kind10011Limit = Number(next());
    else if (arg === '--kind0-limit') args.kind0Limit = Number(next());
    else if (arg === '--max-proofs') args.maxProofs = Number(next());
    else if (arg === '--no-tweet-verify') args.verifyTweets = false;
    else if (arg === '--no-zap-check') args.checkZaps = false;
    else if (arg === '--no-wot') args.includeWot = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.relays.length) throw new Error('At least one relay is required.');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('--timeout-ms must be positive.');
  if (!Number.isFinite(args.maxProofs) || args.maxProofs < 0) throw new Error('--max-proofs must be >= 0.');
  return args;
}

function printHelp() {
  console.log(`Usage: npm run crawl:directory -- [options]

Build a verified X/Twitter -> Nostr directory from relay data.

Requires Node.js 22+ for the native WebSocket client used to query relays.

Options:
  --relays <csv>             Relays to query. Default: ${DEFAULT_RELAYS.join(',')}
  --out <file>               JSON output path. Default: ${DEFAULT_OUT}
  --timeout-ms <n>           Per-relay timeout. Default: 12000
  --kind10011-limit <n>      Per-relay kind:10011 limit. Default: 1000
  --kind0-limit <n>          Per-relay kind:0 limit. Default: 1500
  --max-proofs <n>           Max proof tweets to verify; 0 means all. Default: 250
  --no-tweet-verify          Extract candidates only; do not fetch X/Twitter.
  --no-zap-check             Skip LNURL/NIP-57 zappability checks.
  --no-wot                   Skip Web-of-Trust/risk scoring.
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

async function queryPool(relays, filter, opts) {
  const results = await Promise.all(relays.map((relay) => queryRelay(relay, filter, opts)));
  const byId = new Map();
  for (const result of results) {
    for (const event of result.events) byId.set(event.id, event);
  }
  return { results, events: [...byId.values()] };
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

function mergeMetadata(metadataByPubkey, events) {
  for (const event of events) {
    if (event.kind !== 0) continue;
    const metadata = safeJson(event.content);
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
  if (bearerToken) {
    const official = await fetchTweetViaXApi(tweetId, bearerToken, timeoutMs);
    if (official) return official;
  }

  const syndication = await fetchTweetViaSyndication(tweetId, timeoutMs);
  if (syndication) return syndication;

  return fetchTweetViaOembed(tweetId, handleHint, timeoutMs);
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
    if (!response.ok) return null;
    const json = await response.json();
    const user = json.includes?.users?.find((candidate) => candidate.id === json.data?.author_id);
    if (!json.data?.text || !user?.username) return null;
    return {
      text: json.data.text,
      handle: user.username,
      userId: user.id,
      source: 'x-api',
    };
  } catch {
    return null;
  }
}

async function fetchTweetViaSyndication(tweetId, timeoutMs) {
  for (const token of [syndicationToken(tweetId), 'a']) {
    try {
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const json = await response.json();
      if (!json?.text || !json.user?.screen_name) continue;
      return {
        text: json.text,
        handle: json.user.screen_name,
        userId: json.user.id_str || json.user.id || null,
        source: 'syndication',
      };
    } catch {}
  }
  return null;
}

async function fetchTweetViaOembed(tweetId, handleHint, timeoutMs) {
  try {
    const tweetUrl = `https://twitter.com/${handleHint || 'i'}/status/${tweetId}`;
    const url = `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(tweetUrl)}`;
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const json = await response.json();
    const handle = normalizeTwitterHandle(json.author_url);
    const text = stripHtml(json.html || '');
    if (!handle || !text) return null;
    return {
      text,
      handle,
      userId: null,
      source: 'oembed',
    };
  } catch {
    return null;
  }
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
  const tweet = await fetchTweet(candidate.proofTweetId, candidate.handle, timeoutMs);
  if (!tweet) return { ...candidate, identityStatus: 'rejected', rejectionReason: 'proof-tweet-unavailable' };

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
  console.log(`Crawling ${args.relays.length} relays for kind:10011 and kind:0 identity data...`);

  const [kind10011, kind0] = await Promise.all([
    queryPool(args.relays, { kinds: [10011] }, { timeoutMs: args.timeoutMs, max: args.kind10011Limit }),
    queryPool(args.relays, { kinds: [0] }, { timeoutMs: args.timeoutMs, max: args.kind0Limit }),
  ]);

  const profileEvents = latestReplaceable([...kind10011.events, ...kind0.events]);
  const { candidates, claimed, metadataByPubkey } = extractDirectoryInputs(profileEvents);
  const proofLimit = args.maxProofs === 0 ? candidates.length : Math.min(args.maxProofs, candidates.length);

  console.log(`Found ${profileEvents.length} latest profile/identity events.`);
  console.log(`Detected ${candidates.length} verifiable Twitter proof candidates and ${claimed.length} claimed-only leads.`);

  const verifiedOrRejected = [];
  if (args.verifyTweets) {
    console.log(`Verifying ${proofLimit}/${candidates.length} proof tweets...`);
    for (const candidate of candidates.slice(0, proofLimit)) {
      verifiedOrRejected.push(await verifyCandidate(candidate, args.timeoutMs));
    }
  } else {
    verifiedOrRejected.push(...candidates.map((candidate) => ({ ...candidate, identityStatus: 'candidate' })));
  }

  let verified = verifiedOrRejected.filter((record) => record.identityStatus === 'verified');
  const rejected = verifiedOrRejected.filter((record) => record.identityStatus === 'rejected');

  if (verified.length) {
    console.log(`Fetching latest kind:0 metadata for ${verified.length} verified authors...`);
    const verifiedPubkeys = [...new Set(verified.map((record) => record.pubkey))];
    const verifiedMetadata = await queryPool(
      args.relays,
      { kinds: [0], authors: verifiedPubkeys },
      { timeoutMs: args.timeoutMs, max: Math.max(verifiedPubkeys.length * 2, 50) }
    );
    mergeMetadata(metadataByPubkey, latestReplaceable(verifiedMetadata.events));
  }

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

  if (args.includeWot && allDirectoryRecords.length) {
    console.log('Collecting lightweight WoT signals for directory records...');
    const pubkeys = [...new Set(allDirectoryRecords.map((record) => record.pubkey))];
    const [followLists, reports, assertions] = await Promise.all([
      queryPool(args.relays, { kinds: [3], '#p': pubkeys }, { timeoutMs: args.timeoutMs, max: 1500 }),
      queryPool(args.relays, { kinds: [1984], '#p': pubkeys }, { timeoutMs: args.timeoutMs, max: 1000 }),
      queryPool(args.relays, { kinds: [30382], '#d': pubkeys }, { timeoutMs: args.timeoutMs, max: 1500 }),
    ]);
    allDirectoryRecords = computeWotScores(allDirectoryRecords, [
      ...followLists.events,
      ...reports.events,
      ...assertions.events,
    ]);
  }

  allDirectoryRecords = allDirectoryRecords.map((record) => ({
    ...record,
    autoZapAllowed: record.identityStatus === 'verified' && record.zappable === true,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    strategy: {
      identityProof: 'NIP-39 kind:10011 i tags, with legacy kind:0 i tags accepted',
      proofVerification: args.verifyTweets
        ? 'proof tweet must be authored by handle and contain exact npub'
        : 'disabled by --no-tweet-verify',
      zapPolicy: 'auto-zap requires verified identity and LNURL allowsNostr',
      wotPolicy: 'WoT/NIP-85 is ranking and risk only, never identity proof',
    },
    relays: args.relays,
    relayResults: {
      kind10011: kind10011.results.map(summarizeRelayResult),
      kind0: kind0.results.map(summarizeRelayResult),
    },
    stats: {
      profileEvents: profileEvents.length,
      verifiableCandidates: candidates.length,
      proofTweetsAttempted: args.verifyTweets ? proofLimit : 0,
      verified: verified.length,
      rejected: rejected.length,
      claimedOnly: claimed.length,
      zappableVerified: verified.filter((record) => record.zappable).length,
      autoZapAllowed: allDirectoryRecords.filter((record) => record.autoZapAllowed).length,
    },
    directory: allDirectoryRecords.sort(sortDirectoryRecord),
    rejected,
  };

  await writeJson(args.out, output);
  printSummary(output, args.out);
  return output;
}

function summarizeRelayResult(result) {
  return {
    relay: result.relay,
    events: result.events.length,
    reason: result.reason,
  };
}

function sortDirectoryRecord(a, b) {
  return a.handle.localeCompare(b.handle) || a.directoryStatus.localeCompare(b.directoryStatus);
}

async function writeJson(file, data) {
  const outPath = path.resolve(process.cwd(), file);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function printSummary(output, out) {
  console.log('\nDirectory crawl complete.');
  console.log(`  profile events:       ${output.stats.profileEvents}`);
  console.log(`  proof candidates:     ${output.stats.verifiableCandidates}`);
  console.log(`  proof tweets checked: ${output.stats.proofTweetsAttempted}`);
  console.log(`  verified:             ${output.stats.verified}`);
  console.log(`  claimed-only:         ${output.stats.claimedOnly}`);
  console.log(`  zappable verified:    ${output.stats.zappableVerified}`);
  console.log(`  auto-zap allowed:     ${output.stats.autoZapAllowed}`);
  console.log(`  output:               ${out}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  runCrawler(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

export {
  computeWotScores,
  extractDirectoryInputs,
  extractTweetId,
  lightningAddressToLnurlp,
  normalizeTwitterHandle,
  runCrawler,
};
