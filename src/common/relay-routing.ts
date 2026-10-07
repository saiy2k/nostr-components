// SPDX-License-Identifier: MIT

import { SimplePool, type Event, type Filter } from 'nostr-tools';
import {
  DEFAULT_RELAYS,
  INDEXER_RELAYS,
  PROFILE_ARCHIVE_RELAYS,
  RENDEZVOUS_RELAYS,
} from './constants';
import { getRelayTransport } from './relay-transport';
import { isValidRelayUrl } from './utils';

export const FUTURE_SKEW_SECONDS = 15 * 60;
export const WRITE_RELAY_LIMIT = 3;
export const ZAP_RELAY_LIMIT = 8;
const RELAY_QUERY_TIMEOUT_MS = 8000;

export interface ReplaceableEvent {
  id: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

export interface RelayQueryResult {
  events: ReplaceableEvent[];
  answered: number;
}

export type RelayQuery = (
  relays: string[],
  filter: Filter,
) => Promise<RelayQueryResult>;

interface Kind0RelayChoice {
  readRelays?: string[];
  writeRelays?: string[];
  hints?: string[];
  archives?: string[];
  health?: Map<string, { consecutiveFailures?: number }>;
  limit?: number;
}

/** Canonical `wss://` relay URL. Anything else is dropped. */
export function normalizeRelayUrl(value: unknown): string | null {
  let url: URL;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'wss:' || url.username || url.password) return null;
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if (url.port === '443') url.port = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }
  return url.toString();
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function normalizeList(values: string[]): string[] {
  return dedupe(values.map((value) => normalizeRelayUrl(value)));
}

export function preferNewerReplaceable<T extends ReplaceableEvent>(
  current: T | null,
  event: T | null,
  nowSec = Math.floor(Date.now() / 1000),
): T | null {
  if (!event || event.id == null) return current || null;
  const createdAt = Number(event.created_at);
  if (!Number.isFinite(createdAt)) return current || null;
  if (createdAt > nowSec + FUTURE_SKEW_SECONDS) return current || null;
  if (!current) return event;
  const currentAt = Number(current.created_at);
  if (createdAt > currentAt) return event;
  if (createdAt < currentAt) return current;
  return String(event.id) < String(current.id) ? event : current;
}

export function relayListFromEvent(event: { tags?: string[][] } | null): {
  readRelays: string[];
  writeRelays: string[];
} {
  const read: string[] = [];
  const write: string[] = [];
  for (const tag of event?.tags || []) {
    if (!Array.isArray(tag) || tag[0] !== 'r') continue;
    const url = normalizeRelayUrl(tag[1]);
    if (!url) continue;
    const marker = tag[2];
    if (marker === 'read') read.push(url);
    else if (marker === 'write') write.push(url);
    else if (marker == null || marker === '') {
      read.push(url);
      write.push(url);
    }
  }
  return { readRelays: dedupe(read), writeRelays: dedupe(write) };
}

function relayIsHealthy(
  health: Map<string, { consecutiveFailures?: number }>,
  url: string,
): boolean {
  const row = health.get(url);
  if (!row) return true;
  return Number(row.consecutiveFailures || 0) < 3;
}

export function selectKind0Relays({
  readRelays = [],
  writeRelays = [],
  hints = [],
  archives = PROFILE_ARCHIVE_RELAYS,
  health = new Map(),
  limit = WRITE_RELAY_LIMIT,
}: Kind0RelayChoice = {}): string[] {
  const markedWrite = normalizeList(writeRelays);
  const writes = markedWrite.filter((url) => relayIsHealthy(health, url)).slice(0, limit);
  const reads =
    markedWrite.length === 0
      ? normalizeList(readRelays).filter((url) => relayIsHealthy(health, url)).slice(0, limit)
      : [];
  return dedupe([
    ...normalizeList(archives),
    ...writes,
    ...reads,
    ...normalizeList(hints),
  ]);
}

export function countAnsweredRelays(reasons: string[]): number {
  return reasons.filter((reason) => reason === 'closed by caller').length;
}

const emptyResult = (): RelayQueryResult => ({ events: [], answered: 0 });

/** Query relays and report how many reached EOSE, not merely how many events came back. */
export async function queryRelays(
  relays: string[],
  filter: Filter,
): Promise<RelayQueryResult> {
  const urls = normalizeList(relays);
  if (urls.length === 0) return emptyResult();

  const pool = new SimplePool();
  try {
    return await new Promise((resolve) => {
      const events: ReplaceableEvent[] = [];
      pool.subscribeEose(urls, filter, {
        maxWait: RELAY_QUERY_TIMEOUT_MS,
        onevent(event) {
          events.push(event as ReplaceableEvent);
        },
        onclose(reasons) {
          resolve({
            events,
            answered: countAnsweredRelays(reasons),
          });
        },
      });
    });
  } finally {
    pool.close(urls);
  }
}

function newestOfKind(
  events: ReplaceableEvent[],
  pubkey: string,
  kind: number,
  nowSec: number,
): ReplaceableEvent | null {
  let chosen: ReplaceableEvent | null = null;
  const author = pubkey.toLowerCase();
  for (const event of events) {
    if (event.kind !== kind) continue;
    if ((event.pubkey || '').toLowerCase() !== author) continue;
    chosen = preferNewerReplaceable(chosen, event, nowSec);
  }
  return chosen;
}

