<!-- SPDX-License-Identifier: MIT -->

# Nostr Like for X

Adds Nostr Like buttons next to posts on X. Clicking one publishes a Nostr
kind-17 reaction using your existing signer (Alby, nos2x, or any other NIP-07
extension).

## Load the extension

1. Install a Nostr signer extension and unlock it.
2. In Chromium, open `chrome://extensions`, enable Developer mode, and load this
   directory as an unpacked extension.
3. Open a post on [x.com](https://x.com). A Nostr Like control appears in the
   action row, after X's own Like button.

Author identities are looked up in the background and cached on the device. If
lookup is temporarily unavailable, the last cached result may still be used.
Likes still work when identity metadata is missing.

## Develop

This folder ships the same `<nostr-like-button>` used on the web. On X it runs
in the page so it can reach `window.nostr`. X blocks relay WebSockets from the
page, so query and publish go through a narrow extension bridge instead.

Signer public keys stay in memory for the current tab. They are not written to
`sessionStorage`, which X's page can read. Scrolling therefore does not re-prompt
the signer on every post.

Rebuild the URL helper, relay client, and component bundles after source
changes:

```bash
npm run build:browser-extension
```
