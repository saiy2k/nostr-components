// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { finalizeEvent, nip19 } from 'nostr-tools';

import { EventEmitter as CspEventEmitter } from '../src/csp-event-emitter.js';
import {
  hydrateActionSlot,
  installComponentHydrator
} from '../src/component-hydrator.js';
import { createMainRelayTransport } from '../src/main-relay-transport';
import { fetchInvoiceForAction } from '../../src/nostr-zap-button/zap-utils';
import { getTrustedActionContext } from '../../src/common/trusted-action-context';
import {
  BOLT11_20U,
  BOLT11_20U_AMOUNT_MSATS
} from '../../src/nostr-zap-button/__tests__/fixtures';

await import('../lib/url.js');
await import('../lib/zap-http.js');
await import('../lib/storage.js');
await import('../lib/directory.js');
await import('../lib/relay-client.js');
await import('../lib/zap-invite.js');
await import('../lib/dom.js');
await import('../lib/youtube-dom.js');

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
  delete globalThis.document;
  delete globalThis.MutationObserver;
  delete globalThis.IntersectionObserver;
  delete globalThis.window;
  delete globalThis.__nostrComponentsRelayTransport;
});

describe('URL normalization', function () {
  it('uses the repository normalizer for X status identifiers', async function () {
    const parsed = extension.url.parseTweetUrl(
      '/Jack/status/1234567890/?s=20#fragment',
      'https://x.com'
    );

    expect(parsed).toEqual({
      pathname: '/Jack/status/1234567890',
      username: 'jack',
      statusId: '1234567890',
      canonicalUrl: 'https://x.com/jack/status/1234567890'
    });
    expect(await extension.url.urlKey('https://twitter.com/Jack/status/123?s=1')).toBe(
      'ef553a8af8cf4ce81ec85ef59d668f1840cd5ac188a51562b154b779974c0723'
    );
  });

  it('rejects status-shaped URLs from unsupported hosts', function () {
    expect(extension.url.parseTweetUrl('https://example.com/Jack/status/1234567890')).toBeNull();
  });

  it('maps twitter and mobile status hosts onto x.com', function () {
    const canonical = 'https://x.com/jack/status/1833951636005552366';
    expect(
      extension.url.parseTweetUrl(
        'https://twitter.com/jack/status/1833951636005552366'
      ).canonicalUrl
    ).toBe(canonical);
    expect(
      extension.url.parseTweetUrl(
        'https://m.x.com/jack/status/1833951636005552366?launch_app_store=true'
      ).canonicalUrl
    ).toBe(canonical);
  });

  it('canonicalizes YouTube watch and Shorts URLs to one video identifier', function () {
    expect(
      extension.url.parseYouTubeUrl(
        'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share#comments'
      )
    ).toEqual({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    expect(
      extension.url.parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=42')
    ).toEqual({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
  });

  it('rejects malformed YouTube video identifiers', function () {
    expect(extension.url.parseYouTubeUrl('https://www.youtube.com/watch?v=too-short')).toBeNull();
  });

  it('accepts only canonical lowercase npubs', function () {
    const npub = nip19.npubEncode('2'.repeat(64));
    expect(extension.url.isValidNpub(npub)).toBe(true);
    expect(extension.url.isValidNpub(npub.toUpperCase())).toBe(false);
  });
});

describe('Recent reaction storage', function () {
  it('restores a recent YouTube reaction from extension storage after page memory is lost', async function () {
    const values = {};
    globalThis.chrome = {
      runtime: {},
      storage: {
        local: {
          get(keys, callback) {
            const requested = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(
              requested
                .filter((key) => Object.hasOwn(values, key))
                .map((key) => [key, values[key]])
            ));
          },
          set(nextValues, callback) {
            Object.assign(values, nextValues);
            callback();
          }
        }
      }
    };
    const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const reaction = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', videoUrl]
        ],
        created_at: 1234567890
      },
      new Uint8Array(32).fill(9)
    );

    await extension.storage.setRecentReaction(reaction, 120_000);

    expect(await extension.storage.getRecentReactions(videoUrl)).toEqual([reaction]);
    expect(JSON.stringify(values)).toContain(reaction.id);
  });

  it('keeps a recent reaction until its event id is forgotten', async function () {
    const values = {};
    globalThis.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = {};
            for (const key of [].concat(keys)) result[key] = values[key];
            callback(result);
          },
          set(nextValues, callback) {
            Object.assign(values, nextValues);
            callback();
          }
        }
      }
    };
    const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const reaction = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', videoUrl]
        ],
        created_at: 1234567890
      },
      new Uint8Array(32).fill(9)
    );

    await extension.storage.setRecentReaction(reaction, 1);
    const later = Date.now() + 10 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    expect(await extension.storage.getRecentReactions(videoUrl)).toEqual([reaction]);
    await extension.storage.forgetRecentReaction(reaction.id);
    expect(await extension.storage.getRecentReactions(videoUrl)).toEqual([]);
  });
});