const relayListCache = new Map<string, ReplaceableEvent | null>();

export async function fetchRelayList(
  pubkey: string,
  query: RelayQuery = queryRelays,
): Promise<ReplaceableEvent | null> {
  const useCache = query === queryRelays;
  const cacheKey = pubkey.toLowerCase();
  if (useCache && relayListCache.has(cacheKey)) {
    return relayListCache.get(cacheKey) ?? null;
  }
  const relays = normalizeList(INDEXER_RELAYS);
  if (relays.length === 0) return null;
  const result = await query(relays, { authors: [pubkey], kinds: [10002] });
  const list = newestOfKind(result.events, pubkey, 10002, Math.floor(Date.now() / 1000));
  if (useCache) relayListCache.set(cacheKey, list);
  return list;
}

const outboxCache = new Map<string, Event>();

export function clearOutboxCache(): void {
  outboxCache.clear();
  relayListCache.clear();
}

/**
 * Kind 10002 from the indexers, in parallel with kind 0 from the archives
 * and the component's relays. Only the write-relay request waits for the list.
 */
export async function fetchProfileOutbox(
  pubkey: string,
  relays: string[] = [],
  query: RelayQuery = queryRelays,
): Promise<Event | null> {
  const hints = normalizeList(relays);
  const useCache = query === queryRelays;
  const cacheKey = `${pubkey.toLowerCase()}|${hints.join(',')}`;
  if (useCache) {
    const cached = outboxCache.get(cacheKey);
    if (cached) return cached;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const indexers = normalizeList(INDEXER_RELAYS);
  const archives = normalizeList(PROFILE_ARCHIVE_RELAYS);
  const immediateRelays = dedupe([...archives, ...hints]);
  const listPromise = indexers.length
    ? query(indexers, { authors: [pubkey], kinds: [10002] })
    : Promise.resolve(emptyResult());
  const immediatePromise = immediateRelays.length
    ? query(immediateRelays, { authors: [pubkey], kinds: [0] })
    : Promise.resolve(emptyResult());

  const listResult = await listPromise;
  const listEvent = newestOfKind(listResult.events, pubkey, 10002, nowSec);
  const list = listEvent ? relayListFromEvent(listEvent) : { readRelays: [], writeRelays: [] };
  const chosen = selectKind0Relays({
    ...list,
    hints,
    archives,
  }).filter((url) => !immediateRelays.includes(url));
  const extraResult = chosen.length
    ? await query(chosen, { authors: [pubkey], kinds: [0] })
    : emptyResult();
  const immediate = await immediatePromise;
  const asked = immediateRelays.length + chosen.length;
  const answered = immediate.answered + extraResult.answered;
  const kind0 = newestOfKind(
    [...immediate.events, ...extraResult.events],
    pubkey,
    0,
    nowSec,
  );
  if (!kind0 && asked > 0 && answered === 0) {
    throw new Error('No relay answered the profile query');
  }
  const profile = (kind0 as Event | null) ?? null;
  if (useCache && profile) outboxCache.set(cacheKey, profile);
  return profile;
}

export async function zapRelaysFor(
  pubkey: string,
  attributeRelays: string[] = [],
  query: RelayQuery = queryRelays,
): Promise<string[]> {
  const explicit = normalizeList(attributeRelays);
  const base = explicit.length ? explicit : normalizeList(RENDEZVOUS_RELAYS);
  let reads: string[] = [];
  try {
    const list = await fetchRelayList(pubkey, query);
    if (list) reads = relayListFromEvent(list).readRelays;
  } catch {
    reads = [];
  }
  const extra = reads.filter((url) => !base.includes(url)).slice(0, WRITE_RELAY_LIMIT);
  return [...base, ...extra].slice(0, ZAP_RELAY_LIMIT);
}

export async function likePublishRelays(
  baseRelays: string[],
  signerPubkey: string,
  query: RelayQuery = queryRelays,
): Promise<string[]> {
  const base = normalizeList(baseRelays);
  if (getRelayTransport()) return baseRelays;
  let writes: string[] = [];
  try {
    const list = await fetchRelayList(signerPubkey, query);
    if (list) writes = relayListFromEvent(list).writeRelays.slice(0, WRITE_RELAY_LIMIT);
  } catch {
    writes = [];
  }
  return dedupe([...base, ...writes]);
}

/** Explicit `relays` attribute, otherwise today's list while a transport is installed. */
export function relaysForComponent(relaysAttr: string | null): string[] {
  if (relaysAttr) {
    const list = relaysAttr
      .split(',')
      .map((relay) => relay.trim())
      .filter((relay) => relay && isValidRelayUrl(relay));
    if (list.length) return Array.from(new Set(list));
  }
  if (getRelayTransport()) return [...DEFAULT_RELAYS];
  return [...RENDEZVOUS_RELAYS];
}

export function explicitRelays(relaysAttr: string | null): string[] {
  if (!relaysAttr) return [];
  return relaysAttr
    .split(',')
    .map((relay) => relay.trim())
    .filter((relay) => relay && isValidRelayUrl(relay));
}
