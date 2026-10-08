// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { emptyProfileDir, launchExtensionContext, routeDirectoryLookups } from './launch.js';

test('logged-out status page uses the aria-label Like row', async function () {
  test.skip(
    process.env.X_E2E_LOGGED_OUT !== '1',
    'Set X_E2E_LOGGED_OUT=1 to open a public status page in a fresh profile. No X login is scripted. This does not run in CI.'
  );
  const context = await launchExtensionContext({
    userDataDir: emptyProfileDir(),
    signer: false
  });
  const directoryRoute = await routeDirectoryLookups(context);
  const page = context.pages()[0] || await context.newPage();
  try {
    await page.goto('https://x.com/jack/status/20', { waitUntil: 'domcontentloaded' });
    const article = page.locator('article').filter({ has: page.locator('a[href*="/jack/status/20"]') }).first();
    await article.waitFor({ state: 'visible', timeout: 30_000 });
    const slot = article.locator('.nostr-competency-action-slot');
    await expect(slot).toHaveCount(1, { timeout: 20_000 });
    await expect(slot).toHaveAttribute('data-status-url', 'https://x.com/jack/status/20');
    await expect(slot).toHaveAttribute('data-author-handle', 'jack');
    await expect(slot).toHaveAttribute('data-directory-status', 'not-found');
    await expect(slot.locator('button.nostr-zap-invite')).toHaveAttribute('data-invite-mode', 'link');
    expect(directoryRoute.seen).toContain('jack');
    const like = article.locator('[data-testid="like"], button[aria-label="Like"]');
    await expect(like.first()).toBeVisible();
    const url = page.url();
    const signerPresent = await page.evaluate(function () {
      return Boolean(window.nostr && window.nostr.signEvent);
    });
    expect(signerPresent).toBe(false);
    await slot.click({ position: { x: 4, y: 4 } });
    expect(page.url()).toBe(url);
  } finally {
    await context.close();
  }
});
