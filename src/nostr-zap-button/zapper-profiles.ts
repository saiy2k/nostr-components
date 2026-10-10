// SPDX-License-Identifier: MIT

import type { Event } from 'nostr-tools';
import {
  DIRECTORY_API_ORIGIN,
  INDEXER_RELAYS,
  PROFILE_ARCHIVE_RELAYS,
} from '../common/constants';
import { cloneVerifiedEvent } from '../common/nostr-event';
import { queryRelays } from '../common/relay-routing';
import { getRelayTransport, httpGetJson } from '../common/relay-transport';

const PROFILE_BATCH_SIZE = 50;
const HEX_64 = /^[0-9a-f]{64}$/;

export interface ZapperProfileSources {
  queryKind0(relays: string[], authors: string[]): Promise<unknown[]>;
  fetchSignedProfiles(authors: string[]): Promise<unknown[]>;
}

/** Kind 0 lookup relays: indexers, archives, and the button's own relays. */
export function zapperProfileRelays(hints: string[] = []): string[] {
  const relays: string[] = [];
  for (const relay of [
    ...INDEXER_RELAYS,
    ...PROFILE_ARCHIVE_RELAYS,
    ...hints,
  ]) {
    const value = relay.trim();
    if (!value || relays.includes(value)) continue;
    relays.push(value);
  }
  return relays;
}

export function zapperPubkeyList(authorIds: string[]): string[] {
  const pubkeys: string[] = [];
  for (const authorId of authorIds) {
    const pubkey = authorId.trim().toLowerCase();
    if (!HEX_64.test(pubkey) || pubkeys.includes(pubkey)) continue;
    pubkeys.push(pubkey);
  }
  return pubkeys;
}

export function signedProfileEventsFromLookup(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') return [];
  const profiles = (body as { profiles?: unknown }).profiles;
  if (!Array.isArray(profiles)) return [];
  const events: unknown[] = [];
  for (const row of profiles) {
    if (!row || typeof row !== 'object') continue;
    const event = (row as { profileEvent?: unknown }).profileEvent;
    if (event) events.push(event);
  }
  return events;
}

function rememberProfile(
  found: Map<string, Event>,
  event: unknown,
  requested: Set<string>,
) {
  const verified = cloneVerifiedEvent(event);
  if (!verified || verified.kind !== 0) return;
  const pubkey = verified.pubkey.toLowerCase();
  if (!requested.has(pubkey)) return;
  const previous = found.get(pubkey);
  if (
    !previous ||
    verified.created_at > previous.created_at ||
    (verified.created_at === previous.created_at && verified.id < previous.id)
  ) {
    found.set(pubkey, verified);
  }
}

async function collectBatches(
  ids: string[],
  load: (batch: string[]) => Promise<unknown[]>,
): Promise<unknown[]> {
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += PROFILE_BATCH_SIZE) {
    batches.push(ids.slice(offset, offset + PROFILE_BATCH_SIZE));
  }
  const settled = await Promise.all(
    batches.map((batch) => load(batch).catch(() => [] as unknown[])),
  );
  return settled.flat();
}

async function queryKind0(
  relays: string[],
  authors: string[],
): Promise<unknown[]> {
  const filter = {
    authors,
    kinds: [0],
    limit: Math.max(authors.length, 1),
  };
  const transport = getRelayTransport();
  if (transport) return transport.query(relays, filter);
  const result = await queryRelays(relays, filter);
  return result.events;
}

async function fetchSignedProfiles(authors: string[]): Promise<unknown[]> {
  const url = new URL(`${DIRECTORY_API_ORIGIN}/lookupNostrProfiles`);
  url.searchParams.set('pubkeys', authors.join(','));
  const { status, json } = await httpGetJson(url.toString());
  if (status < 200 || status >= 300) return [];
  return signedProfileEventsFromLookup(json);
}

const defaultSources: ZapperProfileSources = {
  queryKind0,
  fetchSignedProfiles,
};

/**
 * Kind 0 from indexer and archive relays, in parallel with signed profiles
 * from the directory API. A host `getProfiles` result is used when present.
 */
export async function loadZapperProfiles(
  authorIds: string[],
  relays: string[] = [],
  actionId?: string,
  sources: ZapperProfileSources = defaultSources,
): Promise<Map<string, Event>> {
  const ids = zapperPubkeyList(authorIds);
  const found = new Map<string, Event>();
  if (ids.length === 0) return found;

  const transport = getRelayTransport();
  const requested = new Set(ids);
  const relayList = zapperProfileRelays(relays);
  const getProfiles = transport?.getProfiles;
  const hostProfiles =
    actionId && getProfiles
      ? collectBatches(ids, (batch) => getProfiles(actionId, batch))
      : Promise.resolve([] as unknown[]);

  const [relayEvents, directoryEvents, hostedEvents] = await Promise.all([
    relayList.length
      ? collectBatches(ids, (batch) => sources.queryKind0(relayList, batch))
      : Promise.resolve([] as unknown[]),
    collectBatches(ids, (batch) => sources.fetchSignedProfiles(batch)),
    hostProfiles,
  ]);

  for (const event of [...relayEvents, ...directoryEvents, ...hostedEvents]) {
    rememberProfile(found, event, requested);
  }
  return found;
}
