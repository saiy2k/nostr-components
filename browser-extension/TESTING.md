# Testing Nostr Like & Zap on x.com

Three layers. CI runs the first two. The live browser specs stay on your machine.

## Safety

- Use a test X account and a test Nostr key. Not your main accounts.
- Do not commit the Chromium profile (`browser-extension/e2e/.pw-x-profile/`) or any nsec.
- `TEST_NSEC` is an environment variable. The Playwright signer reads it in the Node process and does not put it in the page.
- Do not zap. Do not press Post on an invite reply. Do not like or reply to someone else's post.
- The only intended public write is the opt-in Like then Unlike on a tweet the test account itself posted. That publishes kind 17 events to public relays and to the production directory API.
- Do not script an X login. Log in by hand, once, in the persistent profile.

## Unit and fixture tests

From the repo root, with Node 22:

```bash
npm ci --legacy-peer-deps
npm run test:browser-extension
npx vitest run
```

`npm run test:browser-extension` rebuilds `browser-extension/lib/url.js`, `lib/relay-client.js`, and `lib/nostr-extension-components.js`, then runs every test under `browser-extension/tests`. The other files in `lib/` are hand-written source.

`browser-extension/tests/extension.test.js` drives hand-built DOM objects. `browser-extension/tests/x-dom.fixtures.test.js` loads HTML from `browser-extension/tests/fixtures/x/` in happy-dom and checks post identity, the Like row, slot placement immediately after Like, click containment, theme, and zap versus invite. Directory answers are mocked on `chrome.runtime.sendMessage`. Which files are captured and which are synthetic is in [tests/fixtures/x/README.md](tests/fixtures/x/README.md).

GitHub Actions (`.github/workflows/test.yml`) installs with `npm ci --legacy-peer-deps`, builds the extension, fails if `browser-extension/lib` differs from the commit, and runs `npx vitest run`. It does not run Playwright.

## One-time profile

Branded Chrome 137 and newer ignores `--load-extension`. The harness uses Playwright's Chromium.

```bash
npx playwright install chromium
npm run e2e:x:setup
```

A headed window opens at `https://x.com/login` with this folder loaded unpacked. Log into the **test** account and finish 2FA yourself. Close the window. The session stays in `browser-extension/e2e/.pw-x-profile/` (or `X_PROFILE_DIR` if you set it).

Leave a NIP-07 extension out of that profile if you want the read-only click check. A signer there can publish when the smoke spec clicks a slot, so the spec skips that click when `window.nostr.signEvent` is already present.

## Read-only live specs

```bash
X_E2E=1 npm run e2e:x
```

The window is headed. Playwright's headless mode uses the Chromium headless shell, which does not start this extension's service worker, so `X_E2E_HEADLESS=1` is rejected. Without `X_E2E=1` the live specs skip. They do not run in CI.

`smoke.e2e.js` opens the home timeline and checks:

- one `.nostr-competency-action-slot` on each visible tweet that has a Like control
- the slot's status id is a `/status/` link in that article
- no duplicate slots after a short scroll down and back
- a click in the slot does not change the URL (skipped when a signer is already installed)
- `data-theme` follows the `dark` attribute and `color-scheme` the extension already watches
- opening a post and going back still leaves one slot per tweet

Optional logged-out pass, fresh temporary profile, no login:

```bash
X_E2E_LOGGED_OUT=1 npx playwright test --config browser-extension/e2e/playwright.config.js logged-out.e2e.js
```

A headed run of that spec against `https://x.com/jack/status/20` passed once in development: one slot, canonical URL `https://x.com/jack/status/20`, the click stayed on the page, and `context.route` answered `lookupAtlasHandle` for `jack` so the slot showed the link invite. It stays opt-in and out of CI because it depends on live x.com.

## Directory requests from the service worker

`lookupAtlasHandle` is fetched by the extension service worker (`background.js`), not by the page.

Checked with headed Playwright Chromium (Chrome for Testing 156): `browserContext.route` does see that `fetch()`. The route handler ran, `request.serviceWorker()` was set, and the worker received the fulfilled JSON. `page.route` saw nothing. Playwright's note about service-worker interception ([playwright#1090](https://github.com/microsoft/playwright/issues/1090)) still applies to fetches a page service worker claims; it did not block this extension worker's own `fetch()` in headed Chromium.

Re-check after a Playwright upgrade:

```bash
npm run e2e:x:probe-routes
```

The smoke spec installs the same `context.route`. If that route observes no lookups, the zap-versus-invite assertion skips. Those modes are already fixed by the fixture test, which mocks `chrome.runtime.sendMessage`.

Logged-out Japanese (`いいね`, `返信`) is not matched by the English aria-label fallback, and the captured page has no `data-testid="like"`. The fixture test records that. A logged-in capture with `data-testid="like"` is still needed; the synthetic file only reconstructs that path.

`X_E2E_ZAP_HANDLE` is optional. When the route does see lookups, that handle is answered as verified and zappable and every other handle is answered as not found (invite mode `link`).

## Opt-in Like / Unlike

Tagged `@writes`. Skipped unless every one of these is set:

| Variable | Meaning |
| --- | --- |
| `X_E2E` | `1` |
| `X_E2E_WRITES` | `1` |
| `X_E2E_TWEET_URL` | A status URL posted by the test account |
| `X_E2E_TEST_HANDLE` | That account's handle, without `@` |
| `TEST_NSEC` | Test key only. Never a real key, never committed |

```bash
X_E2E=1 X_E2E_WRITES=1 \
  X_E2E_TWEET_URL='https://x.com/<handle>/status/<id>' \
  X_E2E_TEST_HANDLE='<handle>' \
  TEST_NSEC='nsec1...' \
  npm run e2e:x:writes
```

The spec refuses to click unless the URL's handle is `X_E2E_TEST_HANDLE` and the slot's `data-author-handle` matches. It clicks Like, waits until `wss://relay.damus.io` has a kind 17 with content `+` and an `i` tag of the canonical URL, then clicks Unlike and waits for content `-`. The private key never enters the page: `getPublicKey` and `signEvent` call `exposeBinding`, and `finalizeEvent` runs in Node.

## Testability hook

`getPageTheme` moved from `content.js` to `lib/dom.js` and is exported as `extension.dom.getPageTheme`. `content.js` calls that function. The checks (dark attribute or class, `color-scheme`, YouTube background luminance) are the same. Fixture tests need to call it without starting the content-script observers.
