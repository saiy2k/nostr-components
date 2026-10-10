// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { zapperDisplayName } from '../render-zap-entry';
import {
  loadZapperProfiles,
  signedProfileEventsFromLookup,
  zapperProfileRelays,
} from '../zapper-profiles';
import { INDEXER_RELAYS, PROFILE_ARCHIVE_RELAYS } from '../../common/constants';

function profileEvent(
  secret: Uint8Array,
  content: Record<string, unknown>,
  createdAt: number,
) {
  return finalizeEvent(
    {
      kind: 0,
      created_at: createdAt,
      tags: [],
      content: JSON.stringify(content),
    },
    secret,
  );
}

describe('zapper profiles', () => {
  it('queries indexer relays and the directory API in parallel', async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const profile = profileEvent(
      secret,
      { display_name: 'Sai', picture: 'https://cdn.example/sai.png' },
      20,
    );
    let releaseRelay: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseRelay = resolve;
    });
    const seen: string[] = [];
    let queriedRelays: string[] = [];

    const pending = loadZapperProfiles(
      [pubkey],
      ['wss://hint.example'],
      undefined,
      {
        queryKind0: async (relays) => {
          seen.push('relay');
          queriedRelays = relays;
          await gate;
          return [profile];
        },
        fetchSignedProfiles: async (authors) => {
          seen.push('directory');
          expect(authors).toEqual([pubkey]);
          return [];
        },
      },
    );

    await Promise.resolve();
    expect(seen).toEqual(['relay', 'directory']);
    expect(queriedRelays).toEqual(
      expect.arrayContaining([
        ...INDEXER_RELAYS,
        ...PROFILE_ARCHIVE_RELAYS,
        'wss://hint.example',
      ]),
    );
    releaseRelay();

    const profiles = await pending;
    const content = JSON.parse(profiles.get(pubkey)?.content || '{}');
    expect(zapperDisplayName(pubkey, content)).toBe('Sai');
    expect(content.picture).toBe('https://cdn.example/sai.png');
  });

  it('prefers the newer signed profile and ignores an unsigned one', async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const older = profileEvent(secret, { name: 'old' }, 10);
    const newer = profileEvent(secret, { display_name: 'Newer' }, 30);
    const spoofed = {
      ...newer,
      content: JSON.stringify({ display_name: 'Spoofed' }),
    };

    const profiles = await loadZapperProfiles(
      [pubkey.toUpperCase()],
      [],
      undefined,
      {
        queryKind0: async () => [older],
        fetchSignedProfiles: async () => [spoofed, newer],
      },
    );

    expect(JSON.parse(profiles.get(pubkey)?.content || '{}').display_name).toBe(
      'Newer',
    );
    expect(zapperDisplayName(pubkey, { name: 'old' })).toBe('old');
  });

  it('reads signed profile events from a directory lookup body', () => {
    const secret = generateSecretKey();
    const event = profileEvent(secret, { name: 'Sai' }, 1);
    expect(
      signedProfileEventsFromLookup({
        profiles: [
          { pubkey: event.pubkey, profileEvent: event },
          { pubkey: 'ab' },
        ],
      }),
    ).toEqual([event]);
    expect(signedProfileEventsFromLookup(null)).toEqual([]);
  });

  it('includes lookup and indexer relays', () => {
    expect(
      zapperProfileRelays(['wss://hint.example', 'wss://hint.example']),
    ).toEqual(
      expect.arrayContaining([
        'wss://purplepag.es',
        'wss://relay.ditto.pub',
        'wss://hint.example',
      ]),
    );
  });
});
