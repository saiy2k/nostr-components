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
verified, zappable directory identity. When that identity is missing, not
zappable, or the lookup fails, X shows an invite that opens an editable reply
asking the author to link Nostr or add a Lightning address. YouTube Zaps appear
only when the creator-owned channel identity area explicitly contains a
checksum-valid lowercase `npub`; video titles, metadata, and descriptions are never treated as
payment-recipient declarations. Channel URLs are not mapped to recipients, so a
stale third-party mapping cannot redirect a Zap.

## Develop

This folder ships the same `<nostr-like-button>` and `<nostr-zap-button>` used
on the web. They run in the page so they can reach `window.nostr`. Host content
security policies can block relay WebSockets and Lightning HTTPS, so likes,
receipt watches, and LNURL/invoice GETs go through a narrow extension bridge.

## What leaves your browser

X handles, Nostr pubkeys of the authors and Zap recipients shown on the page,
URL keys (the hash of a canonical page URL, not the URL itself), the stored
signer pubkey, your own signed likes, and zap receipts seen on the sweep relays
go to the Nostr Components directory API. Signed likes also go to the
rendezvous relays and to up to three write relays from your own kind 10002
relay list. Receipt watches connect to the rendezvous relays and up to three
read relays from the recipient's kind 10002 list. Zap requests go to the
recipient's Lightning (LNURL) provider. Chrome Web Store privacy answers must
match this section.

Counts are what those relays and the API have seen, not every like or zap on
Nostr. A zap made in another client is counted only when one of the sweep
relays holds the receipt. The extension's own unlike replaces that user's
like. A deleted reaction from another client keeps counting. The liked state
uses your newest 500 URL reactions, so an older like can look unliked. A like
reaches your write relays only when your kind 10002 is available and those
relays accept it.

Signer public keys stay in memory for the current tab. They are not written to
`sessionStorage`, which X's page can read. Scrolling therefore does not re-prompt
the signer on every post.

Rebuild the URL helper, relay client, and shared component bundle after source
changes:

```bash
npm run build:browser-extension
```
