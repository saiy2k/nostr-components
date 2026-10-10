// SPDX-License-Identifier: MIT

import type { Event } from 'nostr-tools';
import { INDEXER_RELAYS, PROFILE_ARCHIVE_RELAYS } from '../common/constants';
import { cloneVerifiedEvent } from '../common/nostr-event';
import { queryRelays } from '../common/relay-routing';
import { getRelayTransport } from '../common/relay-transport';

const PROFILE_BATCH_SIZE = 50;
const HEX_64 = /^[0-9a-f]{64}$/;

export interface ZapperProfileSources {
  queryKind0(relays: string[], authors: string[]): Promise<unknown[]>;
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

const defaultSources: ZapperProfileSources = {
  queryKind0,
};

/**
 * Injected x.com and YouTube buttons ask the host for profiles. That host
 * reads the directory API. A generic site has no host, so kind 0 comes from
 * indexer, archive, and hint relays.
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

  const requested = new Set(ids);
  const getProfiles = getRelayTransport()?.getProfiles;
  const events =
    actionId && getProfiles
      ? await collectBatches(ids, (batch) => getProfiles(actionId, batch))
      : await collectBatches(ids, (batch) =>
          sources.queryKind0(zapperProfileRelays(relays), batch),
        );

  for (const event of events) rememberProfile(found, event, requested);
  return found;
}
