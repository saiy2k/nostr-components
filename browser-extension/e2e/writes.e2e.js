// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { SimplePool } from 'nostr-tools';
import { canonicalUrl } from '../../backend/nostr-pulse/url-canonical.js';
import {
  installTestSigner,
  launchExtensionContext,
  liveProfileEnabled,
  profileDir,
  skipLiveReason
} from './launch.js';

const RELAY = 'wss://relay.damus.io';

test.describe('@writes', function () {
  test('likes then unlikes the test account\'s own tweet', async function () {
    const tweetUrl = process.env.X_E2E_TWEET_URL || '';
    const testHandle = (process.env.X_E2E_TEST_HANDLE || '').replace(/^@/, '').toLowerCase();
    const enabled = liveProfileEnabled()
      && process.env.X_E2E_WRITES === '1'
      && tweetUrl
      && testHandle
      && process.env.TEST_NSEC;
    test.skip(
      !enabled,
      'Set X_E2E=1, X_E2E_WRITES=1, X_E2E_TWEET_URL (the test account\'s own tweet), ' +
      'X_E2E_TEST_HANDLE, and TEST_NSEC. This publishes a public kind 17. See browser-extension/TESTING.md.'
    );

    const canonical = canonicalUrl(tweetUrl);
    const handleInUrl = canonical ? canonical.split('/')[3] : '';
    expect(handleInUrl, 'X_E2E_TWEET_URL handle must be X_E2E_TEST_HANDLE').toBe(testHandle);

    const context = await launchExtensionContext({
      userDataDir: profileDir,
      signer: false
    });
    const pubkey = await installTestSigner(context);
    const page = context.pages()[0] || await context.newPage();
    const since = Math.floor(Date.now() / 1000) - 30;
    try {
      await page.goto(canonical, { waitUntil: 'domcontentloaded' });
      const slot = page.locator(
        '.nostr-competency-action-slot[data-status-url="' + canonical + '"]'
      );
      await expect(slot).toBeVisible({ timeout: 30_000 });
      await expect(slot).toHaveAttribute('data-author-handle', testHandle);

      const like = slot.locator('button[aria-label="Like this post with Nostr"]');
      await like.click();
      const liked = await waitForReaction(pubkey, canonical, '+', since);
      expect(liked.tags).toEqual(expect.arrayContaining([
        ['k', 'web'],
        ['i', canonical]
      ]));

      const unlike = slot.locator('button[aria-label="Unlike this post with Nostr"]');
      await expect(unlike).toBeVisible({ timeout: 30_000 });
      await unlike.click();
      const unliked = await waitForReaction(pubkey, canonical, '-', since);
      expect(unliked.pubkey).toBe(pubkey);
      expect(unliked.tags).toEqual(expect.arrayContaining([['i', canonical]]));
    } finally {
      await context.close();
    }
  });
});

async function waitForReaction(pubkey, url, content, since) {
  const pool = new SimplePool();
  const deadline = Date.now() + 60_000;
  try {
    while (Date.now() < deadline) {
      const events = await pool.querySync([RELAY], {
        kinds: [17],
        authors: [pubkey],
        '#i': [url],
        since: since
      });
      const match = events.find(function (event) {
        return event.content === content && event.tags.some(function (tag) {
          return tag[0] === 'i' && tag[1] === url;
        });
      });
      if (match) return match;
      await new Promise(function (resolve) {
        setTimeout(resolve, 2_000);
      });
    }
  } finally {
    pool.close([RELAY]);
  }
  throw new Error('Timed out waiting for kind 17 content ' + content + ' on ' + RELAY);
}
