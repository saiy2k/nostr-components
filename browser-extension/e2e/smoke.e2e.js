// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { nip19 } from 'nostr-tools';
import {
  extensionServiceWorker,
  launchExtensionContext,
  liveProfileEnabled,
  profileDir,
  routeDirectoryLookups,
  skipLiveReason
} from './launch.js';

const zapPubkey = '2'.repeat(64);

test.describe.configure({ mode: 'serial' });

let context;
let page;
let directoryRoute;

test.beforeAll(async function () {
  test.skip(!liveProfileEnabled(), skipLiveReason);
  context = await launchExtensionContext({
    userDataDir: profileDir,
    signer: false
  });
  page = context.pages()[0] || await context.newPage();
  directoryRoute = await routeDirectoryLookups(context, {
    zapHandle: process.env.X_E2E_ZAP_HANDLE || '',
    pubkey: zapPubkey,
    npub: nip19.npubEncode(zapPubkey)
  });
  try {
    const worker = await extensionServiceWorker(context);
    await worker.evaluate(function () {
      return chrome.storage.local.clear();
    });
  } catch (error) {
    console.warn('Could not clear extension storage before the smoke run.', error);
  }
});

test.afterAll(async function () {
  await directoryRoute?.dispose?.();
  await context?.close();
});

test('home timeline has one slot per visible tweet', async function () {
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  await page.locator('article').first().waitFor({ state: 'visible' });
  await expect.poll(async function () {
    return page.locator('.nostr-competency-action-slot').count();
  }, { timeout: 20_000 }).toBeGreaterThan(0);

  const placement = await slotPlacement(page);
  expect(placement.articlesWithLike).toBeGreaterThan(0);
  expect(placement.missing).toBe(0);
  expect(placement.duplicates).toBe(0);

  const before = page.url();
  const slot = page.locator('.nostr-competency-action-slot').first();
  const signerPresent = await page.evaluate(function () {
    return Boolean(window.nostr && window.nostr.signEvent);
  });
  test.skip(
    signerPresent,
    'A NIP-07 signer is installed in this profile. The read-only click check is skipped so it cannot publish.'
  );
  await slot.click({ position: { x: 4, y: 4 }, timeout: 5_000 }).catch(function () {
    return slot.click({ force: true });
  });
  expect(page.url()).toBe(before);
});

test('scrolling away and back does not duplicate slots', async function () {
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(800);
  await page.evaluate(function () {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const placement = await slotPlacement(page);
  expect(placement.duplicates).toBe(0);
  expect(placement.missing).toBe(0);
});

test('theme markers update the slot', async function () {
  const slot = page.locator('.nostr-competency-action-slot').first();
  await page.evaluate(function () {
    document.documentElement.setAttribute('dark', '');
    document.documentElement.style.colorScheme = 'dark';
  });
  await expect(slot).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(function () {
    document.documentElement.removeAttribute('dark');
    document.documentElement.classList.remove('dark');
    document.body?.removeAttribute('dark');
    document.body?.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  });
  await expect(slot).toHaveAttribute('data-theme', 'light');
});

test('SPA navigation keeps a single slot on the opened post', async function () {
  const statusLink = page.locator('article a[href*="/status/"]').first();
  await statusLink.click();
  await page.waitForURL(/\/status\/\d+/);
  await expect.poll(async function () {
    return slotPlacement(page);
  }).toMatchObject({ duplicates: 0, missing: 0 });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.locator('article').first().waitFor({ state: 'visible' });
  const placement = await slotPlacement(page);
  expect(placement.duplicates).toBe(0);
  expect(placement.missing).toBe(0);
});

test('directory route decides zap versus invite when Playwright sees the service worker', async function () {
  test.skip(
    directoryRoute.seen.length === 0,
    'Playwright did not observe lookupAtlasHandle from the extension service worker. ' +
    'Zap versus invite is covered by browser-extension/tests/x-dom.fixtures.test.js. ' +
    'See browser-extension/TESTING.md.'
  );
  await expect.poll(async function () {
    return page.locator('.nostr-competency-action-slot[data-directory-status="loading"]').count();
  }).toBe(0);
  const modes = await page.locator('.nostr-competency-action-slot').evaluateAll(function (slots) {
    return slots.map(function (slot) {
      return {
        handle: slot.getAttribute('data-author-handle'),
        zap: Boolean(slot.querySelector('nostr-zap-button')),
        invite: slot.querySelector('button.nostr-zap-invite')?.getAttribute('data-invite-mode') || null
      };
    });
  });
  const zapHandle = process.env.X_E2E_ZAP_HANDLE || '';
  for (const slot of modes) {
    if (zapHandle && slot.handle === zapHandle) {
      expect(slot.zap).toBe(true);
      expect(slot.invite).toBeNull();
    } else {
      expect(slot.zap).toBe(false);
      expect(slot.invite).toBe('link');
    }
  }
});

async function slotPlacement(target) {
  return target.evaluate(function () {
    const articles = Array.from(document.querySelectorAll('article'));
    let articlesWithLike = 0;
    let missing = 0;
    let duplicates = 0;
    for (const article of articles) {
      const like = article.querySelector(
        '[data-testid="like"], [data-testid="unlike"], button[aria-label="Like"], button[aria-label^="Liked"], button[aria-label^="Unlike"]'
      );
      const slots = article.querySelectorAll('.nostr-competency-action-slot');
      if (slots.length > 1) duplicates += 1;
      if (!like) continue;
      articlesWithLike += 1;
      if (slots.length !== 1) missing += 1;
      const statusUrl = slots[0]?.getAttribute('data-status-url') || '';
      const statusId = statusUrl.split('/status/')[1] || '';
      const hrefs = Array.from(article.querySelectorAll('a[href*="/status/"]')).map(function (anchor) {
        return anchor.getAttribute('href') || '';
      });
      if (statusId && !hrefs.some(function (href) { return href.includes('/status/' + statusId); })) {
        missing += 1;
      }
    }
    return { articlesWithLike: articlesWithLike, missing: missing, duplicates: duplicates };
  });
}