describe('Zap action integration', function () {
  const recipientNpub = nip19.npubEncode('1'.repeat(64));

  class FakeElement {
    constructor(tagName = 'div') {
      this.tagName = tagName.toLowerCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = '';
      this.parentElement = null;
      this.nextSibling = null;
      this.textContent = '';
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, function (_match, letter) {
          return letter.toUpperCase();
        });
        this.dataset[key] = String(value);
      }
    }

    getAttribute(name) {
      return this.attributes[name] ?? null;
    }

    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    insertBefore(child, reference) {
      const existing = this.children.indexOf(child);
      if (existing !== -1) this.children.splice(existing, 1);
      child.parentElement = this;
      const index = reference ? this.children.indexOf(reference) : -1;
      if (index === -1) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    }

    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }

    addEventListener(type, handler) {
      if (!this.listeners) this.listeners = {};
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(handler);
    }

    click() {
      const event = {
        preventDefault() {},
        stopPropagation() {},
        currentTarget: this
      };
      for (const handler of this.listeners?.click || []) {
        handler(event);
      }
    }

    querySelector(selector) {
      return this.children.find((child) => matchesActionChild(child, selector)) ?? null;
    }
  }

  function matchesActionChild(child, selector) {
    if (selector === 'nostr-like-button' || selector === 'nostr-zap-button') {
      return child.tagName === selector;
    }
    if (selector === 'button.nostr-zap-invite') {
      return child.tagName === 'button' && child.className === 'nostr-zap-invite';
    }
    return false;
  }

  beforeEach(function () {
    globalThis.document = {
      createElement(tagName) {
        return new FakeElement(tagName);
      }
    };
  });

  it('sets Zap attributes before connecting a newly constructed component', function () {
    const slot = new FakeElement('div');
    const attackerNpub = nip19.npubEncode('2'.repeat(64));
    Object.assign(slot.dataset, {
      nostrYoutubeAction: 'true',
      statusUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      theme: 'light',
      recipientNpub: attackerNpub
    });
    const connectionSnapshots = [];
    const appendChild = slot.appendChild.bind(slot);
    slot.appendChild = function (child) {
      if (child.tagName === 'nostr-zap-button') {
        connectionSnapshots.push({ ...child.attributes });
      }
      return appendChild(child);
    };

    class RegisteredLike extends FakeElement {
      constructor() {
        super('nostr-like-button');
      }
    }
    class RegisteredZap extends FakeElement {
      constructor() {
        super('nostr-zap-button');
      }
    }
    const constructors = new Map([
      ['nostr-like-button', RegisteredLike],
      ['nostr-zap-button', RegisteredZap]
    ]);

    expect(
      hydrateActionSlot(
        slot,
        {
          actionId: 'c'.repeat(64),
          kind: 'youtube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          theme: 'dark',
          recipientNpub: recipientNpub
        },
        {
          get(tagName) {
            return constructors.get(tagName);
          }
        }
      )
    ).toBe(true);
    expect(connectionSnapshots).toEqual([
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        compact: '',
        'data-theme': 'dark',
        'data-surface': 'youtube',
        npub: recipientNpub
      }
    ]);
    const zap = slot.querySelector('nostr-zap-button');
    zap.setAttribute('npub', attackerNpub);
    zap.setAttribute(
      'url',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
    );
    expect(getTrustedActionContext(zap)).toEqual({
      actionId: 'c'.repeat(64),
      kind: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      recipientNpub: recipientNpub
    });
  });

  it('replaces page-created components instead of granting trusted context', function () {
    const slot = new FakeElement('div');
    const attackerLike = new FakeElement('nostr-like-button');
    const attackerZap = new FakeElement('nostr-zap-button');
    slot.appendChild(attackerLike);
    slot.appendChild(attackerZap);

    class RegisteredLike extends FakeElement {
      constructor() {
        super('nostr-like-button');
      }
    }
    class RegisteredZap extends FakeElement {
      constructor() {
        super('nostr-zap-button');
      }
    }
    const registry = new Map([
      ['nostr-like-button', RegisteredLike],
      ['nostr-zap-button', RegisteredZap]
    ]);
    const context = {
      actionId: 'e'.repeat(64),
      kind: 'x',
      url: 'https://x.com/alice/status/42',
      theme: 'light',
      recipientNpub: recipientNpub
    };

    expect(
      hydrateActionSlot(slot, context, {
        get(tagName) {
          return registry.get(tagName);
        }
      })
    ).toBe(true);

    expect(slot.querySelector('nostr-like-button')).not.toBe(attackerLike);
    const trustedZap = slot.querySelector('nostr-zap-button');
    expect(trustedZap).not.toBe(attackerZap);
    expect(getTrustedActionContext(attackerLike)).toBeNull();
    expect(getTrustedActionContext(attackerZap)).toBeNull();

    expect(
      hydrateActionSlot(
        slot,
        { ...context, recipientNpub: null },
        {
          get(tagName) {
            return registry.get(tagName);
          }
        }
      )
    ).toBe(true);
    expect(slot.querySelector('nostr-zap-button')).toBeNull();
    expect(getTrustedActionContext(trustedZap)).toBeNull();
  });

  it('keeps Like ahead of a Zap control that was inserted first', function () {
    const slot = new FakeElement('div');
    const invite = new FakeElement('button');
    invite.className = 'nostr-zap-invite';
    slot.appendChild(invite);

    class RegisteredLike extends FakeElement {
      constructor() {
        super('nostr-like-button');
      }
    }
    class RegisteredZap extends FakeElement {
      constructor() {
        super('nostr-zap-button');
      }
    }
    const registry = {
      get(tagName) {
        return tagName === 'nostr-like-button' ? RegisteredLike : RegisteredZap;
      }
    };
    const context = {
      actionId: 'd'.repeat(64),
      kind: 'x',
      url: 'https://x.com/alice/status/42',
      theme: 'light',
      recipientNpub: null
    };

    expect(hydrateActionSlot(slot, context, registry)).toBe(true);
    expect(slot.children.map((child) => child.tagName)).toEqual([
      'nostr-like-button',
      'button'
    ]);

    expect(
      hydrateActionSlot(slot, { ...context, recipientNpub: recipientNpub }, registry)
    ).toBe(true);
    const like = slot.querySelector('nostr-like-button');
    const zap = slot.querySelector('nostr-zap-button');
    slot.children = [zap, invite, like];
    expect(
      hydrateActionSlot(slot, { ...context, recipientNpub: recipientNpub }, registry)
    ).toBe(true);
    expect(slot.children.map((child) => child.tagName)).toEqual([
      'nostr-like-button',
      'nostr-zap-button',
      'button'
    ]);
  });

  it('reads hydration target and detail through captured native accessors', function () {
    class EventSlot extends EventTarget {
      constructor() {
        super();
        this.children = [];
      }

      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      querySelector(selector) {
        return this.children.find(child => child.tagName === selector) || null;
      }
    }
    class RegisteredLike extends FakeElement {
      constructor() {
        super('nostr-like-button');
      }
    }
    class RegisteredZap extends FakeElement {
      constructor() {
        super('nostr-zap-button');
      }
    }
    const registry = new Map([
      ['nostr-like-button', RegisteredLike],
      ['nostr-zap-button', RegisteredZap]
    ]);
    const slot = new EventSlot();
    const attackerSlot = new EventSlot();
    const channel = 'f'.repeat(64);
    installComponentHydrator({
      channel,
      root: slot,
      registry: {
        get(tagName) {
          return registry.get(tagName);
        }
      }
    });

    const event = new CustomEvent(
      'nostr-components-hydrate:' + channel,
      {
        detail: {
          actionId: 'a'.repeat(64),
          kind: 'x',
          url: 'https://x.com/alice/status/42',
          theme: 'light',
          recipientNpub: recipientNpub
        }
      }
    );
    Object.defineProperty(event, 'target', {
      get() {
        return attackerSlot;
      }
    });
    Object.defineProperty(event, 'detail', {
      get() {
        return {
          actionId: 'a'.repeat(64),
          kind: 'x',
          url: 'https://x.com/alice/status/42',
          theme: 'light',
          recipientNpub: nip19.npubEncode('9'.repeat(64))
        };
      }
    });
    slot.dispatchEvent(event);

    expect(attackerSlot.querySelector('nostr-zap-button')).toBeNull();
    expect(slot.querySelector('nostr-zap-button').getAttribute('npub')).toBe(
      recipientNpub
    );
    const trustedZap = slot.querySelector('nostr-zap-button');
    slot.dispatchEvent(
      new Event('nostr-components-revoke:' + channel)
    );
    expect(slot.querySelector('nostr-like-button')).toBeNull();
    expect(slot.querySelector('nostr-zap-button')).toBeNull();
    expect(getTrustedActionContext(trustedZap)).toBeNull();
  });

  it('adds X Zap only for a verified zappable directory identity', function () {
    const action = extension.dom.createNostrAction(
      {
        canonicalUrl: 'https://x.com/alokdangre/status/42',
        statusId: '42',
        username: 'alokdangre'
      },
      'dark'
    );

    extension.dom.hydrateNostrAction(action.slot);
    extension.dom.applyDirectoryIdentity(action.slot, {
      found: true,
      verified: true,
      activeIdentity: { npub: recipientNpub, zappable: true }
    });

    const zap = action.slot.querySelector('nostr-zap-button');
    expect(zap).not.toBeNull();
    expect(zap.getAttribute('npub')).toBe(recipientNpub);
    expect(zap.getAttribute('url')).toBe('https://x.com/alokdangre/status/42');
    expect(zap.getAttribute('compact')).toBe('');
    expect(action.slot.querySelector('button.nostr-zap-invite')).toBeNull();
    expect(action.slot.dataset.zapRecipientNpub).toBe(recipientNpub);

    extension.dom.applyDirectoryIdentity(action.slot, {
      found: true,
      verified: false,
      activeIdentity: { npub: recipientNpub, zappable: true }
    });
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
    expect(action.slot.dataset.zapRecipientNpub).toBeUndefined();
    expect(action.slot.querySelector('button.nostr-zap-invite').getAttribute('data-invite-mode')).toBe('link');
    expect(action.slot.children.map((child) => child.tagName)).toEqual([
      'nostr-like-button',
      'button'
    ]);
  });

  it('keeps Like ahead of the Zap invite when directory lookup finishes first', function () {
    const action = extension.dom.createNostrAction(
      {
        canonicalUrl: 'https://x.com/alokdangre/status/42',
        statusId: '42',
        username: 'alokdangre'
      },
      'dark'
    );

    extension.dom.applyDirectoryIdentity(action.slot, {
      found: false,
      verified: false
    });
    expect(action.slot.children.map((child) => child.tagName)).toEqual(['button']);

    extension.dom.hydrateNostrAction(action.slot);
    expect(action.slot.children.map((child) => child.tagName)).toEqual([
      'nostr-like-button',
      'button'
    ]);
  });

  function openInvite(slot) {
    const opened = [];
    globalThis.window = {
      open(url) {
        opened.push(url);
        return null;
      }
    };
    slot.querySelector('button.nostr-zap-invite').click();
    return opened.length === 1 ? new URL(opened[0]) : null;
  }

  function createXAction() {
    const action = extension.dom.createNostrAction(
      {
        canonicalUrl: 'https://x.com/alokdangre/status/42',
        statusId: '42',
        username: 'alokdangre'
      },
      'dark'
    );
    extension.dom.hydrateNostrAction(action.slot);
    return action;
  }

  it('asks a verified non-zappable X author to add a Lightning address', function () {
    const action = createXAction();
    expect(action.slot.querySelector('button.nostr-zap-invite')).toBeNull();

    extension.dom.applyDirectoryIdentity(action.slot, {
      found: true,
      verified: true,
      activeIdentity: { npub: recipientNpub, zappable: false }
    });

    const invite = action.slot.querySelector('button.nostr-zap-invite');
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
    expect(action.slot.dataset.zapRecipientNpub).toBeUndefined();
    expect(invite.getAttribute('data-invite-mode')).toBe('lightning');
    expect(invite.getAttribute('aria-label')).toBe('Ask @alokdangre to add a Lightning address');
    expect(invite.getAttribute('title')).toBe('Ask @alokdangre to add a Lightning address');

    const intent = openInvite(action.slot);
    expect(intent.origin + intent.pathname).toBe('https://x.com/intent/post');
    expect(intent.searchParams.get('in_reply_to')).toBe('42');
    expect(intent.searchParams.get('text')).toBe(
      '@alokdangre This post is waiting on a place to send bitcoin. Add a Lightning address (name@domain) to your Nostr profile, from a wallet that accepts Nostr payments, and people can zap it.'
    );
  });

  it.each([
    ['not found', { found: false, verified: false }],
    ['unverified', { found: true, verified: false, activeIdentity: { npub: recipientNpub, zappable: true } }],
    ['unavailable', { found: false, verified: false, source: 'unavailable' }]
  ])('asks %s X authors to link Nostr', function (_label, identity) {
    const action = createXAction();
    extension.dom.applyDirectoryIdentity(action.slot, identity);

    const invite = action.slot.querySelector('button.nostr-zap-invite');
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
    expect(action.slot.dataset.zapRecipientNpub).toBeUndefined();
    expect(invite.getAttribute('data-invite-mode')).toBe('link');
    expect(invite.getAttribute('aria-label')).toBe('Ask @alokdangre to link Nostr so people can zap this');

    const intent = openInvite(action.slot);
    expect(intent.searchParams.get('in_reply_to')).toBe('42');
    expect(intent.searchParams.get('text')).toBe(
      '@alokdangre This post can carry more than the story. Link this account to your Nostr profile, add a Lightning address, and readers can zap you right from the thread. https://nostr-atlas.web.app'
    );
  });

  it('asks the author to link Nostr when directory lookup throws', function () {
    const action = createXAction();
    extension.dom.applyDirectoryIdentity(action.slot, null);

    expect(action.slot.dataset.directoryStatus).toBe('invalid');
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
    expect(action.slot.querySelector('button.nostr-zap-invite').getAttribute('data-invite-mode')).toBe('link');
    const intent = openInvite(action.slot);
    expect(intent.searchParams.get('text')).toContain('https://nostr-atlas.web.app');
  });

  it('hides both X Zap and the invite when a zappable npub is not checksum-valid', function () {
    const action = createXAction();
    extension.dom.applyDirectoryIdentity(action.slot, {
      found: true,
      verified: true,
      activeIdentity: { npub: 'npub1invalid', zappable: true }
    });

    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
    expect(action.slot.querySelector('button.nostr-zap-invite')).toBeNull();
    expect(action.slot.dataset.zapRecipientNpub).toBeUndefined();
  });

  it('does not open a reply when the X status id is not numeric', function () {
    const action = createXAction();
    extension.dom.applyDirectoryIdentity(action.slot, {
      found: false,
      verified: false
    });
    action.slot.dataset.statusId = 'not-a-status';
    expect(openInvite(action.slot)).toBeNull();
  });

  it('adds YouTube Like unconditionally and Zap for an explicitly declared valid npub', function () {
    const action = extension.youtubeDom.createNostrAction(
      {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      },
      'light',
      recipientNpub
    );

    extension.youtubeDom.hydrateNostrAction(action.slot);

    expect(action.slot.querySelector('nostr-like-button').getAttribute('url')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(action.slot.querySelector('nostr-like-button').getAttribute('data-surface')).toBe(
      'youtube'
    );
    expect(action.slot.querySelector('nostr-zap-button').getAttribute('npub')).toBe(recipientNpub);
    expect(action.slot.querySelector('nostr-zap-button').getAttribute('data-surface')).toBe(
      'youtube'
    );
  });

  it('adds YouTube Like without a creator npub or Zap recipient', function () {
    const action = extension.youtubeDom.createNostrAction(
      {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      },
      'light',
      null
    );

    extension.youtubeDom.hydrateNostrAction(action.slot);

    expect(action.slot.querySelector('nostr-like-button')).not.toBeNull();
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
  });

  it('extracts checksum-valid npubs only from the creator identity area', function () {
    const queriedSelectors = [];
    const root = {
      querySelectorAll(selector) {
        queriedSelectors.push(selector);
        return [
          { textContent: 'fake npub1' + 'q'.repeat(58), getAttribute: () => null },
          { textContent: 'Support me on Nostr: ' + recipientNpub, getAttribute: () => null }
        ];
      }
    };

    expect(extension.youtubeDom.extractDeclaredNpub(root)).toBe(recipientNpub);
    expect(queriedSelectors[0]).toContain('ytd-video-owner-renderer');
    expect(queriedSelectors[0]).toContain('ytd-reel-player-overlay-renderer');
    expect(queriedSelectors[0].split(',')).not.toContain('ytm-reel-player-overlay-renderer');
    expect(queriedSelectors[0].split(',')).not.toContain('ytm-shorts-player-overlay-renderer');
    expect(queriedSelectors[0]).not.toContain('meta');
    expect(queriedSelectors[0]).not.toContain('#description');
  });

  it('ignores npubs declared only in YouTube video content', function () {
    const root = {
      querySelectorAll(selector) {
        return selector.includes('description')
          ? [{ textContent: 'Send funds to ' + recipientNpub, getAttribute: () => null }]
          : [];
      }
    };

    expect(extension.youtubeDom.extractDeclaredNpub(root)).toBeNull();
  });

  it('does not use an npub in a Short title or description as the Zap recipient', function () {
    const overlayText = 'Short title ' + recipientNpub + ' and the description';
    const root = {
      querySelectorAll(selector) {
        return selector.split(',').some(function (part) {
          return part === 'ytm-reel-player-overlay-renderer' ||
            part === 'ytm-shorts-player-overlay-renderer';
        })
          ? [{ textContent: overlayText, getAttribute: () => null }]
          : [];
      }
    };

    expect(extension.youtubeDom.extractDeclaredNpub(root)).toBeNull();
  });

  it.each([
    '/@Blockstream',
    'https://www.youtube.com/channel/UChzLnWVsl3puKQwc5PoO6Zg'
  ])('does not infer a Zap recipient from the creator channel %s', function (href) {
    const root = {
      querySelectorAll(selector) {
        if (selector.includes('ytd-video-owner-renderer a[href]')) {
          return [{ getAttribute: (name) => name === 'href' ? href : null }];
        }
        return [];
      }
    };

    expect(extension.youtubeDom.resolveRecipientNpub(root)).toBeNull();
  });

  it('does not map an unknown creator channel to a zap recipient', function () {
    const root = {
      querySelectorAll(selector) {
        if (selector.includes('ytd-video-owner-renderer a[href]')) {
          return [{ getAttribute: () => '/@unknown-creator' }];
        }
        return [];
      }
    };

    expect(extension.youtubeDom.resolveRecipientNpub(root)).toBeNull();
  });

  it('matches stable YouTube channel IDs case-sensitively', function () {
    const root = {
      querySelectorAll(selector) {
        if (selector.includes('ytd-video-owner-renderer a[href]')) {
          return [{ getAttribute: () => '/channel/uchzlnwvsl3pukqwc5poo6zg' }];
        }
        return [];
      }
    };

    expect(extension.youtubeDom.resolveRecipientNpub(root)).toBeNull();
  });

  it('waits for the current watch container during an SPA transition', function () {
    globalThis.window = {
      location: {
        pathname: '/watch',
        origin: 'https://www.youtube.com'
      }
    };
    const previousContainer = {
      getAttribute(name) {
        return name === 'video-id' ? 'aqz-KE-bpKQ' : null;
      },
      querySelector() {
        return { id: 'previous-actions' };
      },
      querySelectorAll() {
        return [];
      }
    };
    const root = {
      querySelector() {
        return previousContainer;
      }
    };

    expect(
      extension.youtubeDom.findVideoContext(root, {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      })
    ).toBeNull();
  });

  it('accepts the bare mobile watch wrapper for the current watch URL', function () {
    globalThis.window = {
      location: {
        pathname: '/watch',
        origin: 'https://m.youtube.com'
      }
    };
    const actionBar = { id: 'mobile-actions' };
    const mobileWatch = {
      getAttribute() {
        return null;
      },
      querySelector(selector) {
        return selector.includes('slim-video-action-bar')
          ? actionBar
          : null;
      },
      querySelectorAll() {
        return [];
      }
    };
    const root = {
      querySelector(selector) {
        return selector === 'ytm-watch' ? mobileWatch : null;
      }
    };

    expect(
      extension.youtubeDom.findVideoContext(root, {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      })
    ).toEqual({
      container: mobileWatch,
      actionBar: actionBar
    });
  });

  it('resolves controls and recipient from the same video container', function () {
    globalThis.window = {
      location: {
        pathname: '/watch',
        origin: 'https://www.youtube.com'
      }
    };
    const previousRecipient = nip19.npubEncode('2'.repeat(64));
    const actionBar = { id: 'current-actions' };
    const currentContainer = {
      getAttribute(name) {
        return name === 'video-id' ? 'dQw4w9WgXcQ' : null;
      },
      querySelector(selector) {
        return selector.includes('top-level-buttons-computed')
          ? actionBar
          : null;
      },
      querySelectorAll(selector) {
        if (!selector.includes('channel')) return [];
        return [{
          getAttribute: () => null,
          textContent: 'Nostr: ' + recipientNpub
        }];
      }
    };
    const root = {
      querySelector() {
        return currentContainer;
      },
      querySelectorAll() {
        return [{
          getAttribute: () => null,
          textContent: 'Nostr: ' + previousRecipient
        }];
      }
    };

    const context = extension.youtubeDom.findVideoContext(root, {
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    expect(context).not.toBeNull();
    expect(context.actionBar).toBe(actionBar);
    expect(
      extension.youtubeDom.resolveRecipientNpub(context.container)
    ).toBe(recipientNpub);
  });

  it('ignores related-video links when identifying the active Short', function () {
    globalThis.window = {
      location: {
        pathname: '/shorts/dQw4w9WgXcQ',
        origin: 'https://www.youtube.com'
      }
    };
    const actionBar = { id: 'active-shorts-actions' };
    const activeContainer = {
      getAttribute() {
        return null;
      },
      querySelector(selector) {
        return selector.includes('#actions') ? actionBar : null;
      },
      querySelectorAll(selector) {
        return selector.startsWith('a[href')
          ? [{
              getAttribute: () =>
                '/watch?v=aqz-KE-bpKQ'
            }]
          : [];
      }
    };
    const root = {
      querySelector() {
        return activeContainer;
      }
    };

    expect(
      extension.youtubeDom.findVideoContext(root, {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      })
    ).toEqual({
      container: activeContainer,
      actionBar: actionBar
    });
  });

  it('does not reuse a stale active Shorts container after the URL changes', function () {
    const previousRecipient = nip19.npubEncode('2'.repeat(64));
    const makeShortsContainer = function (recipient) {
      const actionBar = { id: 'shorts-actions-' + recipient.slice(-6) };
      return {
        actionBar: actionBar,
        getAttribute() {
          return null;
        },
        querySelector(selector) {
          return selector.includes('#actions') ? actionBar : null;
        },
        querySelectorAll(selector) {
          if (selector.startsWith('a[href')) return [];
          return [{
            getAttribute: () => null,
            textContent: 'Nostr: ' + recipient
          }];
        }
      };
    };
    const previousContainer = makeShortsContainer(previousRecipient);
    const currentContainer = makeShortsContainer(recipientNpub);
    let activeContainer = previousContainer;
    const root = {
      querySelector() {
        return activeContainer;
      }
    };
    globalThis.window = {
      location: {
        pathname: '/shorts/aqz-KE-bpKQ',
        origin: 'https://www.youtube.com'
      }
    };

    expect(
      extension.youtubeDom.findVideoContext(root, {
        videoId: 'aqz-KE-bpKQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
      })
    ).not.toBeNull();

    globalThis.window.location.pathname = '/shorts/dQw4w9WgXcQ';
    expect(
      extension.youtubeDom.findVideoContext(root, {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      })
    ).toBeNull();

    activeContainer = currentContainer;
    const context = extension.youtubeDom.findVideoContext(root, {
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    expect(context.actionBar).toBe(currentContainer.actionBar);
    expect(
      extension.youtubeDom.resolveRecipientNpub(context.container)
    ).toBe(recipientNpub);
  });

  it('places Shorts actions on the active reel overlay instead of a watch-page action bar', function () {
    globalThis.window = {
      location: {
        pathname: '/shorts/dQw4w9WgXcQ',
        href: 'https://www.youtube.com/shorts/dQw4w9WgXcQ'
      }
    };
    const shortsActions = { id: 'shorts-actions' };
    const watchActions = { id: 'watch-actions' };
    const root = {
      querySelector(selector) {
        if (selector.includes('ytd-reel-video-renderer[is-active]') && selector.endsWith('#actions')) {
          return shortsActions;
        }
        if (selector.includes('top-level-buttons-computed')) return watchActions;
        return null;
      }
    };

    expect(extension.youtubeDom.findActionBar(root)).toBe(shortsActions);
  });

  it('does not inject into a leftover watch action bar on a Shorts URL', function () {
    globalThis.window = {
      location: {
        pathname: '/shorts/dQw4w9WgXcQ',
        href: 'https://www.youtube.com/shorts/dQw4w9WgXcQ'
      }
    };
    const root = {
      querySelector(selector) {
        if (selector.includes('top-level-buttons-computed')) return { id: 'watch-actions' };
        return null;
      }
    };

    expect(extension.youtubeDom.findActionBar(root)).toBeNull();
  });

  it('marks Shorts slots for the vertical overlay rail', function () {
    globalThis.window = {
      location: { pathname: '/shorts/dQw4w9WgXcQ' }
    };
    const action = extension.youtubeDom.createNostrAction(
      {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      },
      'light',
      null
    );

    expect(action.slot.getAttribute('data-youtube-surface')).toBe('shorts');
  });
});

describe('Firestore directory cache', function () {
  it('queries the background lookup and stores a sanitized identity', async function () {
    const stored = {};
    const requested = [];
    globalThis.browser = {
      runtime: {
        async sendMessage(message) {
          requested.push(message);
          return {
            ok: true,
            result: {
              found: true,
              verified: true,
              handle: message.handle,
              activeIdentity: { npub: 'npub1test' }
            }
          };
        }
      },
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

    const result = await extension.directory.lookup('ComponentUser');

    expect(requested).toEqual([
      {
        type: 'LOOKUP_DIRECTORY_HANDLE',
        platform: 'twitter',
        handle: 'componentuser'
      }
    ]);
    expect(result).toMatchObject({
      verified: true,
      source: 'firestore',
      activeIdentity: { npub: 'npub1test' }
    });
  });

  it('re-resolves entries after memory and storage expiry', async function () {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = {};
    const requested = [];
    globalThis.browser = {
      runtime: {
        async sendMessage(message) {
          requested.push(message);
          return {
            ok: true,
            result: {
              found: true,
              verified: true,
              handle: message.handle,
              activeIdentity: { npub: 'npub1expiring', zappable: true }
            }
          };
        }
      },
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

    await extension.directory.lookup('ExpiryUser');
    await extension.directory.lookup('ExpiryUser');
    expect(requested).toHaveLength(1);

    // After 1 hour, verified and zappable entry should still be cached (24h TTL)
    now += 60 * 60 * 1000 + 1;
    await extension.directory.lookup('ExpiryUser');
    expect(requested).toHaveLength(1);

    // After 24 hours + 1ms from start, cache expires and re-fetches
    now = 1000 + 24 * 60 * 60 * 1000 + 1;
    await extension.directory.lookup('ExpiryUser');
    expect(requested).toHaveLength(2);
  });

  it('expires verified but non-zappable directory records after one hour', async function () {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(function () {
      return now;
    });
    const stored = {};
    const requested = [];
    globalThis.browser = {
      runtime: {
        async sendMessage(message) {
          requested.push(message);
          return {
            ok: true,
            result: {
              found: true,
              verified: true,
              handle: message.handle,
              activeIdentity: { npub: 'npub1nonzappable', zappable: false }
            }
          };
        }
      },
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

    await extension.directory.lookup('NonZappableUser');
    await extension.directory.lookup('NonZappableUser');
    expect(requested).toHaveLength(1);

    // Still cached after 30 minutes
    now += 30 * 60 * 1000;
    await extension.directory.lookup('NonZappableUser');
    expect(requested).toHaveLength(1);

    // Re-resolves after 1 hour (MISS_TTL_MS)
    now = 1000 + 60 * 60 * 1000 + 1;
    await extension.directory.lookup('NonZappableUser');
    expect(requested).toHaveLength(2);
  });

  it('does not cache a lookup whose zap check is still unfinished', async function () {
    const stored = {};
    const requested = [];
    globalThis.browser = {
      runtime: {
        async sendMessage(message) {
          requested.push(message);
          return {
            ok: true,
            result: {
              found: true,
              verified: true,
              handle: message.handle,
              activeIdentity: {
                pubkey: 'ab'.repeat(32),
                npub: 'npub1pending',
                zappable: null,
                profileEvent: { kind: 0 },
                relayListEvent: { kind: 10002 }
              }
            }
          };
        }
      },
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

    const first = await extension.directory.lookup('PendingZap');
    const second = await extension.directory.lookup('PendingZap');
    expect(requested).toHaveLength(2);
    expect(first.activeIdentity.zappable).toBeNull();
    expect(second.activeIdentity.profileEvent).toBeUndefined();
    expect(second.activeIdentity.relayListEvent).toBeUndefined();
    expect(Object.keys(stored)).toHaveLength(0);
  });
});

describe('X action placement', function () {
  it("selects and inserts into the group that owns X's native Like", function () {
    const unrelatedGroup = { name: 'unrelated' };
    const viewsContainer = { name: 'views' };
    const actionBar = {
      querySelector() {
        return nativeLike;
      },
      insertBefore(slot, sibling) {
        this.inserted = { slot: slot, sibling: sibling };
      }
    };
    const likeContainer = {
      parentElement: actionBar,
      nextSibling: viewsContainer
    };
    const nativeLike = {
      parentElement: likeContainer,
      closest() {
        return actionBar;
      }
    };
    const article = {
      querySelector(selector) {
        return selector.includes('data-testid') ? nativeLike : unrelatedGroup;
      }
    };
    const nostrSlot = { name: 'nostr' };

    const selectedActionBar = extension.dom.findActionBar(article);
    extension.dom.insertAfterNativeLike(selectedActionBar, nostrSlot);

    expect(selectedActionBar).toBe(actionBar);
    expect(actionBar.inserted).toEqual({
      slot: nostrSlot,
      sibling: viewsContainer
    });
    expect(unrelatedGroup.inserted).toBeUndefined();
  });

  it('places the action after aria-label Like rows on logged-out X', function () {
    const viewsContainer = { name: 'views' };
    const actionBar = {
      children: { length: 5 },
      querySelector(selector) {
        if (String(selector).includes('data-testid')) return null;
        return null;
      },
      querySelectorAll(selector) {
        return selector === 'button'
          ? [replyButton, repostButton, likeButton]
          : [];
      },
      insertBefore(slot, sibling) {
        this.inserted = { slot: slot, sibling: sibling };
      }
    };
    const likeContainer = {
      parentElement: actionBar,
      nextSibling: viewsContainer
    };
    const likeButton = {
      getAttribute(name) {
        return name === 'aria-label' ? 'Like' : null;
      },
      parentElement: likeContainer,
      closest() {
        return null;
      }
    };
    const replyButton = {
      getAttribute(name) {
        return name === 'aria-label' ? 'Reply' : null;
      }
    };
    const repostButton = {
      getAttribute(name) {
        return name === 'aria-label' ? 'Repost' : null;
      }
    };
    likeContainer.contains = function (node) {
      return node === likeButton;
    };
    const article = {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'a[href*="/status/"]') return [quotedLink, ownLink];
        if (selector === 'button') return [replyButton, repostButton, likeButton];
        return [];
      }
    };
    const quotedLink = {
      getAttribute() {
        return '/gregisenberg/status/111';
      },
      parentElement: { parentElement: { parentElement: article } }
    };
    const ownLink = {
      getAttribute() {
        return '/jack/status/2082355452583526840';
      },
      parentElement: { parentElement: article }
    };
    likeButton.parentElement = likeContainer;
    likeContainer.parentElement = actionBar;
    actionBar.parentElement = article;
    replyButton.parentElement = actionBar;
    repostButton.parentElement = actionBar;

    globalThis.window = {
      location: {
        href: 'https://x.com/jack/status/2082355452583526840',
        origin: 'https://x.com'
      }
    };

    const tweetInfo = extension.dom.getTweetInfo(article);
    const selectedActionBar = extension.dom.findActionBar(article);
    extension.dom.insertAfterNativeLike(selectedActionBar, { name: 'nostr' });

    expect(tweetInfo.statusId).toBe('2082355452583526840');
    expect(tweetInfo.username).toBe('jack');
    expect(tweetInfo.canonicalUrl).toBe(
      'https://x.com/jack/status/2082355452583526840'
    );
    expect(selectedActionBar).toBe(actionBar);
    expect(actionBar.inserted).toEqual({
      slot: { name: 'nostr' },
      sibling: viewsContainer
    });
  });

  it('uses the opened status URL when the article only links /i/status', function () {
    const article = {
      querySelectorAll(selector) {
        if (selector === 'a[href*="/status/"]') return [statusLink];
        return [];
      }
    };
    const statusLink = {
      getAttribute() {
        return '/i/status/1833951636005552366';
      },
      querySelector() {
        return { closest() { return statusLink; } };
      },
      parentElement: article
    };
    globalThis.window = {
      location: {
        href: 'https://x.com/jack/status/1833951636005552366',
        origin: 'https://x.com'
      }
    };

    const tweetInfo = extension.dom.getTweetInfo(article);

    expect(tweetInfo).toMatchObject({
      username: 'jack',
      statusId: '1833951636005552366',
      canonicalUrl: 'https://x.com/jack/status/1833951636005552366'
    });
  });

  it('keeps a reply identity when the opened post is only quoted inside it', function () {
    const article = {
      querySelectorAll(selector) {
        if (selector === 'a[href*="/status/"]') return [replyLink, quotedLink];
        return [];
      }
    };
    const replyLink = {
      getAttribute() {
        return '/Rene/status/1833951862879334400';
      },
      querySelector() {
        return { closest() { return replyLink; } };
      },
      parentElement: article
    };
    const quotedLink = {
      getAttribute() {
        return '/jack/status/1833951636005552366';
      },
      querySelector() {
        return null;
      },
      parentElement: { parentElement: { parentElement: article } }
    };
    globalThis.window = {
      location: {
        href: 'https://x.com/jack/status/1833951636005552366',
        origin: 'https://x.com'
      }
    };

    const tweetInfo = extension.dom.getTweetInfo(article);

    expect(tweetInfo).toMatchObject({
      username: 'rene',
      statusId: '1833951862879334400',
      canonicalUrl: 'https://x.com/rene/status/1833951862879334400'
    });
  });

  it('contains clicks inside the complete Nostr action slot', function () {
    const listeners = {};
    class FakeElement {
      constructor(tagName) {
        this.tagName = tagName;
        this.attributes = {};
        this.children = [];
        this.dataset = {};
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, function (_match, letter) {
            return letter.toUpperCase();
          });
          this.dataset[key] = String(value);
        }
      }

      getAttribute(name) {
        return this.attributes[name] ?? null;
      }

      appendChild(child) {
        this.children.push(child);
      }

      addEventListener(type, listener) {
        listeners[type] = listener;
      }

      querySelector(selector) {
        return selector === 'nostr-like-button'
          ? (this.children.find((child) => child.tagName === 'nostr-like-button') ?? null)
          : null;
      }
    }

    globalThis.document = {
      createElement(tagName) {
        return new FakeElement(tagName);
      }
    };

    const action = extension.dom.createNostrAction(
      {
        canonicalUrl: 'https://x.com/alokdangre/status/42',
        statusId: '42',
        username: 'alokdangre'
      },
      'dark'
    );
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    listeners.click(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(action.slot.querySelector('nostr-like-button')).toBeNull();

    const component = extension.dom.hydrateNostrAction(action.slot);
    expect(component.getAttribute('compact')).toBe('');
    expect(component.getAttribute('url')).toBe('https://x.com/alokdangre/status/42');
  });

  it('stretches the action slot so standalone rows can vertically center the control', function () {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const slotRule = css.match(/\.nostr-competency-action-slot\s*\{[^}]+\}/);
    const standaloneRules = css.match(/^\.nostr-competency-action-slot\s*\{/gm) || [];

    expect(slotRule).not.toBeNull();
    expect(slotRule[0]).toMatch(/align-self:\s*stretch/);
    expect(slotRule[0]).toMatch(/gap:\s*2px/);
    expect(slotRule[0]).toMatch(/flex-direction:\s*row/);
    expect(slotRule[0]).toMatch(/direction:\s*ltr/);
    expect(slotRule[0]).not.toMatch(/(?:^|[^-])height:\s*34px/m);
    expect(standaloneRules).toHaveLength(1);
    expect(css).toMatch(
      /\.nostr-competency-action-slot > nostr-like-button\s*\{[^}]*order:\s*1/
    );
    expect(css).toMatch(
      /\.nostr-competency-action-slot > nostr-zap-button\s*\{[^}]*order:\s*2/
    );
    expect(css).toMatch(
      /\.nostr-competency-action-slot > button\.nostr-zap-invite\s*\{[^}]*order:\s*2/
    );
  });

  it('gives YouTube actions native-sized 40px controls instead of X timeline geometry', function () {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const slotRule = css.match(/\.nostr-youtube-action-slot\s*\{[^}]+\}/);

    expect(slotRule).not.toBeNull();
    expect(slotRule[0]).toMatch(/align-self:\s*center/);
    expect(slotRule[0]).toMatch(/min-height:\s*40px/);
    expect(slotRule[0]).toMatch(/margin-left:\s*4px/);
  });

  it('stacks Shorts actions in the vertical overlay rail', function () {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const shortsRule = css.match(
      /\.nostr-youtube-action-slot\[data-youtube-surface="shorts"\]\s*\{[^}]+\}/
    );

    expect(shortsRule).not.toBeNull();
    expect(shortsRule[0]).toMatch(/flex-direction:\s*column/);
    expect(shortsRule[0]).toMatch(/margin-left:\s*0/);
  });
});

describe('CSP-safe component and relay integration', function () {
  it('dispatches multiple and one-time NDK listeners without dynamic code generation', function () {
    const emitter = new CspEventEmitter();
    const calls = [];
    emitter.on('event', function (value) {
      calls.push('first:' + value);
    });
    emitter.once('event', function (value) {
      calls.push('once:' + value);
    });
    emitter.on('event', function (value) {
      calls.push('last:' + value);
    });

    expect(emitter.emit('event', 1)).toBe(true);
    expect(emitter.emit('event', 2)).toBe(true);
    expect(calls).toEqual([
      'first:1',
      'once:1',
      'last:1',
      'first:2',
      'last:2'
    ]);
  });

  it('binds CSP-safe event listeners to the emitter instance', function () {
    const emitter = new CspEventEmitter();
    let receiver;
    emitter.on('event', function () {
      receiver = this;
    });

    emitter.emit('event');

    expect(receiver).toBe(emitter);
  });

  it('loads the isolated controller before the private MAIN-world bundle', function () {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    const scripts = manifest.content_scripts[0].js;
    const mainWorldEntry = manifest.content_scripts[1];

    expect(scripts).toContain('lib/relay-client.js');
    expect(scripts).toContain('lib/zap-http.js');
    expect(scripts).toContain('lib/component-loader.js');
    expect(scripts.indexOf('lib/zap-http.js')).toBeLessThan(
      scripts.indexOf('lib/relay-client.js')
    );
    expect(scripts.indexOf('lib/relay-client.js')).toBeLessThan(
      scripts.indexOf('lib/component-loader.js')
    );
    expect(scripts).not.toContain('lib/nostr-like-button.js');
    expect(scripts).not.toContain('lib/nostr-zap-button.js');
    expect(scripts).not.toContain('lib/nostr-extension-components.js');
    expect(scripts).not.toContain('lib/signer-adapter.js');
    expect(manifest.content_scripts[0].run_at).toBe('document_start');
    expect(mainWorldEntry).toMatchObject({
      js: ['lib/nostr-extension-components.js'],
      run_at: 'document_start',
      world: 'MAIN'
    });
    expect(manifest.permissions).not.toContain('scripting');
    expect(manifest.content_scripts[0].matches).toEqual(
      expect.arrayContaining(['https://www.youtube.com/*', 'https://m.youtube.com/*'])
    );
    expect(manifest.host_permissions.filter(function (permission) {
      return permission.startsWith('wss://');
    })).toEqual([
      'wss://relay.ditto.pub/*',
      'wss://nostr.mom/*',
      'wss://relay.damus.io/*',
      'wss://nostr.oxtr.dev/*',
      'wss://relay.nostr.wirednet.jp/*'
    ]);
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining(['https://*/*'])
    );

    const componentBundle = readFileSync(
      new URL('../lib/nostr-extension-components.js', import.meta.url),
      'utf8'
    );
    const componentLoader = readFileSync(
      new URL('../lib/component-loader.js', import.meta.url),
      'utf8'
    );
    expect(componentBundle).toContain('customElements.define("nostr-like-button"');
    expect(componentBundle).toContain('customElements.define("nostr-zap-button"');
    expect(componentBundle).toContain('nostr-components-hydrate:');
    expect(componentBundle).toContain('nostr-components-relay-bootstrap:v2');
    expect(componentBundle).toContain('new ComponentConstructor()');
    expect(componentBundle).not.toMatch(
      /globalThis\.__nostrComponentsRelayTransport\s*=/,
    );
    expect(componentBundle).not.toMatch(/\basync handleLikeClick\s*\(/);
    expect(componentBundle).not.toMatch(/\basync handleZapClick\s*\(/);
    expect(componentBundle).not.toContain('this.handleLike(');
    expect(componentBundle).not.toContain('this.handleZapClick(');
    expect(componentBundle).toContain(
      'cachedDialogComponent.getDialogElement()'
    );
    expect(componentBundle).not.toContain('refreshUI(cachedDialog)');
    expect(componentBundle).not.toContain('__nostrComponentsTrustedHTMLPolicy');
    expect(componentBundle).toContain('factory.createPolicy(POLICY_NAME');
    expect(componentLoader).toContain('nostr-components-hydrate:');
    expect(componentLoader).toContain('nostr-components-relay-bootstrap:v2');
    expect(componentBundle).not.toMatch(/\beval\s*\(/);
  });

  it('keeps the relay capability out of the page global', async function () {
    const pageWindow = {
      location: { origin: 'https://x.com' },
      addEventListener: vi.fn(),
      postMessage: vi.fn()
    };
    const subtleFacade = {
      importKey: globalThis.crypto.subtle.importKey.bind(globalThis.crypto.subtle),
      sign: globalThis.crypto.subtle.sign.bind(globalThis.crypto.subtle),
      verify: globalThis.crypto.subtle.verify.bind(globalThis.crypto.subtle)
    };
    const cryptoFacade = {
      subtle: subtleFacade,
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    };
    const transport = createMainRelayTransport('a'.repeat(64), {
      crypto: cryptoFacade,
      pageWindow
    });

    expect(globalThis).not.toHaveProperty('__nostrComponentsRelayTransport');
    expect(Object.isFrozen(transport)).toBe(true);
    subtleFacade.sign = vi.fn(function () {
      throw new Error('page replaced SubtleCrypto.sign');
    });
    subtleFacade.verify = vi.fn(function () {
      return false;
    });
    cryptoFacade.getRandomValues = vi.fn(function () {
      throw new Error('page replaced crypto.getRandomValues');
    });

    const requestPromise = transport.getLikeState(
      ['wss://relay.damus.io'],
      'https://x.com/alice/status/42'
    );
    for (
      let attempt = 0;
      attempt < 20 && pageWindow.postMessage.mock.calls.length === 0;
      attempt += 1
    ) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const requestMessage = pageWindow.postMessage.mock.calls[0][0];
    const authenticator = extension.relayClient.createBridgeAuthenticator(
      'a'.repeat(64)
    );
    const replayedResponse = {
      source: 'nostr-components-relay-extension',
      requestId: requestMessage.requestId,
      requestMac: 'f'.repeat(64),
      operation: 'getLikeState',
      ok: true,
      result: { totalCount: 99, isLiked: true }
    };
    replayedResponse.mac = await authenticator.signResponse(replayedResponse);
    const responseHandler = pageWindow.addEventListener.mock.calls[0][1];
    let requestSettled = false;
    void requestPromise.then(() => {
      requestSettled = true;
    });
    await responseHandler({
      source: pageWindow,
      origin: 'https://x.com',
      data: replayedResponse
    });
    await Promise.resolve();
    expect(requestSettled).toBe(false);

    const wrongOperationResponse = {
      source: 'nostr-components-relay-extension',
      requestId: requestMessage.requestId,
      requestMac: requestMessage.mac,
      operation: 'query',
      ok: true,
      result: { totalCount: 99, isLiked: true }
    };
    wrongOperationResponse.mac = await authenticator.signResponse(
      wrongOperationResponse
    );
    await responseHandler({
      source: pageWindow,
      origin: 'https://x.com',
      data: wrongOperationResponse
    });
    await Promise.resolve();
    expect(requestSettled).toBe(false);

    const relayResponse = {
      source: 'nostr-components-relay-extension',
      requestId: requestMessage.requestId,
      requestMac: requestMessage.mac,
      operation: 'getLikeState',
      ok: true,
      result: { totalCount: 1, isLiked: false }
    };
    relayResponse.mac = await authenticator.signResponse(relayResponse);
    const handling = responseHandler({
      source: pageWindow,
      origin: 'https://x.com',
      data: relayResponse
    });
    relayResponse.result.totalCount = 999;

    await handling;
    await expect(requestPromise).resolves.toEqual({
      totalCount: 1,
      isLiked: false
    });
    expect(pageWindow.postMessage.mock.calls[0][0]).not.toHaveProperty(
      'channel'
    );
  });

  it('budgets for the bounded relay and HTTPS work in Zap requests', async function () {
    const scheduledDelays = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(function (
      _callback,
      delay
    ) {
      scheduledDelays.push(delay);
      return scheduledDelays.length;
    });
    let resolvePosted;
    let posted = new Promise(function (resolve) {
      resolvePosted = resolve;
    });
    const pageWindow = {
      location: { origin: 'https://x.com' },
      addEventListener() {},
      postMessage() {
        resolvePosted();
      }
    };
    const transport = createMainRelayTransport('9'.repeat(64), {
      crypto: globalThis.crypto,
      pageWindow,
      structuredClone: globalThis.structuredClone
    });

    void transport.getZapProvider('a'.repeat(64), [
      'wss://relay.damus.io'
    ]);
    await posted;

    posted = new Promise(function (resolve) {
      resolvePosted = resolve;
    });
    void transport.fetchZapInvoice('a'.repeat(64), {
      relays: ['wss://relay.damus.io'],
      amount: 21_000,
      comment: '',
      zapEvent: {}
    });
    await posted;

    const more = [
      () => transport.getLikeState(['wss://relay.damus.io'], 'https://x.com/a/status/1'),
      () => transport.getZapSummary('a'.repeat(64)),
      () => transport.listZaps('a'.repeat(64)),
      () => transport.getProfiles('a'.repeat(64), ['b'.repeat(64)]),
      () => transport.getZapRoute('a'.repeat(64)),
      () => transport.publish(['wss://relay.damus.io'], { kind: 17 }, 'a'.repeat(64)),
      () => transport.query(['wss://relay.damus.io'], { kinds: [9735] })
    ];
    for (const call of more) {
      posted = new Promise(function (resolve) {
        resolvePosted = resolve;
      });
      void call();
      await posted;
    }

    expect(scheduledDelays).toEqual([
      15_000,
      25_000,
      7_000,
      7_000,
      7_000,
      10_000,
      20_000,
      12_000,
      4_000
    ]);
  });

  it('accepts the document-start bootstrap once without exposing channels', async function () {
    const listeners = new Map();
    const removed = [];
    globalThis.document = {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type, listener) {
        removed.push({ type, listener });
        listeners.delete(type);
      }
    };
    const previousLoader = extension.componentLoader;
    const configure = vi
      .spyOn(extension.relayClient, 'configure')
      .mockReturnValue({ dispose: vi.fn() });
    const revokeActionContext = vi.spyOn(
      extension.relayClient,
      'revokeActionContext'
    );

    await import('../lib/component-loader.js?private-bootstrap');
    const loader = extension.componentLoader;
    const bootstrap = listeners.get('nostr-components-relay-bootstrap:v2');
    const hydrationChannel = 'b'.repeat(64);
    bootstrap({
      target: globalThis.document,
      detail: {
        relayChannel: 'a'.repeat(64),
        hydrationChannel
      }
    });

    await expect(loader.ready).resolves.toBe(true);
    expect(configure).toHaveBeenCalledOnce();
    expect(loader).not.toHaveProperty('channel');
    expect(removed).toHaveLength(1);

    let dispatchedEvent;
    const like = {};
    const slot = {
      dataset: {
        statusUrl: 'https://x.com/mallory/status/99',
        zapRecipientNpub: nip19.npubEncode('9'.repeat(64))
      },
      dispatchEvent(event) {
        dispatchedEvent = event;
      },
      querySelector() {
        return like;
      }
    };
    loader.registerAction(slot, {
      kind: 'x',
      url: 'https://x.com/alice/status/42',
      theme: 'dark',
      recipientNpub: nip19.npubEncode('1'.repeat(64))
    });
    loader.hydrate(slot);
    expect(dispatchedEvent.type).toBe(
      'nostr-components-hydrate:' + hydrationChannel
    );
    expect(dispatchedEvent.detail).toMatchObject({
      kind: 'x',
      url: 'https://x.com/alice/status/42',
      theme: 'dark',
      recipientNpub: nip19.npubEncode('1'.repeat(64))
    });
    expect(dispatchedEvent.detail.actionId).toMatch(/^[0-9a-f]{64}$/);
    const actionId = dispatchedEvent.detail.actionId;
    expect(loader.revokeAction(slot)).toBe(true);
    expect(revokeActionContext).toHaveBeenCalledWith(actionId);
    expect(dispatchedEvent.type).toBe(
      'nostr-components-revoke:' + hydrationChannel
    );
    expect(loader.revokeAction(slot)).toBe(false);

    extension.componentLoader = previousLoader;
  });

  it('proxies LNURL JSON through the background for supported senders', async function () {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async function () {
      return {
        status: 200,
        text: async function () {
          return JSON.stringify({ allowsNostr: true, callback: 'https://ln.example/cb' });
        }
      };
    });
    globalThis.fetch = fetchMock;
    let runtimeListener;
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          }
        }
      },
      scripting: { executeScript: vi.fn() }
    };

    await import('../background.js?https-json');
    const response = await new Promise(function (resolve) {
      runtimeListener(
        {
          type: 'FETCH_HTTPS_JSON',
          url: 'https://ln.example/.well-known/lnurlp/alice'
        },
        { url: 'https://x.com/jack/status/1' },
        resolve
      );
    });

    expect(response).toEqual({
      ok: true,
      result: {
        status: 200,
        json: { allowsNostr: true, callback: 'https://ln.example/cb' }
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ln.example/.well-known/lnurlp/alice',
      expect.objectContaining({ method: 'GET', redirect: 'error' })
    );
    globalThis.fetch = originalFetch;
  });

  it('rejects private HTTPS fetch targets and untrusted senders', async function () {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
    let runtimeListener;
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          }
        }
      },
      scripting: { executeScript: vi.fn() }
    };

    await import('../background.js?https-json-reject');
    const privateHost = await new Promise(function (resolve) {
      runtimeListener(
        { type: 'FETCH_HTTPS_JSON', url: 'https://127.0.0.1/.well-known/lnurlp/alice' },
        { url: 'https://x.com/home' },
        resolve
      );
    });
    const untrustedSender = await new Promise(function (resolve) {
      runtimeListener(
        { type: 'FETCH_HTTPS_JSON', url: 'https://ln.example/.well-known/lnurlp/alice' },
        { url: 'https://evil.example/page' },
        resolve
      );
    });

    expect(privateHost).toEqual({
      ok: false,
      error: 'HTTPS request contains an unsupported URL'
    });
    expect(untrustedSender).toEqual({
      ok: false,
      error: 'HTTPS fetch is restricted to supported sites'
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
  });

  it('accepts only scoped queries and valid signed kind-17 publishes', async function () {
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
      postMessage(message, targetOrigin) {
        responses.push({ message: message, targetOrigin: targetOrigin });
      }
    };
    const pageUrl = 'https://x.com/alokdangre/status/42';
    const pageKey = await extension.url.urlKey(pageUrl);
    const signerSecret = new Uint8Array(32).fill(7);
    const signerRelayList = finalizeEvent(
      {
        kind: 10002,
        created_at: 30,
        content: '',
        tags: [['r', 'wss://nos.lol', 'write']]
      },
      signerSecret
    );
    let releaseWrite;
    let writeFinished = false;
    const writeGate = new Promise(function (resolve) {
      releaseWrite = function () {
        writeFinished = true;
        resolve('saved');
      };
    });
    const pool = {
      subscribe: vi.fn(),
      subscribeMany: vi.fn(),
      publish: vi.fn(function (relays) {
        if (relays[0] === 'wss://nos.lol/') return [writeGate];
        if (relays[0] === 'wss://relay.ditto.pub/') return [Promise.resolve('saved')];
        return [new Promise(function () {})];
      }),
      destroy: vi.fn()
    };
    globalThis.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message.type === 'GET_URL_ACTIVITY') {
            const urlKey = String(message.items).split(':')[0];
            callback({
              ok: true,
              result: {
                items: [{
                  urlKey: urlKey,
                  recipient: null,
                  likes: 1,
                  dislikes: 0,
                  zapCount: null,
                  sats: null
                }]
              }
            });
            return;
          }
          if (message.type === 'LIST_VIEWER_REACTIONS') {
            callback({ ok: false, error: 'viewer list failed' });
            return;
          }
          if (message.type === 'LOOKUP_NOSTR_PROFILES') {
            callback({
              ok: true,
              result: {
                profiles: [{
                  pubkey: message.pubkeys,
                  profileEvent: null,
                  relayListEvent: signerRelayList,
                  zappable: null
                }]
              }
            });
            return;
          }
          if (message.type === 'INGEST_URL_EVENT') {
            callback({
              ok: true,
              result: {
                ok: true,
                activity: { urlKey: pageKey, likeCount: 2, dislikeCount: 0 }
              }
            });
            return;
          }
          callback({ ok: false, error: 'unexpected extension message' });
        }
      }
    };
    const originalGetKnownPubkey = extension.storage.getKnownPubkey;
    const originalSetKnownPubkey = extension.storage.setKnownPubkey;
    const originalSetRecentReaction = extension.storage.setRecentReaction;
    let knownPubkey = 'a'.repeat(64);
    extension.storage.getKnownPubkey = vi.fn(async function () {
      return knownPubkey;
    });
    extension.storage.setKnownPubkey = vi.fn(async function (pubkey) {
      knownPubkey = pubkey;
    });
    extension.storage.setRecentReaction = vi.fn(async function () {
      throw new Error('storage quota exceeded');
    });
    const channel = 'b'.repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow
    });
    const onMessage = listeners.get('message');
    const relays = ['wss://relay.damus.io'];
    const actionId = 'c'.repeat(64);
    const filter = {
      kinds: [17],
      '#k': ['web'],
      '#i': ['https://x.com/alokdangre/status/42'],
      limit: 1000
    };
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: filter['#i'][0]
    });

    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '0'.repeat(32),
        'getLikeState',
        { relays: relays, url: filter['#i'][0] }
      )
    });
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '6'.repeat(32),
        'getLikeState',
        {
          relays: relays,
          url: 'https://x.com/unrelated/status/999'
        }
      )
    });

    const signedEvent = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', 'https://x.com/alokdangre/status/42']
        ],
        created_at: 1234567890
      },
      signerSecret
    );
    const substitutedEvent = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', 'https://x.com/mallory/status/99']
        ],
        created_at: 1234567890
      },
      new Uint8Array(32).fill(8)
    );
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '7'.repeat(32),
        'publish',
        {
          relays: relays,
          event: substitutedEvent,
          actionId: actionId
        }
      )
    });
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '1'.repeat(32),
        'publish',
        { relays: relays, event: signedEvent, actionId: actionId }
      )
    });
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '2'.repeat(32),
        'getLikeState',
        { relays: relays, url: filter['#i'][0] }
      )
    });
    extension.relayClient.revokeActionContext(actionId);
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '3'.repeat(32),
        'publish',
        { relays: relays, event: signedEvent, actionId: actionId }
      )
    });

    expect(pool.subscribeMany).not.toHaveBeenCalled();
    expect(pool.publish).toHaveBeenCalledWith(
      ['wss://relay.ditto.pub/'],
      expect.objectContaining({ id: signedEvent.id })
    );
    expect(pool.publish).toHaveBeenCalledWith(
      ['wss://relay.damus.io/'],
      expect.objectContaining({ id: signedEvent.id })
    );
    await vi.waitFor(function () {
      expect(pool.publish).toHaveBeenCalledWith(
        ['wss://nos.lol/'],
        expect.objectContaining({ id: signedEvent.id })
      );
    });
    expect(writeFinished).toBe(false);
    releaseWrite();
    expect(responses.map((entry) => entry.message.ok)).toEqual([
      true,
      false,
      false,
      true,
      true,
      false
    ]);
    expect(responses[0].message.result).toEqual({
      totalCount: 1,
      likedCount: 1,
      dislikedCount: 0,
      isLiked: null
    });
    expect(JSON.stringify(responses[0].message)).not.toContain('a'.repeat(64));
    expect(responses[3].message.ok).toBe(true);
    expect(responses[4].message.result).toMatchObject({
      totalCount: 2,
      isLiked: true
    });
    expect(
      await extension.relayClient
        .createBridgeAuthenticator(channel)
        .verifyResponse(responses[0].message)
    ).toBe(true);
    expect(responses.every((entry) => !('channel' in entry.message))).toBe(true);
    expect(extension.storage.setKnownPubkey).toHaveBeenCalledWith(signedEvent.pubkey);
    expect(responses.every((entry) => entry.targetOrigin === 'https://x.com')).toBe(true);
    expect(extension.relayClient.validateFilter({ ...filter, kinds: [1] })).toBeNull();
    expect(
      extension.relayClient.validateReactionEvent({
        ...signedEvent,
        content: 'arbitrary relay proxy'
      })
    ).toBeNull();
    session.dispose();
    extension.storage.getKnownPubkey = originalGetKnownPubkey;
    extension.storage.setKnownPubkey = originalSetKnownPubkey;
    extension.storage.setRecentReaction = originalSetRecentReaction;
  });

  it('rejects a publish when the directory does not store the reaction', async function () {
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
    const pageUrl = 'https://x.com/alokdangre/status/77';
    const pool = {
      subscribe: vi.fn(),
      publish: vi.fn(function () {
        return [Promise.resolve('saved')];
      }),
      destroy: vi.fn()
    };
    globalThis.chrome = {
      runtime: {
        sendMessage(_message, callback) {
          callback({ ok: false, error: 'Directory API failed with status 500' });
        }
      }
    };
    const channel = 'd'.repeat(64);
    const actionId = 'e'.repeat(64);
    const originalGetKnownPubkey = extension.storage.getKnownPubkey;
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: pageUrl
    });
    const signedEvent = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', pageUrl]
        ],
        created_at: 1234567890
      },
      new Uint8Array(32).fill(4)
    );
    extension.storage.getKnownPubkey = async function () {
      return signedEvent.pubkey;
    };
    const onMessage = listeners.get('message');
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '8'.repeat(32),
        'publish',
        {
          relays: ['wss://relay.damus.io'],
          event: signedEvent,
          actionId: actionId
        }
      )
    });
    expect(responses[0]).toMatchObject({
      ok: false,
      error: 'Directory did not store the reaction'
    });
    globalThis.chrome.runtime.sendMessage = function (message, callback) {
      if (message.type === 'GET_URL_ACTIVITY') {
        callback({
          ok: true,
          result: {
            items: [{
              urlKey: String(message.items).split(':')[0],
              recipient: null,
              likes: 0,
              dislikes: 0,
              zapCount: null,
              sats: null
            }]
          }
        });
        return;
      }
      callback({ ok: false, error: 'viewer list failed' });
    };
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '9'.repeat(32),
        'getLikeState',
        { relays: ['wss://relay.damus.io'], url: pageUrl }
      )
    });
    expect(responses[1].result).toMatchObject({
      totalCount: 0,
      isLiked: true
    });
    session.dispose();
    extension.relayClient.revokeActionContext(actionId);
    extension.storage.getKnownPubkey = originalGetKnownPubkey;
  });

  it('accepts scoped YouTube reactions, profiles, and URL zap receipt filters', function () {
    const pubkey = 'a'.repeat(64);
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    expect(extension.relayClient.isAllowedContentUrl(youtubeUrl)).toBe(true);
    expect(
      extension.relayClient.validateFilter({
        kinds: [17],
        '#k': ['web'],
        '#i': [youtubeUrl],
        limit: 1000
      })
    ).not.toBeNull();
    expect(
      extension.relayClient.validateFilter({
        kinds: [0],
        authors: [pubkey],
        limit: 1
      })
    ).toEqual({ kinds: [0], authors: [pubkey], limit: 1 });
    expect(
      extension.relayClient.validateFilter({
        kinds: [9735],
        '#p': [pubkey],
        '#a': ['39735:' + pubkey + ':' + youtubeUrl],
        since: 123,
        limit: 100
      })
    ).not.toBeNull();
    expect(
      extension.relayClient.validateFilter({
        kinds: [9735],
        '#p': [pubkey],
        '#a': ['39735:' + 'b'.repeat(64) + ':' + youtubeUrl],
        limit: 100
      })
    ).toBeNull();
  });

  it('scopes zapper profile queries to a live action capability', async function () {
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
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 42,
        tags: [],
        content: JSON.stringify({ name: 'Zapper' })
      },
      new Uint8Array(32).fill(14)
    );
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
    const channel = '4'.repeat(64);
    const actionId = '5'.repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool,
      window: pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: 'https://x.com/alice/status/42',
      recipientNpub: null
    });
    globalThis.chrome = {
      runtime: {
        sendMessage(message, callback) {
          callback({
            ok: true,
            result: {
              profiles: [{
                pubkey: profile.pubkey,
                profileEvent: profile,
                relayListEvent: null,
                zappable: true
              }]
            }
          });
        }
      }
    };
    const request = (requestId) =>
      createAuthenticatedRelayRequest(
        channel,
        requestId,
        'getProfiles',
        {
          actionId,
          pubkeys: [profile.pubkey]
        }
      );

    await listeners.get('message')({
      source: pageWindow,
      origin: 'https://x.com',
      data: await request('4'.repeat(32))
    });
    extension.relayClient.revokeActionContext(actionId);
    await listeners.get('message')({
      source: pageWindow,
      origin: 'https://x.com',
      data: await request('5'.repeat(32))
    });

    expect(responses[0]).toMatchObject({
      ok: true,
      result: [expect.objectContaining({ id: profile.id })]
    });
    expect(responses[1].ok).toBe(false);
    session.dispose();
  });

  it('prepares only an action-bound Zap invoice in the isolated world', async function () {
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
    const recipientSecret = new Uint8Array(32).fill(12);
    const profiles = [
      finalizeEvent(
        {
          kind: 0,
          created_at: 10,
          tags: [],
          content: JSON.stringify({ lud16: 'alice@ln-a.example' })
        },
        recipientSecret
      ),
      finalizeEvent(
        {
          kind: 0,
          created_at: 10,
          tags: [],
          content: JSON.stringify({ lud16: 'alice@ln-b.example' })
        },
        recipientSecret
      )
    ].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    );
    const profile = profiles[0];
    const canonicalDomain = JSON.parse(profile.content).lud16.split('@')[1];
    const canonicalLnurl =
      'https://' + canonicalDomain + '/.well-known/lnurlp/alice';
    const recipientNpub = nip19.npubEncode(profile.pubkey);
    const contentUrl = 'https://x.com/alice/status/42';
    const amount = BOLT11_20U_AMOUNT_MSATS;
    const zapEvent = finalizeEvent(
      {
        kind: 9734,
        created_at: 11,
        content: '',
        tags: [
          ['p', profile.pubkey],
          ['amount', String(amount)],
          ['a', '39735:' + profile.pubkey + ':' + contentUrl],
          ['relays',
            'wss://relay.ditto.pub/',
            'wss://nostr.mom/',
            'wss://relay.damus.io/',
            'wss://nostr.oxtr.dev/',
            'wss://relay.nostr.wirednet.jp/'
          ]
        ]
      },
      new Uint8Array(32).fill(13)
    );
    const backgroundRequests = [];
    let actionId;
    let replaceActionDuringInvoice = false;
    globalThis.chrome = {
      runtime: {
        sendMessage(message, callback) {
          backgroundRequests.push(message);
          if (message.type === 'LOOKUP_NOSTR_PROFILES') {
            callback({
              ok: true,
              result: {
                profiles: [{
                  pubkey: profile.pubkey,
                  profileEvent: profile,
                  relayListEvent: null,
                  zappable: true
                }]
              }
            });
            return;
          }
          if (message.url.includes('/.well-known/lnurlp/')) {
            callback({
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
            });
          } else {
            if (replaceActionDuringInvoice) {
              extension.relayClient.registerActionContext(actionId, {
                kind: 'x',
                url: 'https://x.com/alice/status/43',
                recipientNpub: recipientNpub
              });
            }
            callback({
              ok: true,
              result: {
                status: 200,
                json: { pr: BOLT11_20U }
              }
            });
          }
        }
      }
    };
    const pool = {
      subscribe(_relays, _filter, options) {
        queueMicrotask(function () {
          options.onevent(profiles[1]);
          options.onevent(profiles[0]);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      },
      destroy: vi.fn()
    };
    const channel = 'd'.repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow
    });
    const onMessage = listeners.get('message');
    actionId = 'e'.repeat(64);
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: contentUrl,
      recipientNpub: recipientNpub
    });

    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '0'.repeat(32),
        'fetchZapInvoice',
        {
          actionId: actionId,
          relays: ['wss://relay.damus.io'],
          amount: amount,
          comment: '',
          zapEvent: zapEvent
        }
      )
    });
    replaceActionDuringInvoice = true;
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '2'.repeat(32),
        'fetchZapInvoice',
        {
          actionId: actionId,
          relays: ['wss://relay.damus.io'],
          amount: amount,
          comment: '',
          zapEvent: zapEvent
        }
      )
    });
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '1'.repeat(32),
        'httpGet',
        {
          relays: ['wss://relay.damus.io'],
          url: 'https://ln.example/private-proxy'
        }
      )
    });

    expect(responses[0].error).toBeUndefined();
    expect(responses[0].ok).toBe(true);
    expect(responses[0].result).toEqual({
      invoice: BOLT11_20U,
      provider: {
        lnurl: canonicalLnurl,
        callback: 'https://ln.example/callback',
        nostrPubkey: 'f'.repeat(64)
      }
    });
    expect(responses[1].ok).toBe(false);
    expect(responses[1].error).toContain('no longer active');
    expect(responses[2].ok).toBe(false);
    expect(backgroundRequests).toHaveLength(4);
    expect(backgroundRequests[0].type).toBe('LOOKUP_NOSTR_PROFILES');
    expect(backgroundRequests[1].url).toBe(canonicalLnurl);
    expect(backgroundRequests[2].url).toContain('amount=' + amount);
    expect(backgroundRequests[2].url).toContain(
      'nostr=' + encodeURIComponent(JSON.stringify(zapEvent))
    );
    expect(extension.zapHttp.isAllowedZapHttpUrl('https://ln.example/.well-known/lnurlp/alice')).toBe(true);
    expect(extension.zapHttp.isAllowedZapHttpUrl('https://127.0.0.1/.well-known/lnurlp/alice')).toBe(false);
    expect(extension.zapHttp.isAllowedZapHttpUrl('https://192.168.1.9/.well-known/lnurlp/alice')).toBe(false);
    expect(
      extension.zapHttp.isAllowedZapHttpUrl(
        'https://ln.example/callback?nostr=' + 'a'.repeat(3000)
      )
    ).toBe(true);
    expect(
      extension.zapHttp.isAllowedZapHttpUrl(
        'https://ln.example/callback?nostr=' + 'a'.repeat(9000)
      )
    ).toBe(false);
    session.dispose();
  });

  it('returns a persisted YouTube reaction before starting a relay query', async function () {
    const listeners = new Map();
    const responses = [];
    const pageWindow = {
      location: { origin: 'https://www.youtube.com' },
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
    const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
    const reaction = finalizeEvent(
      {
        kind: 17,
        content: '+',
        tags: [
          ['k', 'web'],
          ['i', videoUrl]
        ],
        created_at: 1234567890
      },
      new Uint8Array(32).fill(11)
    );
    const originalGetKnownPubkey = extension.storage.getKnownPubkey;
    const originalGetRecentReactions = extension.storage.getRecentReactions;
    extension.storage.getKnownPubkey = vi.fn(async function () {
      return reaction.pubkey;
    });
    extension.storage.getRecentReactions = vi.fn(async function () {
      return [reaction];
    });
    const pool = {
      subscribe: vi.fn(),
      subscribeMany: vi.fn(),
      destroy: vi.fn()
    };
    const channel = '9'.repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow
    });
    extension.relayClient.registerActionContext('8'.repeat(64), {
      kind: 'youtube',
      url: videoUrl,
      recipientNpub: null
    });

    await listeners.get('message')({
      source: pageWindow,
      origin: 'https://www.youtube.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        '8'.repeat(32),
        'getCachedLikeState',
        {
          relays: ['wss://relay.damus.io'],
          url: videoUrl
        }
      )
    });

    expect(responses[0]).toMatchObject({
      ok: true,
      result: { found: true, isLiked: true }
    });
    expect(pool.subscribe).not.toHaveBeenCalled();
    expect(pool.subscribeMany).not.toHaveBeenCalled();
    session.dispose();
    extension.storage.getKnownPubkey = originalGetKnownPubkey;
    extension.storage.getRecentReactions = originalGetRecentReactions;
  });

  it('queries a health-ranked relay quorum instead of waiting for all eight', async function () {
    const subscribedRelays = [];
    const pool = {
      subscribe(relays, _filter, options) {
        subscribedRelays.push(relays[0]);
        queueMicrotask(function () {
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      }
    };
    const relays = [
      'wss://relay.damus.io/',
      'wss://nostr.wine/',
      'wss://relay.nostr.net/',
      'wss://relay.nostr.band/',
      'wss://nos.lol/',
      'wss://nostr-pub.wellorder.net/',
      'wss://relay.getalby.com/',
      'wss://relay.primal.net/'
    ];

    await extension.relayClient.queryWithFastQuorum(pool, relays, {
      kinds: [17],
      '#k': ['web'],
      '#i': ['https://x.com/alokdangre/status/42'],
      limit: 1000
    });

    expect(subscribedRelays).toHaveLength(4);
    expect(subscribedRelays).not.toContain('wss://relay.nostr.band/');
  });

  it('closes a subscription returned after synchronous settlement', async function () {
    const close = vi.fn(async function () {});
    const pool = {
      subscribe(_relays, _filter, options) {
        options.oneose();
        return { close: close };
      }
    };

    await extension.relayClient.queryWithFastQuorum(pool, ['wss://relay.damus.io/'], {
      kinds: [17],
      '#k': ['web'],
      '#i': ['https://x.com/alokdangre/status/42'],
      limit: 1000
    });

    expect(close).toHaveBeenCalledOnce();
  });

  it('expires stale relay-health penalties', async function () {
    const originalRelayClient = extension.relayClient;
    await import('../src/relay-client.js?relay-health-expiry');
    try {
      const baseline = Date.now();
      let now = baseline;
      vi.spyOn(Date, 'now').mockImplementation(function () {
        return now;
      });
      const subscribedRelays = [];
      let failDamus = true;
      const pool = {
        subscribe(relays, _filter, options) {
          subscribedRelays.push(relays[0]);
          queueMicrotask(function () {
            if (failDamus && relays[0] === 'wss://relay.damus.io/') {
              options.onclose();
            } else {
              options.oneose();
            }
          });
          return { close: vi.fn(async function () {}) };
        }
      };
      const filter = {
        kinds: [17],
        '#k': ['web'],
        '#i': ['https://x.com/alokdangre/status/42'],
        limit: 1000
      };
      const relays = [
        'wss://relay.damus.io/',
        'wss://relay.getalby.com/',
        'wss://relay.primal.net/',
        'wss://nostr.wine/',
        'wss://relay.nostr.net/'
      ];

      await extension.relayClient.queryWithFastQuorum(pool, ['wss://relay.damus.io/'], filter);
      failDamus = false;
      subscribedRelays.splice(0, subscribedRelays.length);
      await extension.relayClient.queryWithFastQuorum(pool, relays, filter);
      expect(subscribedRelays).not.toContain('wss://relay.damus.io/');

      now += 5 * 60 * 1000 + 1;
      subscribedRelays.splice(0, subscribedRelays.length);
      await extension.relayClient.queryWithFastQuorum(pool, relays, filter);
      expect(subscribedRelays).toContain('wss://relay.damus.io/');
    } finally {
      extension.relayClient = originalRelayClient;
    }
  });

  it('does not count failed relays toward the successful response quorum', async function () {
    let subscriptionIndex = 0;
    const lateEvent = {
      id: '9'.repeat(64),
      pubkey: '8'.repeat(64),
      created_at: 30,
      kind: 17,
      content: '+',
      tags: [],
      sig: '7'.repeat(128)
    };
    const pool = {
      subscribe(_relays, _filter, options) {
        const index = subscriptionIndex++;
        queueMicrotask(function () {
          if (index === 0 || index === 2) {
            options.onclose();
            return;
          }
          if (index === 3) options.onevent(lateEvent);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      }
    };

    const events = await extension.relayClient.queryWithFastQuorum(
      pool,
      [
        'wss://relay.damus.io/',
        'wss://relay.getalby.com/',
        'wss://relay.primal.net/',
        'wss://nostr.wine/'
      ],
      {
        kinds: [17],
        '#k': ['web'],
        '#i': ['https://x.com/alokdangre/status/42'],
        limit: 1000
      }
    );

    expect(events).toContain(lateEvent);
  });

  it('keeps a zap receipt that arrives after three empty relay replies', async function () {
    const originalRelayClient = extension.relayClient;
    await import('../src/relay-client.js?zap-receipt-quorum');
    try {
      const listeners = new Map();
      const responses = [];
      const pageWindow = {
        location: { origin: 'https://x.com' },
        addEventListener(type, listener) {
          listeners.set(type, listener);
        },
        removeEventListener() {
          listeners.delete('message');
        },
        postMessage(message) {
          responses.push(message);
        }
      };
      const pubkey = 'c'.repeat(64);
      const statusUrl = 'https://x.com/jack/status/1833951636005552366';
      const providerSecret = new Uint8Array(32).fill(4);
      function signedReceipt(createdAt, recipient) {
        return finalizeEvent(
          {
            kind: 9735,
            created_at: createdAt,
            content: '',
            tags: [['p', recipient]]
          },
          providerSecret
        );
      }
      const receipt = signedReceipt(30, pubkey);
      const laterReceipt = signedReceipt(31, pubkey);
      const otherRecipient = signedReceipt(32, 'd'.repeat(64));
      const unsigned = {
        id: 'ab'.repeat(32),
        kind: 9735,
        pubkey: 'e'.repeat(64),
        tags: [['p', pubkey]]
      };
      let subscriptionIndex = 0;
      const watchedRelays = [];
      const pool = {
        subscribe(relays, _filter, options) {
          watchedRelays.push(relays[0]);
          const index = subscriptionIndex++;
          if (index < 3) {
            queueMicrotask(function () {
              options.oneose();
            });
            return { close: vi.fn(async function () {}) };
          }
          setTimeout(function () {
            options.onevent(unsigned);
            options.onevent(otherRecipient);
            options.onevent(receipt);
            options.onevent(laterReceipt);
            options.oneose();
          }, 25);
          return { close: vi.fn(async function () {}) };
        }
      };
      const channel = 'a'.repeat(64);
      const actionId = 'b'.repeat(64);
      const session = extension.relayClient.configure(channel, {
        pool: pool,
        window: pageWindow
      });
      extension.relayClient.registerActionContext(actionId, {
        kind: 'x',
        url: statusUrl,
        recipientNpub: nip19.npubEncode(pubkey)
      });

      await listeners.get('message')({
        source: pageWindow,
        origin: 'https://x.com',
        data: await createAuthenticatedRelayRequest(
          channel,
          '1'.repeat(32),
          'query',
          {
            actionId: actionId,
            relays: [
              'wss://relay.damus.io',
              'wss://relay.getalby.com',
              'wss://relay.primal.net',
              'wss://nostr.wine'
            ],
            filter: {
              kinds: [9735],
              '#p': [pubkey],
              '#a': ['39735:' + pubkey + ':' + statusUrl],
              since: 1,
              limit: 1000
            }
          }
        )
      });

      expect(responses[0].ok).toBe(true);
      expect(responses[0].result.map((event) => event.id)).toEqual([
        receipt.id,
        laterReceipt.id
      ]);
      expect(watchedRelays).toContain('wss://relay.ditto.pub/');
      expect(watchedRelays).not.toContain('wss://relay.getalby.com/');
      expect(watchedRelays).not.toContain('wss://relay.primal.net/');
      session.dispose();
    } finally {
      extension.relayClient = originalRelayClient;
    }
  });

  it('keeps the newer kind 0 when an older signed profile arrives first', async function () {
    const originalRelayClient = extension.relayClient;
    await import('../src/relay-client.js?profile-relay-quorum');
    try {
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
      const profileKey = new Uint8Array(32).fill(23);
      const profile = finalizeEvent(
        {
          kind: 0,
          created_at: 50,
          tags: [],
          content: JSON.stringify({
            name: 'LynAlden',
            nip05: 'lyn@primal.net',
            lud16: 'lyn@primal.net'
          })
        },
        profileKey
      );
      const olderProfile = finalizeEvent(
        {
          kind: 0,
          created_at: 10,
          tags: [],
          content: JSON.stringify({
            name: 'LynAlden',
            lud16: 'old@example.com'
          })
        },
        profileKey
      );
      const ownList = finalizeEvent(
        {
          kind: 10002,
          created_at: 5,
          content: '',
          tags: [['r', 'wss://nos.lol', 'write']]
        },
        profileKey
      );
      const otherList = finalizeEvent(
        {
          kind: 10002,
          created_at: 90,
          content: '',
          tags: [['r', 'wss://evil.example', 'write']]
        },
        new Uint8Array(32).fill(24)
      );
      const badList = JSON.parse(JSON.stringify(ownList));
      badList.sig = 'ab'.repeat(64);
      let phase = 'older';
      globalThis.chrome = {
        runtime: {
          sendMessage(_message, callback) {
            const profileEvent = phase === 'newer' ? profile : olderProfile;
            const relayListEvent = phase === 'bad' ? badList : phase === 'other' ? otherList : ownList;
            callback({
              ok: true,
              result: {
                profiles: [{
                  pubkey: profile.pubkey,
                  profileEvent: profileEvent,
                  relayListEvent: relayListEvent,
                  zappable: true
                }]
              }
            });
          }
        }
      };
      const pool = { subscribe: vi.fn(), destroy: vi.fn() };
      const channel = 'd'.repeat(64);
      const actionId = 'e'.repeat(64);
      const session = extension.relayClient.configure(channel, {
        pool: pool,
        window: pageWindow
      });
      extension.relayClient.registerActionContext(actionId, {
        kind: 'x',
        url: 'https://x.com/LynAldenContact/status/42',
        recipientNpub: nip19.npubEncode(profile.pubkey)
      });

      async function askProfiles(requestId) {
        await listeners.get('message')({
          source: pageWindow,
          origin: 'https://x.com',
          data: await createAuthenticatedRelayRequest(
            channel,
            requestId,
            'getProfiles',
            {
              actionId: actionId,
              pubkeys: [profile.pubkey]
            }
          )
        });
      }

      phase = 'bad';
      await askProfiles('1'.repeat(32));
      phase = 'other';
      await askProfiles('2'.repeat(32));
      phase = 'newer';
      await askProfiles('3'.repeat(32));
      phase = 'older';
      await askProfiles('4'.repeat(32));

      expect(pool.subscribe).not.toHaveBeenCalled();
      expect(responses[0].ok).toBe(true);
      expect(responses[0].result.map((event) => event.id)).toEqual([olderProfile.id]);
      expect(responses[1].result.map((event) => event.id)).toEqual([olderProfile.id]);
      expect(responses[2].result.map((event) => event.kind === 0 ? event.id : null).filter(Boolean)).toEqual([profile.id]);
      expect(responses[2].result.some((event) => event.pubkey === otherList.pubkey)).toBe(false);
      expect(responses[3].result.some((event) => event.id === profile.id)).toBe(true);
      expect(responses[3].result.some((event) => event.id === olderProfile.id)).toBe(false);
      expect(profile.pubkey).toBe(olderProfile.pubkey);
      expect(profile.id).not.toBe(olderProfile.id);
      session.dispose();
    } finally {
      extension.relayClient = originalRelayClient;
    }
  });

  it('keeps the newest YouTube profile for every requested author', async function () {
    const originalRelayClient = extension.relayClient;
    await import('../src/relay-client.js?youtube-profile-batch');
    try {
      const listeners = new Map();
      const responses = [];
      const pageWindow = {
        location: { origin: 'https://www.youtube.com' },
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
      const first = finalizeEvent(
        { kind: 0, created_at: 20, tags: [], content: JSON.stringify({ name: 'First' }) },
        new Uint8Array(32).fill(31)
      );
      const firstOlder = finalizeEvent(
        { kind: 0, created_at: 5, tags: [], content: JSON.stringify({ name: 'First old' }) },
        new Uint8Array(32).fill(31)
      );
      const second = finalizeEvent(
        { kind: 0, created_at: 15, tags: [], content: JSON.stringify({ name: 'Second' }) },
        new Uint8Array(32).fill(32)
      );
      const pool = {
        subscribe(_relays, _filter, options) {
          options.onevent(firstOlder);
          options.onevent(second);
          options.onevent(first);
          options.oneose();
          return { close() {} };
        },
        destroy: vi.fn()
      };
      const channel = 'a'.repeat(64);
      const actionId = 'b'.repeat(64);
      const session = extension.relayClient.configure(channel, {
        pool: pool,
        window: pageWindow
      });
      extension.relayClient.registerActionContext(actionId, {
        kind: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9wgxcQ',
        recipientNpub: nip19.npubEncode(first.pubkey)
      });
      await listeners.get('message')({
        source: pageWindow,
        origin: 'https://www.youtube.com',
        data: await createAuthenticatedRelayRequest(channel, 'c'.repeat(32), 'query', {
          actionId: actionId,
          relays: ['wss://relay.example'],
          filter: {
            kinds: [0],
            authors: [first.pubkey, second.pubkey],
            limit: 2
          }
        })
      });
      expect(responses[0].ok).toBe(true);
      expect(responses[0].result.map((event) => event.id).sort()).toEqual(
        [first.id, second.id].sort()
      );
      session.dispose();
    } finally {
      extension.relayClient = originalRelayClient;
    }
  });

  it('loads a Zap provider when only a slower relay has the profile', async function () {
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
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 50,
        tags: [],
        content: JSON.stringify({ lud16: 'btcsessions@getalby.com' })
      },
      new Uint8Array(32).fill(21)
    );
    const servicePubkey = 'b'.repeat(64);
    const backgroundRequests = [];
    globalThis.chrome = {
      runtime: {
        sendMessage(message, callback) {
          backgroundRequests.push(message);
          if (message.type === 'LOOKUP_NOSTR_PROFILES') {
            callback({
              ok: true,
              result: {
                profiles: [{
                  pubkey: profile.pubkey,
                  profileEvent: profile,
                  relayListEvent: null,
                  zappable: true
                }]
              }
            });
            return;
          }
          callback({
            ok: true,
            result: {
              status: 200,
              json: {
                allowsNostr: true,
                callback: 'https://getalby.com/lnurlp/btcsessions/callback',
                nostrPubkey: servicePubkey,
                minSendable: 1000,
                maxSendable: 10000000000,
                commentAllowed: 255
              }
            }
          });
        }
      }
    };
    const pool = {
      subscribe(relays, _filter, options) {
        const relay = relays[0];
        if (relay === 'wss://nostr.wine/') {
          setTimeout(function () {
            options.onevent(profile);
            options.oneose();
          }, 30);
          return { close: vi.fn(async function () {}) };
        }
        queueMicrotask(function () {
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      }
    };
    const channel = 'a'.repeat(64);
    const actionId = 'b'.repeat(64);
    const session = extension.relayClient.configure(channel, {
      pool: pool,
      window: pageWindow
    });
    extension.relayClient.registerActionContext(actionId, {
      kind: 'x',
      url: 'https://x.com/btcsessions/status/42',
      recipientNpub: nip19.npubEncode(profile.pubkey)
    });

    await listeners.get('message')({
      source: pageWindow,
      origin: 'https://x.com',
      data: await createAuthenticatedRelayRequest(
        channel,
        'c'.repeat(32),
        'getZapProvider',
        {
          actionId: actionId,
          relays: [
            'wss://relay.damus.io',
            'wss://relay.getalby.com',
            'wss://relay.primal.net',
            'wss://nostr.wine'
          ]
        }
      )
    });

    expect(responses[0].ok).toBe(true);
    expect(responses[0].error).toBeUndefined();
    expect(responses[0].result).toEqual({
      lnurl: 'https://getalby.com/.well-known/lnurlp/btcsessions',
      callback: 'https://getalby.com/lnurlp/btcsessions/callback',
      nostrPubkey: servicePubkey
    });
    expect(profile.pubkey).not.toBe(servicePubkey);
    expect(backgroundRequests.find((message) => message.type === 'FETCH_HTTPS_JSON').url).toBe(
      'https://getalby.com/.well-known/lnurlp/btcsessions'
    );
    session.dispose();
  });
});

it('signs a zap request with the route relays and accepts it on the bridge', async function () {
  const listeners = [];
  const pageWindow = {
    location: { origin: 'https://x.com' },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    removeEventListener() {},
    postMessage(message) {
      for (const listener of listeners.slice()) {
        listener({
          source: pageWindow,
          origin: 'https://x.com',
          data: message
        });
      }
    }
  };
  const recipientSecret = new Uint8Array(32).fill(19);
  const profile = finalizeEvent(
    {
      kind: 0,
      created_at: 10,
      tags: [],
      content: JSON.stringify({ lud16: 'alice@ln.example' })
    },
    recipientSecret
  );
  const readRelay = finalizeEvent(
    {
      kind: 10002,
      created_at: 11,
      content: '',
      tags: [['r', 'wss://nos.lol', 'read']]
    },
    recipientSecret
  );
  const watched = [];
  const pool = {
    subscribe(relays, _filter, options) {
      watched.push(relays[0]);
      queueMicrotask(function () {
        options.oneose();
      });
      return { close: vi.fn(async function () {}) };
    },
    destroy: vi.fn()
  };
  globalThis.chrome = {
    runtime: {
      sendMessage(message, callback) {
        if (message.type === 'LOOKUP_NOSTR_PROFILES') {
          callback({
            ok: true,
            result: {
              profiles: [{
                pubkey: profile.pubkey,
                profileEvent: profile,
                relayListEvent: readRelay,
                zappable: true
              }]
            }
          });
          return;
        }
        if (String(message.url || '').includes('/.well-known/lnurlp/')) {
          callback({
            ok: true,
            result: {
              status: 200,
              json: {
                allowsNostr: true,
                callback: 'https://ln.example/callback',
                nostrPubkey: 'f'.repeat(64),
                minSendable: 1000,
                maxSendable: 210000000,
                commentAllowed: 0
              }
            }
          });
          return;
        }
        callback({
          ok: true,
          result: { status: 200, json: { pr: BOLT11_20U } }
        });
      }
    }
  };
  const channel = 'c'.repeat(64);
  const actionId = 'd'.repeat(64);
  const pageUrl = 'https://x.com/alice/status/42';
  const session = extension.relayClient.configure(channel, {
    pool: pool,
    window: pageWindow
  });
  extension.relayClient.registerActionContext(actionId, {
    kind: 'x',
    url: pageUrl,
    recipientNpub: nip19.npubEncode(profile.pubkey)
  });
  const transport = createMainRelayTransport(channel, {
    crypto: globalThis.crypto,
    pageWindow: pageWindow,
    structuredClone: globalThis.structuredClone
  });
  globalThis.__nostrComponentsRelayTransport = transport;
  try {
    const route = await transport.getZapRoute(actionId);
    expect(route.zapRelays).toContain('wss://relay.ditto.pub/');
    expect(route.zapRelays).toContain('wss://nos.lol/');
    expect(route.zapRelays).not.toContain('wss://evil.example/');
    const paid = await fetchInvoiceForAction({
      actionId: actionId,
      amount: BOLT11_20U_AMOUNT_MSATS,
      comment: '',
      authorId: profile.pubkey,
      normalizedRelays: route.zapRelays,
      url: pageUrl
    });
    expect(paid.invoice).toBe(BOLT11_20U);
    await transport.query(['wss://evil.example/', 'wss://relay.damus.io/'], {
      kinds: [9735],
      '#p': [profile.pubkey],
      since: 1,
      limit: 10
    });
    expect(watched).toContain('wss://nos.lol/');
    expect(watched).toContain('wss://relay.ditto.pub/');
    expect(watched).not.toContain('wss://evil.example/');
  } finally {
    delete globalThis.__nostrComponentsRelayTransport;
    session.dispose();
    extension.relayClient.revokeActionContext(actionId);
  }
});

describe('timeline component integration', function () {
  it('injects the compact library component for a repost with equal-row spacing', async function () {
    const observerOptions = [];
    const observerCallbacks = [];
    const intersectionCallbacks = [];
    const scheduledCallbacks = [];

    class FakeElement {
      constructor(tagName = 'div') {
        this.tagName = tagName.toLowerCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.parentElement = null;
        this.nextSibling = null;
        this.className = '';
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, function (_match, letter) {
            return letter.toUpperCase();
          });
          this.dataset[key] = String(value);
        }
      }

      getAttribute(name) {
        return this.attributes[name] ?? null;
      }

      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
      }

      addEventListener() {}

      querySelector(selector) {
        if (selector === 'nostr-like-button') {
          return this.children.find((child) => child.tagName === 'nostr-like-button');
        }
        return null;
      }
    }

    const actionBar = new FakeElement();
    const viewsContainer = new FakeElement();
    const likeContainer = new FakeElement();
    likeContainer.parentElement = actionBar;
    likeContainer.nextSibling = viewsContainer;
    const nativeLike = new FakeElement('button');
    nativeLike.parentElement = likeContainer;
    nativeLike.closest = function () {
      return actionBar;
    };
    actionBar.querySelector = function (selector) {
      if (selector.includes('data-testid')) {
        return nativeLike;
      }
      return null;
    };
    actionBar.insertBefore = function (slot, sibling) {
      this.inserted = { slot: slot, sibling: sibling };
    };

    const statusAnchor = {
      getAttribute() {
        return '/original-author/status/4242';
      }
    };
    const timeElement = {
      closest() {
        return statusAnchor;
      }
    };
    const article = {
      dataset: { reposted: 'true' },
      querySelector(selector) {
        if (selector === 'a[href*="/status/"] time') {
          return timeElement;
        }
        if (selector.includes('data-testid')) {
          return nativeLike;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'a[href*="/status/"]') return [statusAnchor];
        return [];
      }
    };

    globalThis.document = {
      body: {},
      documentElement: {},
      createElement(tagName) {
        return new FakeElement(tagName);
      },
      querySelectorAll() {
        return [article];
      }
    };
    globalThis.MutationObserver = class {
      constructor(callback) {
        observerCallbacks.push(callback);
      }

      observe(_target, options) {
        observerOptions.push(options);
      }
    };
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        intersectionCallbacks.push(callback);
      }

      observe(target) {
        this.target = target;
      }

      unobserve() {}
    };
    globalThis.window = {
      location: { origin: 'https://x.com' },
      getComputedStyle() {
        return { colorScheme: 'dark' };
      },
      setTimeout(callback) {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      },
      requestAnimationFrame(callback) {
        callback();
      },
      addEventListener() {}
    };

    const originalDirectoryLookup = extension.directory.lookup;
    extension.directory.lookup = async function () {
      throw new Error('directory unavailable');
    };
    const revokeAction = vi.fn();
    extension.componentLoader = {
      ready: Promise.resolve(),
      revokeAction: revokeAction
    };
    vi.spyOn(console, 'warn').mockImplementation(function () {});

    try {
      await import('../content.js');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // A busy X page can mutate faster than INJECT_DELAY_MS. Repeated
      // observer notifications must not postpone the already scheduled scan.
      for (let index = 0; index < 10; index += 1) {
        observerCallbacks[0]();
      }
      expect(scheduledCallbacks).toHaveLength(1);
      scheduledCallbacks.shift()();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const slot = actionBar.inserted.slot;
      expect(actionBar.inserted.sibling).toBe(viewsContainer);
      expect(slot.dataset.statusId).toBe('4242');
      expect(slot.dataset.directoryStatus).toBe('invalid');
      expect(slot.querySelector('nostr-like-button')).toBeFalsy();

      intersectionCallbacks[0]([{ target: slot, isIntersecting: true }]);
      const component = slot.querySelector('nostr-like-button');
      expect(component.tagName).toBe('nostr-like-button');
      expect(component.getAttribute('url')).toBe('https://x.com/original-author/status/4242');
      expect(component.getAttribute('compact')).toBe('');
      expect(component.getAttribute('data-theme')).toBe('dark');
      expect(observerOptions).toEqual([
        { childList: true, subtree: true },
        { attributes: true, attributeFilter: ['class', 'style', 'dark'] },
        { attributes: true, attributeFilter: ['class', 'style', 'dark'] }
      ]);

      // Reparenting before MutationObserver delivery must not preserve the old
      // capability. A legitimate insertion will register a fresh action ID.
      slot.isConnected = true;
      observerCallbacks[0]([
        {
          removedNodes: [
            {
              matches() {
                return false;
              },
              querySelectorAll() {
                return [slot];
              }
            }
          ]
        }
      ]);
      expect(revokeAction).toHaveBeenCalledWith(slot);
    } finally {
      extension.directory.lookup = originalDirectoryLookup;
    }
  });

  it('ignores a directory lookup that finishes after the author handle changes', async function () {
    const scheduledCallbacks = [];
    const observerCallbacks = [];
    const aliceNpub = nip19.npubEncode('a'.repeat(64));
    const bobNpub = nip19.npubEncode('b'.repeat(64));
    let statusHref = '/alice/status/4242';
    const pendingLookups = [];

    class FakeElement {
      constructor(tagName = 'div') {
        this.tagName = tagName.toLowerCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.parentElement = null;
        this.nextSibling = null;
        this.className = '';
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, function (_match, letter) {
            return letter.toUpperCase();
          });
          this.dataset[key] = String(value);
        }
      }

      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
          ? this.attributes[name]
          : null;
      }

      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      insertBefore(child, sibling) {
        child.parentElement = this;
        const index = this.children.indexOf(sibling);
        if (index === -1) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
      }

      remove() {
        const parent = this.parentElement;
        if (!parent) return;
        parent.children = parent.children.filter((child) => child !== this);
        this.parentElement = null;
      }

      addEventListener() {}

      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      }

      querySelectorAll(selector) {
        const matches = [];
        const visit = (node) => {
          for (const child of node.children || []) {
            if (elementMatches(child, selector)) matches.push(child);
            visit(child);
          }
        };
        visit(this);
        return matches;
      }
    }

    function elementMatches(element, selector) {
      if (selector === 'button') return element.tagName === 'button';
      if (selector.includes('data-testid')) {
        return element.getAttribute('data-testid') === 'like' ||
          element.getAttribute('data-testid') === 'unlike';
      }
      const statusId = selector.match(/data-status-id="([^"]+)"/)?.[1];
      return Boolean(statusId) &&
        element.getAttribute('data-nostr-competency-like') === 'true' &&
        element.getAttribute('data-status-id') === statusId;
    }

    const actionBar = new FakeElement();
    const likeContainer = new FakeElement();
    const replyButton = new FakeElement('button');
    replyButton.setAttribute('aria-label', 'Reply');
    const likeButton = new FakeElement('button');
    likeButton.setAttribute('aria-label', 'Like');
    likeButton.setAttribute('data-testid', 'like');
    likeButton.closest = function () {
      return actionBar;
    };
    likeContainer.appendChild(likeButton);
    likeContainer.appendChild(replyButton);
    actionBar.appendChild(likeContainer);
    actionBar.appendChild(new FakeElement());
    actionBar.appendChild(new FakeElement());

    const statusAnchor = {
      getAttribute() {
        return statusHref;
      },
      querySelector() {
        return {};
      },
      parentElement: null
    };
    const article = {
      querySelector(selector) {
        if (String(selector).includes('data-testid')) return likeButton;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'a[href*="/status/"]') return [statusAnchor];
        if (selector === 'button') return [likeButton, replyButton];
        return [];
      }
    };
    statusAnchor.parentElement = article;

    globalThis.document = {
      body: new FakeElement('body'),
      documentElement: new FakeElement('html'),
      createElement(tagName) {
        return new FakeElement(tagName);
      },
      querySelectorAll() {
        return [article];
      }
    };
    globalThis.MutationObserver = class {
      constructor(callback) {
        observerCallbacks.push(callback);
      }

      observe() {}
    };
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
    };
    globalThis.window = {
      location: { hostname: 'x.com', origin: 'https://x.com', href: 'https://x.com/home' },
      getComputedStyle() {
        return { colorScheme: 'light' };
      },
      setTimeout(callback) {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      },
      requestAnimationFrame(callback) {
        callback();
      },
      addEventListener() {}
    };

    function identityFor(handle, npub) {
      return {
        verified: true,
        found: true,
        source: 'directory',
        activeIdentity: {
          npub: npub,
          zappable: true
        },
        handle: handle
      };
    }

    const originalDirectoryLookup = extension.directory.lookup;
    extension.directory.lookup = function (handle) {
      let resolveLookup;
      const promise = new Promise(function (resolve) {
        resolveLookup = resolve;
      });
      pendingLookups.push({ handle: handle, resolve: resolveLookup });
      return promise;
    };
    extension.componentLoader = {
      ready: Promise.resolve(),
      registerAction() {},
      updateAction() {},
      revokeAction() {}
    };
    vi.spyOn(console, 'warn').mockImplementation(function () {});

    try {
      await import('../content.js?directory-race');
      await new Promise((resolve) => setTimeout(resolve, 0));
      scheduledCallbacks.shift()();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pendingLookups.map((entry) => entry.handle)).toEqual(['alice']);
      statusHref = '/bob/status/4242';
      observerCallbacks[0]();
      scheduledCallbacks.shift()();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pendingLookups.map((entry) => entry.handle)).toEqual(['alice', 'bob']);
      const slot = actionBar.children.find(function (child) {
        return child.getAttribute?.('data-nostr-competency-like') === 'true';
      });
      pendingLookups[1].resolve(identityFor('bob', bobNpub));
      await new Promise((resolve) => setTimeout(resolve, 0));
      pendingLookups[0].resolve(identityFor('alice', aliceNpub));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(slot.dataset.authorHandle).toBe('bob');
      expect(slot.dataset.zapRecipientNpub).toBe(bobNpub);
    } finally {
      extension.directory.lookup = originalDirectoryLookup;
    }
  });
});

