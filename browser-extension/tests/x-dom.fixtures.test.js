// SPDX-License-Identifier: MIT

/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://x.com/"}
 */

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';

await import('../lib/url.js');
await import('../lib/storage.js');
await import('../lib/directory.js');
await import('../lib/zap-invite.js');
await import('../lib/dom.js');

const extension = globalThis.NostrLikeExtension;
const recipientPubkey = '1'.repeat(64);
const recipientNpub = nip19.npubEncode(recipientPubkey);

const placementCases = [
  {
    name: 'timeline tweet',
    file: './fixtures/x/timeline-tweet.html',
    pageUrl: 'https://x.com/jack',
    username: 'jack',
    statusId: '1833951636005552366',
    canonicalUrl: 'https://x.com/jack/status/1833951636005552366',
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'status page main post',
    file: './fixtures/x/status-main.html',
    pageUrl: 'https://x.com/jack/status/20',
    username: 'jack',
    statusId: '20',
    canonicalUrl: 'https://x.com/jack/status/20',
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'status page reply',
    file: './fixtures/x/status-reply.html',
    pageUrl: 'https://x.com/jack/status/20',
    username: 'lexfridman',
    statusId: '1770825760162353449',
    canonicalUrl: 'https://x.com/lexfridman/status/1770825760162353449',
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'quote tweet',
    file: './fixtures/x/quote-tweet.html',
    pageUrl: 'https://x.com/jack/status/2105350995869835641',
    username: 'jack',
    statusId: '2105350995869835641',
    canonicalUrl: 'https://x.com/jack/status/2105350995869835641',
    rejectedStatusIds: ['2105334006451482804'],
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'media link',
    file: './fixtures/x/media-link.html',
    pageUrl: 'https://x.com/jack',
    username: 'jack',
    statusId: '2106359514391871540',
    canonicalUrl: 'https://x.com/jack/status/2106359514391871540',
    requiresPhotoLink: true,
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: '/i/status',
    file: './fixtures/x/i-status.html',
    pageUrl: 'https://x.com/i/status/20',
    username: 'jack',
    statusId: '20',
    canonicalUrl: 'https://x.com/jack/status/20',
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'Japanese logged-out labels',
    file: './fixtures/x/ja-locale.html',
    pageUrl: 'https://x.com/jack/status/20',
    username: 'jack',
    statusId: '20',
    canonicalUrl: 'https://x.com/jack/status/20',
    actionBar: false,
    japaneseLikeLabel: true
  },
  {
    name: 'dark theme',
    file: './fixtures/x/dark-theme.html',
    pageUrl: 'https://x.com/jack/status/20',
    username: 'jack',
    statusId: '20',
    canonicalUrl: 'https://x.com/jack/status/20',
    actionBar: true,
    theme: 'dark',
    loggedOutAria: true
  },
  {
    name: 'synthetic repost banner',
    file: './fixtures/x/synthetic/repost.html',
    pageUrl: 'https://x.com/alice',
    username: 'jack',
    statusId: '20',
    canonicalUrl: 'https://x.com/jack/status/20',
    actionBar: true,
    loggedOutAria: true
  },
  {
    name: 'synthetic logged-in testids',
    file: './fixtures/x/synthetic/logged-in-testid.html',
    pageUrl: 'https://x.com/i/status/1833951636005552366',
    username: 'jack',
    statusId: '1833951636005552366',
    canonicalUrl: 'https://x.com/jack/status/1833951636005552366',
    rejectedStatusIds: ['2105334006451482804'],
    actionBar: true,
    theme: 'light',
    testIdLike: true
  }
];

afterEach(function () {
  delete globalThis.chrome;
});

