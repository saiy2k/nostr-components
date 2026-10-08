// SPDX-License-Identifier: MIT

import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';

const here = path.dirname(fileURLToPath(import.meta.url));

export const extensionPath = path.resolve(here, '..');
export const profileDir = process.env.X_PROFILE_DIR
  ? path.resolve(process.env.X_PROFILE_DIR)
  : path.join(here, '.pw-x-profile');

export function headlessRequested() {
  return process.env.X_E2E_HEADLESS === '1';
}

export function liveProfileEnabled() {
  return process.env.X_E2E === '1';
}

export const skipLiveReason = [
  'Live x.com specs are opt-in.',
  'Log in once with `npm run e2e:x:setup`, then run `X_E2E=1 npm run e2e:x`.',
  'See browser-extension/TESTING.md. These specs do not run in CI.'
].join(' ');

export async function launchExtensionContext(options = {}) {
  const userDataDir = options.userDataDir || profileDir;
  const headless = options.headless ?? headlessRequested();
  if (headless) {
    throw new Error(
      'X_E2E_HEADLESS=1 uses Playwright\'s Chromium headless shell, which does not start MV3 extension service workers. Run headed.'
    );
  }
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  if (options.signer) {
    await installTestSigner(context);
  }
  return context;
}

export function emptyProfileDir() {
  return mkdtempSync(path.join(tmpdir(), 'nostr-x-e2e-'));
}

/**
 * NIP-07 stub. TEST_NSEC stays in this Node process. The page only receives a
 * pubkey and signed events through Playwright's exposeBinding bridge.
 */
export async function installTestSigner(context) {
  const secret = testSecretKey();
  const pubkey = getPublicKey(secret);
  await context.exposeBinding('__nostrTestBridge', async function (_source, request) {
    if (!request || request.op === 'pubkey') {
      return pubkey;
    }
    if (request.op === 'sign' && request.event && typeof request.event === 'object') {
      return finalizeEvent(request.event, secret);
    }
    throw new Error('Unsupported test signer request');
  });
  await context.addInitScript(function () {
    const bridge = window.__nostrTestBridge;
    window.nostr = {
      async getPublicKey() {
        return bridge({ op: 'pubkey' });
      },
      async signEvent(event) {
        return bridge({ op: 'sign', event: event });
      }
    };
  });
  return pubkey;
}

export function testSecretKey() {
  const encoded = process.env.TEST_NSEC || '';
  let decoded;
  try {
    decoded = nip19.decode(encoded);
  } catch (_error) {
    throw new Error('TEST_NSEC must be an nsec bech32 string');
  }
  if (decoded.type !== 'nsec') {
    throw new Error('TEST_NSEC must be an nsec bech32 string');
  }
  return decoded.data;
}

export async function extensionServiceWorker(context) {
  const existing = context.serviceWorkers();
  if (existing.length > 0) return existing[0];
  return context.waitForEvent('serviceworker', { timeout: 15_000 });
}

/**
 * Asks Playwright to fulfill directory lookups. Returns how many extension
 * requests the route actually observed. Playwright documents that
 * browserContext.route does not see fetches a service worker intercepts;
 * extension service-worker fetches are checked separately by
 * service-worker-route.e2e.js.
 */
export async function routeDirectoryLookups(context, options = {}) {
  const seen = [];
  const zapHandle = options.zapHandle || '';
  const handler = async function (route) {
    const url = new URL(route.request().url());
    const handle = url.searchParams.get('handle') || '';
    seen.push(handle);
    const zappable = Boolean(zapHandle) && handle === zapHandle;
    const status = zappable ? 200 : 404;
    const body = zappable
      ? {
          found: true,
          verified: true,
          platform: 'twitter',
          handle: handle,
          activeIdentity: {
            status: 'verified',
            pubkey: options.pubkey,
            npub: options.npub,
            zappable: true,
            lud16: 'fixture@example.com'
          }
        }
      : {
          found: false,
          verified: false,
          platform: 'twitter',
          handle: handle,
          activeIdentity: null
        };
    await route.fulfill({
      status: status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  };
  await context.route(/lookupAtlasHandle/, handler);
  return {
    seen: seen,
    async dispose() {
      await context.unroute(/lookupAtlasHandle/, handler);
    }
  };
}
