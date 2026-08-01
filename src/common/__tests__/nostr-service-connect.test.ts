// SPDX-License-Identifier: MIT

// Regression tests for the "Failed to connect to relays" bug: when several
// components mount on one page, they all call NostrService.connectToNostr()
// concurrently. Each call used to reassign ndk.explicitRelayUrls, whose NDK
// setter clears the relay pool and reopens every socket. With N components
// that meant N x 8 handshakes racing each other, the pool never looked
// connected at check time, and every component errored out.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Emulates NDK 2.13 semantics faithfully for the parts NostrService touches:
// - `set explicitRelayUrls(urls)` clears the pool and recreates all relays
//   (this is the destructive behavior at the heart of the bug)
// - relays transition to CONNECTED (5) asynchronously after a delay
const CONNECTED = 5;
// Tests can raise this beyond the service's grace period to simulate
// unreachable relays.
let relayConnectDelayMs = 300;

class FakeRelay {
  status = 4; // CONNECTING
  constructor(public url: string) {
    setTimeout(() => {
      this.status = CONNECTED;
    }, relayConnectDelayMs);
  }
}

const normalize = (url: string) => (url.endsWith('/') ? url : `${url}/`);

class FakeNDK {
  pool = { relays: new Map<string, FakeRelay>() };
  signer = undefined;
  explicitRelayUrlAssignments = 0;
  addExplicitRelayCalls: string[] = [];
  private _explicitRelayUrls: string[] = [];

  set explicitRelayUrls(urls: string[]) {
    this.explicitRelayUrlAssignments++;
    this._explicitRelayUrls = urls.map(normalize);
    this.pool.relays.clear();
    for (const url of urls) {
      this.pool.relays.set(normalize(url), new FakeRelay(normalize(url)));
    }
  }

  get explicitRelayUrls(): string[] {
    return this._explicitRelayUrls;
  }

  addExplicitRelay(url: string) {
    this.addExplicitRelayCalls.push(url);
    const normalized = normalize(url);
    if (!this.pool.relays.has(normalized)) {
      this.pool.relays.set(normalized, new FakeRelay(normalized));
    }
    this._explicitRelayUrls.push(normalized);
  }

  async connect(_timeoutMs?: number): Promise<void> {
    // Like real NDK, resolves without waiting for sockets to open.
  }
}

vi.mock('@nostr-dev-kit/ndk', () => ({
  default: FakeNDK,
  NDKRelayStatus: { CONNECTED },
  NDKKind: {},
  NDKUser: class {},
  NDKEvent: class {},
}));

const RELAYS = [
  'wss://relay.one',
  'wss://relay.two',
  'wss://relay.three',
];

async function freshService() {
  vi.resetModules();
  const { NostrService } = await import('../nostr-service');
  (NostrService as any).instance = undefined;
  const service = NostrService.getInstance();
  const ndk = (service as any).ndk as FakeNDK;
  return { service, ndk };
}

describe('NostrService.connectToNostr concurrency', () => {
  beforeEach(() => {
    relayConnectDelayMs = 300;
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shares a single connection attempt across concurrent callers', async () => {
    const { service, ndk } = await freshService();

    // Five components mounting at once, as on a real blog page.
    const attempts = Promise.all(
      Array.from({ length: 5 }, () => service.connectToNostr([...RELAYS]))
    );

    await vi.runAllTimersAsync();
    await expect(attempts).resolves.toBeDefined();

    // The pool-clearing setter must have run exactly once; every extra
    // assignment drops all in-flight sockets and restarts the handshakes.
    expect(ndk.explicitRelayUrlAssignments).toBe(1);
    expect(ndk.pool.relays.size).toBe(RELAYS.length);
    // Piggybacking callers carried the same relay list, so none of them
    // should have re-added relays after the shared attempt settled.
    expect(ndk.addExplicitRelayCalls).toEqual([]);
  });

  it('does not reset the pool when called again after a successful connect', async () => {
    const { service, ndk } = await freshService();

    const first = service.connectToNostr([...RELAYS]);
    await vi.runAllTimersAsync();
    await first;

    // Same list again (e.g. one more component mounts later). URL spelling
    // differs only by trailing slash, which NDK normalization adds.
    const second = service.connectToNostr([...RELAYS]);
    await vi.runAllTimersAsync();
    await second;

    expect(ndk.explicitRelayUrlAssignments).toBe(1);
    expect(ndk.addExplicitRelayCalls).toEqual([]);
  });

  it('lets a piggybacking caller add only genuinely new relays after the shared attempt', async () => {
    const { service, ndk } = await freshService();

    // Second caller starts while the first attempt is still in flight, with
    // trailing-slash variants of the known relays plus one new relay. It must
    // not restart the pool, and must add only the new relay exactly once
    // (listed twice here under different spellings).
    const first = service.connectToNostr([...RELAYS]);
    const second = service.connectToNostr([
      ...RELAYS.map(r => `${r}/`),
      'wss://relay.four',
      'wss://relay.four/',
    ]);

    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(ndk.explicitRelayUrlAssignments).toBe(1);
    expect(ndk.addExplicitRelayCalls).toEqual(['wss://relay.four']);
    expect(ndk.pool.relays.size).toBe(RELAYS.length + 1);
  });

  it('adds genuinely new relays without restarting the pool', async () => {
    const { service, ndk } = await freshService();

    const first = service.connectToNostr([...RELAYS]);
    await vi.runAllTimersAsync();
    await first;

    const second = service.connectToNostr([...RELAYS, 'wss://relay.four']);
    await vi.runAllTimersAsync();
    await second;

    expect(ndk.explicitRelayUrlAssignments).toBe(1);
    expect(ndk.addExplicitRelayCalls).toEqual(['wss://relay.four']);
    expect(ndk.pool.relays.size).toBe(4);
  });

  it('rejects all concurrent callers when no relay ever connects, then allows a retry', async () => {
    const { service } = await freshService();

    // Relays "connect" only long after the service's grace period expires,
    // which is indistinguishable from being unreachable.
    relayConnectDelayMs = 60_000;

    const attempts = Array.from({ length: 3 }, () =>
      service.connectToNostr(['wss://dead.relay']).catch((e: Error) => e)
    );

    await vi.runAllTimersAsync();

    const results = await Promise.all(attempts);
    for (const result of results) {
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Failed to connect');
    }

    // The in-flight promise must be cleared so a later attempt can run.
    expect((service as any).connectPromise).toBeNull();

    // A retry after the failure gets a fresh attempt that can succeed.
    relayConnectDelayMs = 300;
    const retry = service.connectToNostr(['wss://dead.relay']);
    await vi.runAllTimersAsync();
    await expect(retry).resolves.toBeUndefined();
  });
});
