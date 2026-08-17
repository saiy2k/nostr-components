<!-- SPDX-License-Identifier: MIT -->

# Nostr Like & Zap

Adds Nostr Like and Zap actions next to posts on X and videos on YouTube. Likes
publish Nostr kind-17 reactions using your existing signer (Alby, nos2x, or any
other NIP-07 extension).

## Load the extension

1. Install a Nostr signer extension and unlock it.
2. In Chromium, open `chrome://extensions`, enable Developer mode, and load this
   directory as an unpacked extension.
3. Open a post on [x.com](https://x.com) or a video on
   [youtube.com](https://www.youtube.com). Nostr actions appear beside the
   site's own Like control.

Author identities are looked up in the background and cached on the device. If
lookup is temporarily unavailable, the last cached result may still be used.
Likes still work when identity metadata is missing. X Zaps appear only for a
verified, zappable directory identity. YouTube Zaps appear only when the page's
creator metadata or description explicitly contains a checksum-valid `npub`.

## Develop

This folder ships the same `<nostr-like-button>` and `<nostr-zap-button>` used
on the web. They run in the page so they can reach `window.nostr`. Host content
security policies can block relay WebSockets, so scoped queries and Like
publishes go through a narrow extension bridge instead.

Signer public keys stay in memory for the current tab. They are not written to
`sessionStorage`, which X's page can read. Scrolling therefore does not re-prompt
the signer on every post.

Rebuild the URL helper, relay client, and shared component bundle after source
changes:

```bash
npm run build:browser-extension
```