describe('x.com DOM fixtures', function () {
  it.each(placementCases)('$name', function (entry) {
    loadDocument(entry.file, entry.pageUrl);
    const article = document.querySelector('article');
    expect(article).not.toBeNull();

    const info = extension.dom.getTweetInfo(article);
    expect(info).toMatchObject({
      username: entry.username,
      statusId: entry.statusId,
      canonicalUrl: entry.canonicalUrl
    });
    for (const rejected of entry.rejectedStatusIds || []) {
      expect(info.statusId).not.toBe(rejected);
      expect(info.canonicalUrl).not.toContain('/' + rejected);
    }
    if (entry.requiresPhotoLink) {
      expect(article.querySelector('a[href*="/photo/"]')).not.toBeNull();
      expect(info.canonicalUrl).not.toContain('/photo/');
    }
    if (entry.pageUrl.includes('/i/status/')) {
      expect(info.canonicalUrl).not.toContain('/i/status/');
    }

    const theme = extension.dom.getPageTheme();
    expect(theme).toBe(entry.theme || 'light');

    const actionBar = extension.dom.findActionBar(article);
    if (!entry.actionBar) {
      expect(actionBar).toBeNull();
      if (entry.japaneseLikeLabel) {
        expect(article.querySelector('[data-testid="like"]')).toBeNull();
        expect(article.querySelector('button[aria-label="いいね"]')).not.toBeNull();
      }
      return;
    }

    expect(actionBar).not.toBeNull();
    if (entry.loggedOutAria) {
      expect(article.querySelector('[data-testid="like"], [data-testid="unlike"]')).toBeNull();
      expect(article.querySelector('button[aria-label="Like"]')).not.toBeNull();
    }
    if (entry.testIdLike) {
      expect(article.querySelector('[data-testid="like"]')?.getAttribute('aria-label')).toBe('いいね');
      expect(actionBar.getAttribute('role')).toBe('group');
    }

    const action = extension.dom.createNostrAction(info, theme);
    extension.dom.insertAfterNativeLike(actionBar, action.slot);
    const likeContainer = directChildContainingLike(actionBar);
    expect(likeContainer).not.toBeNull();
    expect(action.slot.previousElementSibling).toBe(likeContainer);
    expect(action.slot.getAttribute('data-status-url')).toBe(entry.canonicalUrl);
    expect(action.slot.getAttribute('data-author-handle')).toBe(entry.username);
    expect(action.slot.getAttribute('data-status-id')).toBe(entry.statusId);
    expect(action.slot.getAttribute('data-theme')).toBe(theme);
    expect(actionBar.querySelectorAll('.nostr-competency-action-slot')).toHaveLength(1);

    let reachedAncestor = false;
    actionBar.addEventListener('click', function () {
      reachedAncestor = true;
    });
    action.slot.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(reachedAncestor).toBe(false);
  });

  it('uses mocked runtime messaging to choose zap or invite', async function () {
    const messages = [];
    globalThis.chrome = {
      runtime: {
        sendMessage(message, callback) {
          messages.push(message);
          const answer = directoryAnswers[message.handle];
          if (!answer || answer.ok === false) {
            callback({ ok: false, error: 'directory unavailable' });
            return;
          }
          callback({ ok: true, result: answer.result });
        }
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback({});
          },
          set(_values, callback) {
            callback();
          }
        }
      }
    };

    const verified = {
      found: true,
      verified: true,
      platform: 'twitter',
      activeIdentity: {
        status: 'verified',
        pubkey: recipientPubkey,
        npub: recipientNpub,
        zappable: true,
        lud16: 'fixture@example.com'
      }
    };
    const directoryAnswers = {
      jack: { ok: true, result: verified },
      lexfridman: {
        ok: true,
        result: {
          found: true,
          verified: true,
          platform: 'twitter',
          handle: 'lexfridman',
          activeIdentity: {
            status: 'verified',
            pubkey: recipientPubkey,
            npub: recipientNpub,
            zappable: false,
            lud16: null
          }
        }
      },
      notlinked1: {
        ok: true,
        result: {
          found: false,
          verified: false,
          platform: 'twitter',
          handle: 'notlinked1',
          activeIdentity: null
        }
      },
      offlineuser: { ok: false },
      badnpubusr: {
        ok: true,
        result: {
          found: true,
          verified: true,
          platform: 'twitter',
          activeIdentity: {
            status: 'verified',
            pubkey: recipientPubkey,
            npub: 'npub1invalid',
            zappable: true
          }
        }
      }
    };

    loadDocument('./fixtures/x/status-main.html', 'https://x.com/jack/status/20');
    const article = document.querySelector('article');
    const info = extension.dom.getTweetInfo(article);
    const actionBar = extension.dom.findActionBar(article);
    const placed = extension.dom.createNostrAction(info, 'light');
    extension.dom.insertAfterNativeLike(actionBar, placed.slot);
    extension.dom.hydrateNostrAction(placed.slot);
    extension.dom.applyDirectoryIdentity(
      placed.slot,
      await extension.directory.lookup('jack')
    );
    expect(messages[0]).toEqual({
      type: 'LOOKUP_DIRECTORY_HANDLE',
      platform: 'twitter',
      handle: 'jack'
    });
    expect(placed.slot.querySelector('nostr-zap-button')?.getAttribute('npub')).toBe(recipientNpub);
    expect(placed.slot.querySelector('button.nostr-zap-invite')).toBeNull();
    expect(placed.slot.previousElementSibling?.getAttribute('data-engagement-action')).toBe('like');

    const modes = [
      ['lexfridman', '22', 'lightning'],
      ['notlinked1', '23', 'link'],
      ['offlineuser', '24', 'link']
    ];
    for (const [handle, statusId, mode] of modes) {
      const slot = hydratedSlot(handle, statusId);
      extension.dom.applyDirectoryIdentity(slot, await extension.directory.lookup(handle));
      expect(slot.querySelector('nostr-zap-button')).toBeNull();
      expect(slot.querySelector('button.nostr-zap-invite')?.getAttribute('data-invite-mode')).toBe(mode);
    }

    const hidden = hydratedSlot('badnpubusr', '25');
    extension.dom.applyDirectoryIdentity(hidden, await extension.directory.lookup('badnpubusr'));
    expect(hidden.querySelector('nostr-zap-button')).toBeNull();
    expect(hidden.querySelector('button.nostr-zap-invite')).toBeNull();
    expect(messages.map((message) => message.handle)).toEqual([
      'jack',
      'lexfridman',
      'notlinked1',
      'offlineuser',
      'badnpubusr'
    ]);
  });
});

function loadDocument(file, pageUrl) {
  const html = readFileSync(new URL(file, import.meta.url), 'utf8');
  document.open();
  document.write(html);
  document.close();
  window.happyDOM.setURL(pageUrl);
}

function directChildContainingLike(actionBar) {
  const control = actionBar.querySelector('[data-testid="like"], [data-testid="unlike"]')
    || Array.from(actionBar.querySelectorAll('button')).find(function (button) {
      const label = String(button.getAttribute('aria-label') || '').trim().toLowerCase();
      return label === 'like' || label.startsWith('like ') || label.startsWith('liked') || label.startsWith('unlike');
    });
  let node = control;
  while (node && node.parentElement !== actionBar) {
    node = node.parentElement;
  }
  return node && node.parentElement === actionBar ? node : null;
}

function hydratedSlot(handle, statusId) {
  const action = extension.dom.createNostrAction(
    {
      username: handle,
      statusId: statusId,
      canonicalUrl: 'https://x.com/' + handle + '/status/' + statusId
    },
    'light'
  );
  extension.dom.hydrateNostrAction(action.slot);
  return action.slot;
}
