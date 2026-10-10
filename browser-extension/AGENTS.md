# Browser extension

Unpacked Chromium extension. It injects the same Like and Zap components as the library onto X and YouTube.

- Edit `browser-extension/src/` for the relay client, URL helper, and component bundle. Rebuild with `npm run build:browser-extension`, then `npm run test:browser-extension`. That build writes only `lib/url.js`, `lib/relay-client.js`, and `lib/nostr-extension-components.js`. The other `lib/` files, including `directory.js`, `storage.js`, and `dom.js`, are hand-edited source.
- Injected Like and Zap buttons on X and YouTube may read counts, zap totals, and profiles from the directory API. The same components on a generic website talk only to relays. Relay sockets publish likes to the rendezvous relays and up to three of the signer's write relays, and watch the zap request's relays for a receipt. Host page CSP blocks those sockets and Lightning HTTPS, so they go through the extension bridge.
- Signer public keys stay in memory for the current tab. Do not write them to `sessionStorage`.
- X Zaps require a verified, zappable directory identity. YouTube Zaps require a checksum-valid lowercase `npub` in the creator-owned channel identity area. Ignore titles, descriptions, metadata, and channel-URL mappings as payment recipients.
- Load this folder unpacked via `chrome://extensions`. Behavior notes: [README.md](README.md).
