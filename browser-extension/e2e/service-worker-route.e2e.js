// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import {
  emptyProfileDir,
  extensionServiceWorker,
  launchExtensionContext
} from './launch.js';

const LOOKUP = 'https://us-central1-nostr-components.cloudfunctions.net/lookupAtlasHandle?platform=twitter&handle=jack';
const MARKER = 'playwright-extension-sw-route';

test('context.route sees a fetch from the extension service worker', async function () {
  test.skip(
    process.env.X_E2E_PROBE_ROUTES !== '1',
    'Set X_E2E_PROBE_ROUTES=1 (npm run e2e:x:probe-routes) to check service-worker interception. No X login. Not part of CI.'
  );

  const context = await launchExtensionContext({
    userDataDir: emptyProfileDir(),
    signer: false
  });
  const pageHits = [];
  const contextHits = [];
  try {
    const worker = await extensionServiceWorker(context);
    const page = context.pages()[0] || await context.newPage();
    await page.route(/lookupAtlasHandle/, async function (route) {
      pageHits.push(route.request().url());
      await route.fallback();
    });
    await context.route(/lookupAtlasHandle/, async function (route) {
      contextHits.push(route.request().serviceWorker() ? 'service-worker' : 'other');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ probe: MARKER, found: false })
      });
    });

    const body = await worker.evaluate(async function (url) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      return { status: response.status, text: await response.text() };
    }, LOOKUP);

    const intercepted = body.text.includes(MARKER);
    console.log(JSON.stringify({
      intercepted: intercepted,
      status: body.status,
      contextHits: contextHits,
      pageHits: pageHits.length,
      bodyStart: body.text.slice(0, 180)
    }));
    expect(intercepted).toBe(true);
  } finally {
    await context.close();
  }
});
