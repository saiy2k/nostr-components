// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, nip19 } from 'nostr-tools';

await import('../lib/zap-http.js');
await import('../lib/storage.js');
await import('../lib/relay-client.js');

const extension = globalThis.NostrLikeExtension;

async function createAuthenticatedRelayRequest(channel, requestId, operation, payload) {
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
    data: await createAuthenticatedRelayRequest(channel, requestId, operation, payload)
  });
}

describe('extension profile and relay-list cache', function () {
  it('caps stored relay lists and leaves the signer list in memory', async function () {
    const stored = installStorage();
    const lists = [];
    for (let index = 0; index < extension.storage.RELAY_LIST_LIMIT + 1; index += 1) {
      const key = new Uint8Array(32).fill(index + 1);
      lists.push(finalizeEvent(
        {
          kind: 10002,
          created_at: 20 + index,
          content: '',
          tags: [['r', 'wss://nos.lol', 'read']]
        },
        key
      ));
    }
    for (const event of lists) {
      await extension.storage.setRelayList(event.pubkey, event);
    }
    expect(stored['nostr-relay-lists:v1']).toHaveLength(extension.storage.RELAY_LIST_LIMIT);
    expect(stored['nostr-relay-lists:v1'][0].pubkey).toBe(lists[lists.length - 1].pubkey);
    expect(await extension.storage.getRelayList(lists[0].pubkey)).toBeNull();
    expect(stored['nostr-zap-receipts:v1']).toBeUndefined();

    const signer = lists[lists.length - 1];
    const originalGetKnownPubkey = extension.storage.getKnownPubkey;
    extension.storage.getKnownPubkey = async function () {
      return signer.pubkey;
    };
    globalThis.browser.runtime = {
      async sendMessage(message) {
        if (message.type === 'LOOKUP_NOSTR_PROFILES') {
          return {
            ok: true,
            result: {
              profiles: [{
                pubkey: signer.pubkey,
                profileEvent: null,
                relayListEvent: signer,
                zappable: null
              }]
            }
          };
        }
        if (message.type === 'GET_URL_ACTIVITY') {
          const urlKey = String(message.items).split(':')[0];
          return {
            ok: true,
            result: {
              items: [{
                urlKey: urlKey,
                recipient: null,
                likes: 0,
                dislikes: 0,
                zapCount: null,
                sats: null
              }]
            }
          };
        }
        if (message.type === 'LIST_VIEWER_REACTIONS') {
          return { ok: false, error: 'viewer list failed' };
        }
        return { ok: false, error: 'unexpected extension message' };
      }
    };
    const session = openRelaySession();
    const channel = 'ab'.repeat(32);
    const actionId = 'cd'.repeat(32);
    const pageUrl = 'https://x.com/ada/status/42';
    const relaySession = extension.relayClient.configure(channel, {
      pool: { destroy: vi.fn(), publish: vi.fn(function () { return [Promise.resolve('ok')]; }) },
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: pageUrl,
      recipientNpub: null
    });
    await sendRelay(session, channel, '11'.repeat(16), 'getLikeState', {
      relays: ['wss://evil.example'],
      url: pageUrl
    });
    await vi.waitFor(async function () {
      expect(await extension.storage.getRelayList(signer.pubkey)).toBeNull();
    });
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
    extension.storage.getKnownPubkey = originalGetKnownPubkey;
  });

  it('reuses a fresh zap provider after the profile comes from the API', async function () {
    let now = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = installStorage();
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 15,
        tags: [],
        content: JSON.stringify({ lud16: 'ada@ln.example' })
      },
      new Uint8Array(32).fill(44)
    );
    const httpsCalls = [];
    let allowLnurl = true;
    globalThis.browser.runtime = {
      async sendMessage(message) {
        if (message.type === 'LOOKUP_NOSTR_PROFILES') {
          return {
            ok: true,
            result: {
              profiles: [{
                pubkey: profile.pubkey,
                profileEvent: profile,
                relayListEvent: null,
                zappable: true
              }]
            }
          };
        }
        httpsCalls.push(message.url);
        if (!allowLnurl || !String(message.url || '').includes('/.well-known/lnurlp/')) {
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
    const session = openRelaySession();
    const channel = '31'.repeat(32);
    const actionId = '32'.repeat(32);
    const relaySession = extension.relayClient.configure(channel, {
      pool: { destroy: vi.fn() },
      window: session.pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: 'https://x.com/ada/status/42',
      recipientNpub: nip19.npubEncode(profile.pubkey)
    });
    const providerRequest = {
      actionId: actionId,
      relays: ['wss://evil.example']
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
    expect(stored['nostr-zap-providers:v1'][0].pubkey).toBe(profile.pubkey);

    allowLnurl = false;
    now += 30 * 60 * 1000 + 1;
    await sendRelay(session, channel, '35'.repeat(16), 'getZapProvider', providerRequest);
    expect(session.responses[2].ok).toBe(true);
    expect(httpsCalls).toHaveLength(2);

    now += 24 * 60 * 60 * 1000;
    await sendRelay(session, channel, '36'.repeat(16), 'getZapProvider', providerRequest);
    expect(session.responses[3].ok).toBe(false);
    relaySession.dispose();
    extension.relayClient.revokeActionContext(actionId);
  });
});
