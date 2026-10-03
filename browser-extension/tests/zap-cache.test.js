// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, nip19 } from 'nostr-tools';
import {
  BOLT11_20U,
  BOLT11_20U_AMOUNT_MSATS
} from '../../src/nostr-zap-button/__tests__/fixtures';

await import('../lib/zap-http.js');
await import('../lib/storage.js');
await import('../lib/relay-client.js');

const extension = globalThis.NostrLikeExtension;

async function createAuthenticatedRelayRequest(
  channel,
  requestId,
  operation,
  payload
) {
  const message = {
    source: 'nostr-components-relay-main',
    requestId: requestId,
    operation: operation,
    payload: payload
  };
  const authenticator = extension.relayClient.createBridgeAuthenticator(channel);
  message.mac = await authenticator.signRequest(message);
  return message;
}

beforeEach(function () {
  vi.restoreAllMocks();
});

afterEach(function () {
  delete globalThis.browser;
  delete globalThis.chrome;
});

function installStorage() {
  const stored = {};
  globalThis.browser = {
    storage: {
      local: {
        async get(key) {
          return { [key]: stored[key] };
        },
        async set(next) {
          Object.assign(stored, next);
        }
      }
    }
  };
  return stored;
}

function openRelaySession() {
  const listeners = new Map();
  const responses = [];
  const pageWindow = {
    location: { origin: 'https://x.com' },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    postMessage(message) {
      responses.push(message);
    }
  };
  return { listeners: listeners, responses: responses, pageWindow: pageWindow };
}

async function sendRelay(session, channel, requestId, operation, payload) {
  await session.listeners.get('message')({
    source: session.pageWindow,
    origin: 'https://x.com',
    data: await createAuthenticatedRelayRequest(
      channel,
      requestId,
      operation,
      payload
    )
  });
}

