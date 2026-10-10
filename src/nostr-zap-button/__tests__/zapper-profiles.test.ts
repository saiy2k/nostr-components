// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { zapperDisplayName } from '../render-zap-entry';
import { loadZapperProfiles, zapperProfileRelays } from '../zapper-profiles';
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

afterEach(() => {
  delete (globalThis as { __nostrComponentsRelayTransport?: unknown })
    .__nostrComponentsRelayTransport;
});

describe('zapper profiles', () => {
  it('queries indexer relays directly on a generic site', async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const profile = profileEvent(
      secret,
      { display_name: 'Sai', picture: 'https://cdn.example/sai.png' },
      20,
    );
    let queriedRelays: string[] = [];

    const profiles = await loadZapperProfiles(
      [pubkey],
      ['wss://hint.example'],
      undefined,
      {
        queryKind0: async (relays) => {
          queriedRelays = relays;
          return [profile];
        },
      },
    );

    expect(queriedRelays).toEqual(
      expect.arrayContaining([
        ...INDEXER_RELAYS,
        ...PROFILE_ARCHIVE_RELAYS,
        'wss://hint.example',
      ]),
    );
    const content = JSON.parse(profiles.get(pubkey)?.content || '{}');
    expect(zapperDisplayName(pubkey, content)).toBe('Sai');
    expect(content.picture).toBe('https://cdn.example/sai.png');
  });

  it('uses the host profile lookup for an injected x.com or YouTube button', async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const profile = profileEvent(secret, { display_name: 'Sai' }, 20);
    const actionId = 'a'.repeat(64);
    const getProfiles = vi.fn().mockResolvedValue([profile]);
    const query = vi.fn();
    const queryKind0 = vi.fn();
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query,
        publish: vi.fn(),
        getProfiles,
      },
    });

    const profiles = await loadZapperProfiles(
      [pubkey],
      ['wss://hint.example'],
      actionId,
      { queryKind0 },
    );

    expect(getProfiles).toHaveBeenCalledWith(actionId, [pubkey]);
    expect(queryKind0).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(zapperDisplayName(pubkey, JSON.parse(profiles.get(pubkey)?.content || '{}'))).toBe(
      'Sai',
    );
  });

  it('keeps a newer verified profile and ignores an unsigned one', async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const older = profileEvent(secret, { name: 'old' }, 10);
    const newer = profileEvent(secret, { display_name: 'Newer' }, 30);
    const spoofed = {
      ...newer,
      content: JSON.stringify({ display_name: 'Spoofed' }),
    };

    const profiles = await loadZapperProfiles([pubkey.toUpperCase()], [], undefined, {
      queryKind0: async () => [older, spoofed, newer],
    });

    expect(JSON.parse(profiles.get(pubkey)?.content || '{}').display_name).toBe(
      'Newer',
    );
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
