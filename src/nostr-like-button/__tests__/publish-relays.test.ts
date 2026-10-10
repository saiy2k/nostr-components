// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publish, fromRelayUrls } = vi.hoisted(() => ({
  publish: vi.fn(),
  fromRelayUrls: vi.fn(),
}));

vi.mock('@nostr-dev-kit/ndk', () => ({
  default: class FakeNDK {},
  NDKEvent: class {
    constructor(_ndk: unknown, _event: unknown) {}
    publish(relaySet: unknown) {
      return publish(relaySet);
    }
  },
  NDKRelaySet: {
    fromRelayUrls,
  },
}));

import { publishSignedEventOnRelays } from '../like-utils';

const RELAYS = ['wss://relay.ditto.pub', 'wss://nostr.mom'];

describe('publishSignedEventOnRelays', () => {
  beforeEach(() => {
    publish.mockReset();
    fromRelayUrls.mockReset();
    publish.mockResolvedValue(new Set());
  });

  it('publishes to the given relays instead of the shared pool', async () => {
    const ndk = { pool: { relays: new Map() } };
    const relaySet = { relayUrls: RELAYS };
    fromRelayUrls.mockReturnValue(relaySet);
    const event = {
      id: 'abc',
      kind: 17,
      content: '+',
      tags: [],
      pubkey: 'ab'.repeat(32),
      created_at: 1,
      sig: 'sig',
    };

    await publishSignedEventOnRelays(ndk as never, event, RELAYS);

    expect(fromRelayUrls).toHaveBeenCalledWith(RELAYS, ndk);
    expect(publish).toHaveBeenCalledWith(relaySet);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