describe('extension zap cache', function () {
  it('expires zap cache entries and keeps them under the cap', async function () {
    let now = 5_000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = installStorage();
    const provider = {
      lnurl: 'https://ln.example/.well-known/lnurlp/alice',
      callback: 'https://ln.example/callback',
      nostrPubkey: 'ab'.repeat(32),
      minSendable: 1000,
      maxSendable: 2000,
      commentAllowed: 0
    };
    const providerLimit = extension.storage.ZAP_PROVIDER_LIMIT;
    for (let index = 0; index < providerLimit + 5; index += 1) {
      await extension.storage.setZapProvider(
        index.toString(16).padStart(64, '0'),
        provider,
        60_000,
        24 * 60 * 60 * 1000
      );
    }
    const providers = stored['nostr-zap-providers:v1'];
    expect(providers).toHaveLength(providerLimit);
    expect(providers[0].pubkey).toBe((providerLimit + 4).toString(16).padStart(64, '0'));
    expect(providers.some(function (entry) {
      return entry.pubkey === '0'.repeat(64);
    })).toBe(false);

    now += 24 * 60 * 60 * 1000 + 1;
    expect(await extension.storage.getZapProvider(providers[0].pubkey)).toBeNull();
    expect(stored['nostr-zap-providers:v1']).toEqual([]);

    const receiptLimit = extension.storage.ZAP_RECEIPT_LIMIT;
    now = 5_000;
    for (let index = 0; index < receiptLimit + 3; index += 1) {
      const pubkey = (index + 1).toString(16).padStart(64, 'b');
      await extension.storage.setZapReceipt(
        pubkey,
        '39735:' + pubkey + ':https://x.com/alice/status/' + (index + 1),
        {
          totalSats: index + 1,
          eventCount: 1,
          rows: [{
            id: (index + 1).toString(16).padStart(64, 'c'),
            amountSats: index + 1,
            createdAt: 20,
            authorPubkey: 'd'.repeat(64),
            comment: 'thanks'
          }]
        },
        24 * 60 * 60 * 1000
      );
    }
    expect(stored['nostr-zap-receipts:v1']).toHaveLength(receiptLimit);
    expect(JSON.stringify(stored['nostr-zap-receipts:v1'])).not.toContain('lnbc');
  });

  it('reuses a fresh zap provider and falls back after the live lookup fails', async function () {
    let now = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = installStorage();
    const httpsCalls = [];
    let allowLnurl = true;
    globalThis.browser.runtime = {
      async sendMessage(message) {
        httpsCalls.push(message.url);
        if (!allowLnurl || !message.url.includes('/.well-known/lnurlp/')) {
          return { ok: false, error: 'LNURL request failed' };
        }
        return {
          ok: true,
          result: {
            status: 200,
            json: {
              allowsNostr: true,
              callback: 'https://ln.example/callback',
              nostrPubkey: 'e'.repeat(64),
              minSendable: 1000,
              maxSendable: 1000000,
              commentAllowed: 40
            }
          }
        };
      }
    };
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 15,
        tags: [],
        content: JSON.stringify({ lud16: 'ada@ln.example' })
      },
      new Uint8Array(32).fill(44)
    );
    let subscriptions = 0;
    const pool = {
      subscribe(_relays, _filter, options) {
        subscriptions += 1;
        queueMicrotask(function () {
          options.onevent(profile);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      },
      destroy: vi.fn()
    };
    const session = openRelaySession();
    const channel = '31'.repeat(32);
    const actionId = '32'.repeat(32);
    const relaySession = extension.relayClient.configure(channel, {
      pool: pool,
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: 'https://x.com/ada/status/42',
      recipientNpub: nip19.npubEncode(profile.pubkey)
    });
    const providerRequest = {
      actionId: actionId,
      relays: ['wss://relay.damus.io']
    };

    await sendRelay(session, channel, '33'.repeat(16), 'getZapProvider', providerRequest);
    await sendRelay(session, channel, '34'.repeat(16), 'getZapProvider', providerRequest);

    expect(session.responses[0].ok).toBe(true);
    expect(session.responses[0].result).toEqual({
      lnurl: 'https://ln.example/.well-known/lnurlp/ada',
      callback: 'https://ln.example/callback',
      nostrPubkey: 'e'.repeat(64)
    });
    expect(session.responses[1].result).toEqual(session.responses[0].result);
    expect(httpsCalls).toHaveLength(1);
    expect(subscriptions).toBe(1);
    expect(stored['nostr-zap-providers:v1'][0].pubkey).toBe(profile.pubkey);

    allowLnurl = false;
    now += 30 * 60 * 1000 + 1;
    await sendRelay(session, channel, '35'.repeat(16), 'getZapProvider', providerRequest);
    expect(session.responses[2].ok).toBe(true);
    expect(session.responses[2].result).toEqual(session.responses[0].result);
    expect(httpsCalls).toHaveLength(2);
    expect(subscriptions).toBe(1);

    now += 24 * 60 * 60 * 1000;
    await sendRelay(session, channel, '36'.repeat(16), 'getZapProvider', providerRequest);
    expect(session.responses[3].ok).toBe(false);
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
  });

  it('serves a fresh kind 0 from cache and replaces it only with a newer profile', async function () {
    let now = 20_000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    installStorage();
    const secret = new Uint8Array(32).fill(45);
    const older = finalizeEvent(
      {
        kind: 0,
        created_at: 10,
        tags: [],
        content: JSON.stringify({ name: 'Older', lud16: 'old@ln.example' })
      },
      secret
    );
    const newer = finalizeEvent(
      {
        kind: 0,
        created_at: 80,
        tags: [],
        content: JSON.stringify({ name: 'Newer', lud16: 'new@ln.example' })
      },
      secret
    );
    let phase = 'older';
    let subscriptions = 0;
    const pool = {
      subscribe(_relays, _filter, options) {
        subscriptions += 1;
        const event = phase === 'newer' ? newer : phase === 'empty' ? null : older;
        queueMicrotask(function () {
          if (event) options.onevent(event);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      },
      destroy: vi.fn()
    };
    const session = openRelaySession();
    const channel = '41'.repeat(32);
    const actionId = '42'.repeat(32);
    const relaySession = extension.relayClient.configure(channel, {
      pool: pool,
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: 'https://x.com/ada/status/43',
      recipientNpub: nip19.npubEncode(older.pubkey)
    });
    const profileRequest = {
      actionId: actionId,
      relays: ['wss://relay.damus.io'],
      filter: {
        kinds: [0],
        authors: [older.pubkey],
        limit: 1
      }
    };

    await sendRelay(session, channel, '43'.repeat(16), 'query', profileRequest);
    await sendRelay(session, channel, '44'.repeat(16), 'query', profileRequest);
    expect(session.responses[0].result.map(function (event) { return event.id; })).toEqual([older.id]);
    expect(session.responses[1].result.map(function (event) { return event.id; })).toEqual([older.id]);
    expect(subscriptions).toBe(1);

    now += 60 * 60 * 1000 + 1;
    phase = 'empty';
    await sendRelay(session, channel, '45'.repeat(16), 'query', profileRequest);
    expect(session.responses[2].result.map(function (event) { return event.id; })).toEqual([older.id]);
    expect(subscriptions).toBe(2);

    phase = 'newer';
    await sendRelay(session, channel, '46'.repeat(16), 'query', profileRequest);
    expect(session.responses[3].result.map(function (event) { return event.id; })).toEqual([newer.id]);
    expect(subscriptions).toBe(3);

    now += 60 * 60 * 1000 + 1;
    phase = 'older';
    await sendRelay(session, channel, '47'.repeat(16), 'query', profileRequest);
    expect(session.responses[4].result.map(function (event) { return event.id; })).toEqual([newer.id]);
    expect(subscriptions).toBe(4);
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
  });

  it('keeps a stored zap total when the receipt query comes back empty', async function () {
    let now = 30_000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = installStorage();
    const recipient = finalizeEvent(
      {
        kind: 0,
        created_at: 1,
        tags: [],
        content: '{}'
      },
      new Uint8Array(32).fill(46)
    );
    const statusUrl = 'https://x.com/ada/status/44';
    const aTag = '39735:' + recipient.pubkey + ':' + statusUrl;
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: 40,
        tags: [
          ['p', recipient.pubkey],
          ['bolt11', BOLT11_20U],
          ['description', JSON.stringify({
            pubkey: 'a'.repeat(64),
            content: 'thanks'
          })],
          ['a', aTag]
        ],
        content: ''
      },
      new Uint8Array(32).fill(47)
    );
    let emitReceipt = true;
    const pool = {
      subscribe(_relays, _filter, options) {
        queueMicrotask(function () {
          if (emitReceipt) options.onevent(receipt);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      },
      destroy: vi.fn()
    };
    const session = openRelaySession();
    const channel = '51'.repeat(32);
    const actionId = '52'.repeat(32);
    const relaySession = extension.relayClient.configure(channel, {
      pool: pool,
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: statusUrl,
      recipientNpub: nip19.npubEncode(recipient.pubkey)
    });
    const receiptRequest = {
      actionId: actionId,
      relays: ['wss://relay.damus.io'],
      filter: {
        kinds: [9735],
        '#p': [recipient.pubkey],
        '#a': [aTag],
        limit: 1000
      }
    };

    await sendRelay(session, channel, '53'.repeat(16), 'query', receiptRequest);
    emitReceipt = false;
    await sendRelay(session, channel, '54'.repeat(16), 'query', receiptRequest);

    expect(session.responses[0].result.map(function (event) { return event.id; })).toEqual([receipt.id]);
    expect(session.responses[1].result.map(function (event) { return event.id; })).toEqual([receipt.id]);
    expect(stored['nostr-zap-receipts:v1'][0]).toMatchObject({
      pubkey: recipient.pubkey,
      totalSats: BOLT11_20U_AMOUNT_MSATS / 1000,
      eventCount: 1
    });
    expect(JSON.stringify(stored['nostr-zap-receipts:v1'])).not.toContain(BOLT11_20U);

    now += 24 * 60 * 60 * 1000 + 1;
    await sendRelay(session, channel, '55'.repeat(16), 'query', receiptRequest);
    expect(session.responses[2].result).toEqual([]);
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
  });

  it('refetches the invoice after dropping a provider whose invoice failed', async function () {
    const stored = installStorage();
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 12,
        tags: [],
        content: JSON.stringify({ lud16: 'bea@ln.example' })
      },
      new Uint8Array(32).fill(48)
    );
    const contentUrl = 'https://x.com/bea/status/45';
    const amount = BOLT11_20U_AMOUNT_MSATS;
    const zapEvent = finalizeEvent(
      {
        kind: 9734,
        created_at: 13,
        content: '',
        tags: [
          ['p', profile.pubkey],
          ['amount', String(amount)],
          ['a', '39735:' + profile.pubkey + ':' + contentUrl],
          ['relays', 'wss://relay.damus.io/']
        ]
      },
      new Uint8Array(32).fill(49)
    );
    const httpsCalls = [];
    let invoiceAttempts = 0;
    globalThis.browser.runtime = {
      async sendMessage(message) {
        httpsCalls.push(message.url);
        if (message.url.includes('/.well-known/lnurlp/')) {
          return {
            ok: true,
            result: {
              status: 200,
              json: {
                allowsNostr: true,
                callback: 'https://ln.example/callback',
                nostrPubkey: 'f'.repeat(64),
                minSendable: amount,
                maxSendable: amount,
                commentAllowed: 0
              }
            }
          };
        }
        invoiceAttempts += 1;
        if (invoiceAttempts === 2) {
          return { ok: false, error: 'invoice failed' };
        }
        return {
          ok: true,
          result: {
            status: 200,
            json: { pr: BOLT11_20U }
          }
        };
      }
    };
    const pool = {
      subscribe(_relays, _filter, options) {
        queueMicrotask(function () {
          options.onevent(profile);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      },
      destroy: vi.fn()
    };
    const session = openRelaySession();
    const channel = '61'.repeat(32);
    const actionId = '62'.repeat(32);
    const relaySession = extension.relayClient.configure(channel, {
      pool: pool,
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: contentUrl,
      recipientNpub: nip19.npubEncode(profile.pubkey)
    });
    const invoiceRequest = {
      actionId: actionId,
      relays: ['wss://relay.damus.io'],
      amount: amount,
      comment: '',
      zapEvent: zapEvent
    };

    await sendRelay(session, channel, '63'.repeat(16), 'fetchZapInvoice', invoiceRequest);
    await sendRelay(session, channel, '64'.repeat(16), 'fetchZapInvoice', invoiceRequest);

    expect(session.responses[0].ok).toBe(true);
    expect(session.responses[0].result.invoice).toBe(BOLT11_20U);
    expect(session.responses[1].ok).toBe(true);
    expect(session.responses[1].result.invoice).toBe(BOLT11_20U);
    expect(httpsCalls.filter(function (url) {
      return url.includes('/.well-known/lnurlp/');
    })).toHaveLength(2);
    expect(httpsCalls.filter(function (url) {
      return url.includes('amount=' + amount);
    })).toHaveLength(3);
    expect(JSON.stringify(stored)).not.toContain(BOLT11_20U);
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
  });
});