describe('YouTube component integration', function () {
  it('uses YouTube dark mode even when computed colorScheme incorrectly reports light', async function () {
    const scheduledCallbacks = [];
    const recipientNpub = nip19.npubEncode('4'.repeat(64));

    class FakeElement {
      constructor(tagName = 'div') {
        this.tagName = tagName.toLowerCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.parentElement = null;
        this.nextSibling = null;
        this.className = '';
      }

      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, function (_match, letter) {
            return letter.toUpperCase();
          });
          this.dataset[key] = String(value);
        }
      }

      getAttribute(name) {
        return this.attributes[name] ?? null;
      }

      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(
          (child) => child !== this
        );
      }

      insertBefore(child, sibling) {
        child.parentElement = this;
        const index = this.children.indexOf(sibling);
        if (index === -1) this.children.push(child);
        else this.children.splice(index, 0, child);
      }

      addEventListener() {}

      querySelector(selector) {
        if (selector === 'nostr-like-button' || selector === 'nostr-zap-button') {
          return this.children.find((child) => child.tagName === selector) ?? null;
        }
        if (selector.startsWith('[data-nostr-youtube-action=')) {
          const id = selector.match(/data-video-id="([^"]+)"/)?.[1];
          return this.children.find(
            (child) => child.dataset.nostrYoutubeAction === 'true' && child.dataset.videoId === id
          ) ?? null;
        }
        if (selector.includes('like-button-view-model')) return nativeLike;
        return null;
      }

      querySelectorAll(selector) {
        if (selector === '[data-nostr-youtube-action="true"]') {
          return this.children.filter((child) => child.dataset.nostrYoutubeAction === 'true');
        }
        return [];
      }
    }

    const actionBar = new FakeElement();
    const likeContainer = new FakeElement();
    const followingAction = new FakeElement();
    const nativeLike = new FakeElement('button');
    actionBar.appendChild(likeContainer);
    actionBar.appendChild(followingAction);
    likeContainer.nextSibling = followingAction;
    likeContainer.appendChild(nativeLike);

    const watchContainer = {
      getAttribute(name) {
        return name === 'video-id' ? 'dQw4w9WgXcQ' : null;
      },
      querySelector(selector) {
        return selector.includes('top-level-buttons-computed')
          ? actionBar
          : null;
      },
      querySelectorAll(selector) {
        if (!selector.includes('channel')) return [];
        return [{
          getAttribute: (name) => name === 'href' ? 'nostr:' + recipientNpub : null,
          textContent: 'Nostr: ' + recipientNpub
        }];
      }
    };
    globalThis.document = {
      body: {},
      documentElement: {
        hasAttribute(name) {
          return name === 'dark';
        }
      },
      createElement(tagName) {
        if (tagName === 'nostr-like-button' || tagName === 'nostr-zap-button') {
          throw new TypeError(
            'Class constructor ' + tagName + ' cannot be invoked without \'new\''
          );
        }
        return new FakeElement(tagName);
      },
      querySelector(selector) {
        return selector.startsWith('ytd-watch-flexy')
          ? watchContainer
          : null;
      },
      querySelectorAll(selector) {
        if (selector.includes('ytd-video-owner-renderer')) {
          return [{
            getAttribute: () => null,
            textContent: 'Nostr: ' + nip19.npubEncode('5'.repeat(64))
          }];
        }
        return [];
      }
    };
    globalThis.MutationObserver = class {
      constructor() {}
      observe() {}
    };
    globalThis.IntersectionObserver = class {
      observe() {
        throw new Error('YouTube actions must not wait for intersection');
      }
      unobserve() {}
    };
    globalThis.window = {
      location: {
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        hostname: 'www.youtube.com',
        origin: 'https://www.youtube.com'
      },
      getComputedStyle() {
        return { colorScheme: 'light' };
      },
      setTimeout(callback) {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      },
      requestAnimationFrame(callback) {
        callback();
      },
      addEventListener() {}
    };
    class RegisteredLike extends FakeElement {
      constructor() {
        super('nostr-like-button');
      }
    }
    class RegisteredZap extends FakeElement {
      constructor() {
        super('nostr-zap-button');
      }
    }
    const registry = new Map([
      ['nostr-like-button', RegisteredLike],
      ['nostr-zap-button', RegisteredZap]
    ]);
    const hydrate = vi.fn(function (slot) {
      return hydrateActionSlot(
        slot,
        {
          actionId: 'd'.repeat(64),
          kind: 'youtube',
          url: slot.dataset.statusUrl,
          theme: slot.dataset.theme,
          recipientNpub: slot.dataset.recipientNpub
        },
        {
          get(tagName) {
            return registry.get(tagName);
          }
        }
      );
    });
    extension.componentLoader = { ready: Promise.resolve(), hydrate: hydrate };

    await import('../content.js?youtube-content');
    await new Promise((resolve) => setTimeout(resolve, 0));
    scheduledCallbacks.shift()();

    const slot = actionBar.children[1];
    expect(slot.dataset.videoId).toBe('dQw4w9WgXcQ');
    expect(slot.querySelector('nostr-like-button').getAttribute('url')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(slot.querySelector('nostr-like-button').getAttribute('data-theme')).toBe('dark');
    expect(slot.querySelector('nostr-zap-button').getAttribute('npub')).toBe(
      recipientNpub
    );
    expect(hydrate).toHaveBeenCalledWith(slot);
  });
});
