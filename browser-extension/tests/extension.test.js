// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { finalizeEvent, nip19 } from 'nostr-tools';

import { EventEmitter as CspEventEmitter } from '../src/csp-event-emitter.js';
import { hydrateActionSlot } from '../src/component-hydrator.js';

await import('../lib/url.js');
await import('../lib/storage.js');
await import('../lib/directory.js');
await import('../lib/relay-client.js');
await import('../lib/dom.js');
await import('../lib/youtube-dom.js');

const extension = globalThis.NostrLikeExtension;

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
  it('uses the repository normalizer for X status identifiers', function () {
    const parsed = extension.url.parseTweetUrl(
      '/Jack/status/1234567890/?s=20#fragment',
      'https://x.com'
    );

    expect(parsed).toEqual({
      pathname: '/Jack/status/1234567890',
      username: 'jack',
      statusId: '1234567890',
      canonicalUrl: 'https://x.com/Jack/status/1234567890'
    });
  });

  it('rejects status-shaped URLs from unsupported hosts', function () {
    expect(extension.url.parseTweetUrl('https://example.com/Jack/status/1234567890')).toBeNull();
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

    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }

    addEventListener() {}

    querySelector(selector) {
      if (selector === 'nostr-like-button' || selector === 'nostr-zap-button') {
        return this.children.find((child) => child.tagName === selector) ?? null;
      }
      return null;
    }
  }

  beforeEach(function () {
    globalThis.document = {
      createElement(tagName) {
        return new FakeElement(tagName);
      }
    };
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

    extension.dom.applyDirectoryIdentity(action.slot, {
      found: true,
      verified: false,
      activeIdentity: { npub: recipientNpub, zappable: true }
    });
    expect(action.slot.querySelector('nostr-zap-button')).toBeNull();
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
              activeIdentity: { npub: 'npub1expiring' }
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

    now += 24 * 60 * 60 * 1000 + 1;
    await extension.directory.lookup('ExpiryUser');
    expect(requested).toHaveLength(2);
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
    expect(selectedActionBar).toBe(actionBar);
    expect(actionBar.inserted).toEqual({
      slot: { name: 'nostr' },
      sibling: viewsContainer
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
    expect(slotRule[0]).not.toMatch(/(?:^|[^-])height:\s*34px/m);
    expect(standaloneRules).toHaveLength(1);
  });

  it('gives YouTube actions native-sized 40px controls instead of X timeline geometry', function () {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const slotRule = css.match(/\.nostr-youtube-action-slot\s*\{[^}]+\}/);

    expect(slotRule).not.toBeNull();
    expect(slotRule[0]).toMatch(/align-self:\s*center/);
    expect(slotRule[0]).toMatch(/min-height:\s*40px/);
    expect(slotRule[0]).toMatch(/margin-left:\s*4px/);
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

  it('loads the relay client and MAIN-world component loader in order', function () {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    const scripts = manifest.content_scripts[0].js;

    expect(scripts).toContain('lib/relay-client.js');
    expect(scripts).toContain('lib/component-loader.js');
    expect(scripts.indexOf('lib/relay-client.js')).toBeLessThan(
      scripts.indexOf('lib/component-loader.js')
    );
    expect(scripts).not.toContain('lib/nostr-like-button.js');
    expect(scripts).not.toContain('lib/nostr-zap-button.js');
    expect(scripts).not.toContain('lib/nostr-extension-components.js');
    expect(scripts).not.toContain('lib/signer-adapter.js');
    expect(manifest.content_scripts[0].matches).toEqual(
      expect.arrayContaining(['https://www.youtube.com/*', 'https://m.youtube.com/*'])
    );
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'wss://relay.damus.io/*',
        'wss://nostr.wine/*',
        'wss://relay.nostr.net/*',
        'wss://relay.nostr.band/*',
        'wss://nos.lol/*',
        'wss://nostr-pub.wellorder.net/*',
        'wss://relay.getalby.com/*',
        'wss://relay.primal.net/*'
      ])
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
    expect(componentBundle).toContain('new ComponentConstructor()');
    expect(componentBundle).not.toContain('__nostrComponentsTrustedHTMLPolicy');
    expect(componentBundle).toContain('factory.createPolicy(POLICY_NAME');
    expect(componentLoader).toContain('nostr-components-hydrate:');
    expect(componentBundle).not.toMatch(/\beval\s*\(/);
  });

  it("injects the transport before the real components in X's MAIN world", async function () {
    let runtimeListener;
    const executeScript = vi.fn(async function () {
      return [];
    });
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          }
        }
      },
      scripting: { executeScript: executeScript }
    };

    await import('../background.js');

    const response = await new Promise(function (resolve) {
      const staysOpen = runtimeListener(
        {
          type: 'INJECT_NOSTR_COMPONENTS',
          channel: 'a'.repeat(64)
        },
        { tab: { id: 87 }, frameId: 0, url: 'https://x.com/home' },
        resolve
      );
      expect(staysOpen).toBe(true);
    });

    expect(response).toEqual({ ok: true, result: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript.mock.calls[0][0]).toMatchObject({
      target: { tabId: 87, frameIds: [0] },
      world: 'MAIN',
      func: expect.any(Function),
      args: ['a'.repeat(64)]
    });
    expect(executeScript.mock.calls[1][0]).toEqual({
      target: { tabId: 87, frameIds: [0] },
      world: 'MAIN',
      files: ['lib/nostr-extension-components.js']
    });
  });

  it("allows component injection in YouTube's validated top-level frame", async function () {
    let runtimeListener;
    const executeScript = vi.fn(async function () {
      return [];
    });
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          }
        }
      },
      scripting: { executeScript: executeScript }
    };

    await import('../background.js?youtube-injection');
    const response = await new Promise(function (resolve) {
      runtimeListener(
        { type: 'INJECT_NOSTR_COMPONENTS', channel: 'c'.repeat(64) },
        { tab: { id: 88 }, frameId: 0, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        resolve
      );
    });

    expect(response).toEqual({ ok: true, result: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it('rejects injection when the sender frame cannot be validated', async function () {
    let runtimeListener;
    const executeScript = vi.fn();
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListener = listener;
          }
        }
      },
      scripting: { executeScript: executeScript }
    };

    await import('../background.js?missing-frame');

    const response = await new Promise(function (resolve) {
      runtimeListener(
        {
          type: 'INJECT_NOSTR_COMPONENTS',
          channel: 'a'.repeat(64)
        },
        { tab: { id: 87 }, url: 'https://x.com/home' },
        resolve
      );
    });

    expect(response).toEqual({
      ok: false,
      error: 'Nostr component injection requires a validated sender frame'
    });
    expect(executeScript).not.toHaveBeenCalled();
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
    const existingLike = {
      id: 'f'.repeat(64),
      pubkey: 'a'.repeat(64),
      created_at: 20,
      kind: 17,
      content: '+',
      tags: [],
      sig: 'e'.repeat(128)
    };
    const pool = {
      subscribeMany: vi.fn(function (_relays, _filters, options) {
        queueMicrotask(function () {
          options.onevent(existingLike);
          options.oneose();
        });
        return { close: vi.fn(async function () {}) };
      }),
      publish: vi.fn(function () {
        return [Promise.resolve('saved')];
      }),
      destroy: vi.fn()
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
    const filter = {
      kinds: [17],
      '#k': ['web'],
      '#i': ['https://x.com/alokdangre/status/42'],
      limit: 1000
    };

    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: {
        source: 'nostr-components-relay-main',
        channel: channel,
        requestId: '0'.repeat(32),
        operation: 'getLikeState',
        payload: { relays: relays, url: filter['#i'][0] }
      }
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
      new Uint8Array(32).fill(7)
    );
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: {
        source: 'nostr-components-relay-main',
        channel: channel,
        requestId: '1'.repeat(32),
        operation: 'publish',
        payload: { relays: relays, event: signedEvent }
      }
    });
    await onMessage({
      source: pageWindow,
      origin: 'https://x.com',
      data: {
        source: 'nostr-components-relay-main',
        channel: channel,
        requestId: '2'.repeat(32),
        operation: 'getLikeState',
        payload: { relays: relays, url: filter['#i'][0] }
      }
    });

    const normalizedRelays = ['wss://relay.damus.io/'];
    expect(pool.subscribeMany).toHaveBeenCalledWith(
      normalizedRelays,
      [
        filter,
        {
          ...filter,
          authors: ['a'.repeat(64)],
          limit: 1
        }
      ],
      expect.objectContaining({ maxWait: 2500 })
    );
    expect(pool.publish).toHaveBeenCalledWith(normalizedRelays, signedEvent);
    expect(responses.map((entry) => entry.message.ok)).toEqual([true, true, true]);
    expect(responses[0].message.result).toEqual({
      totalCount: 1,
      likedCount: 1,
      dislikedCount: 0,
      isLiked: true
    });
    expect(JSON.stringify(responses[0].message)).not.toContain('a'.repeat(64));
    expect(responses[2].message.result).toMatchObject({
      totalCount: 2,
      isLiked: true
    });
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

    await listeners.get('message')({
      source: pageWindow,
      origin: 'https://www.youtube.com',
      data: {
        source: 'nostr-components-relay-main',
        channel: channel,
        requestId: '8'.repeat(32),
        operation: 'getCachedLikeState',
        payload: {
          relays: ['wss://relay.damus.io'],
          url: videoUrl
        }
      }
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
      querySelectorAll() {
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
    extension.componentLoader = { ready: Promise.resolve() };
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
        return selector === '#actions-inner #top-level-buttons-computed' ? actionBar : null;
      },
      querySelectorAll(selector) {
        if (selector.includes('ytd-video-owner-renderer')) {
          return [{
            getAttribute: (name) => name === 'href' ? 'nostr:' + recipientNpub : null,
            textContent: 'Nostr: ' + recipientNpub
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
      return hydrateActionSlot(slot, {
        get(tagName) {
          return registry.get(tagName);
        }
      });
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
