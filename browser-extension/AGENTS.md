# Browser extension

Unpacked Chromium extension. It injects the same Like and Zap components as the library onto X and YouTube.

- Edit `browser-extension/src/`. Rebuild with `npm run build:browser-extension`, then `npm run test:browser-extension`. Leave `browser-extension/lib/` to that build.
- Host page CSP blocks relay WebSockets and Lightning HTTPS. Scoped queries, Like publishes, and LNURL/invoice GETs go through the extension bridge.
- Signer public keys stay in memory for the current tab. Do not write them to `sessionStorage`.
- X Zaps require a verified, zappable directory identity. YouTube Zaps require a checksum-valid lowercase `npub` in the creator-owned channel identity area. Ignore titles, descriptions, metadata, and channel-URL mappings as payment recipients.
- Load this folder unpacked via `chrome://extensions`. Behavior notes: [README.md](README.md).
