# x.com DOM fixtures

These HTML files are the markup `x-dom.fixtures.test.js` loads. Two kinds live here.

## Captured (logged-out SSR, 2026-10-08)

Fetched with a browser `User-Agent` from public pages. x.com rendered the tweet
in the first HTML response and did not include `data-testid` or
`div[role="group"]`. The Like control is a `<button aria-label="Like">` (or the
Japanese `いいね`) inside `div[data-engagement-action="like"]`. Scripts, nonces,
and image URLs (`pbs.twimg.com`, `video.twimg.com`) were removed. Public status
URLs and handles are kept because the tests assert them. No cookies, no account
session, and no private messages are in these files.

| File | Page | What it is |
| --- | --- | --- |
| `timeline-tweet.html` | `https://x.com/jack` | Pinned timeline article |
| `status-main.html` | `https://x.com/jack/status/20` | Focal status article |
| `status-reply.html` | `https://x.com/jack/status/20` | A reply under that post |
| `quote-tweet.html` | `https://x.com/jack` | Quote tweet, quoted article nested inside |
| `media-link.html` | `https://x.com/jack` | Tweet with an `/photo/1` link |
| `i-status.html` | `https://x.com/i/status/20` | Same post opened via `/i/status`; links are `/jack/status/20` |
| `ja-locale.html` | `https://x.com/jack/status/20` (`Accept-Language: ja`) | Like label is `いいね` |
| `dark-theme.html` | same article as `status-main.html` | Article is captured. `class="dark"` and `color-scheme: dark` on `<html>` were added because logged-out SSR did not set them. Those are the signals `getPageTheme` reads. |

Logged-out pages for `@jack` and `@github` had no "reposted" banner, and the
response had no logged-in `data-testid` tree. Those two cases are synthetic.

## Synthetic

| File | Why |
| --- | --- |
| `synthetic/repost.html` | Captured `/jack/status/20` article plus an in-article "Alice reposted" row in the same place as the captured "Pinned" row. The banner was not served by x.com. |
| `synthetic/logged-in-testid.html` | Reconstructed `data-testid="tweet"` / `data-testid="like"` / `div[role="group"]` action bar, with Japanese labels and both `/i/status` and `/jack/status` links. Not served by x.com. |

## Replace a fixture with a real capture

Do this from the test account's browser, including a logged-in session, a
repost, and a dark theme, when you have one. Do not commit the browser profile.

1. Open the tweet. Set the language and theme you want to record.
2. In DevTools, select the outer `article` (for a quote, the article that
   contains the quoted article). For a whole column, you can save the page
   instead.
3. Copy **outerHTML** and save it, for example as `/tmp/incoming.html`.
4. Run:

   ```bash
   node browser-extension/tests/fixtures/x/sanitize.mjs /tmp/incoming.html \
     browser-extension/tests/fixtures/x/my-case.html
   ```

   The script keeps the largest `<article>`, strips scripts, nonces, and image
   URLs, and wraps a document. Edit the HTML comment so it states the page URL,
   the date, logged-in or logged-out, the theme, and the locale.
5. Add the file to the case table in `browser-extension/tests/x-dom.fixtures.test.js`.
6. Run `npx vitest run browser-extension/tests/x-dom.fixtures.test.js`.

If the new markup stops matching, keep the captured file and update the test
only when the extension's selectors are supposed to follow x.com.
