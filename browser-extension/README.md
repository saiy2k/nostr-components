<!-- SPDX-License-Identifier: MIT -->

# X Nostr Like browser extension

Load this directory as an unpacked Manifest V3 extension in Chromium. The Like
button is injected for every X/Twitter status, while author identity metadata is
looked up through the `lookupDirectoryHandle` Firebase HTTPS function.

Rebuild the small browser bundle that imports the repository's
`nostr-tools/utils` URL normalizer whenever `browser-extension/src/url.js`
changes:

```bash
npm run build:browser-extension
```

The function reads only `nostrDirectoryHandles/twitter:{normalized-handle}` from
Firestore and returns a sanitized active identity. It never exposes pending
claims, evidence arrays, rejection tombstones, or Firestore credentials. The
extension caches directory results in `chrome.storage.local` and uses the
bundled `verified-directory.json` only as an offline compatibility fallback.

Deploy the read-only lookup function to `gr-prod`:

```bash
npm --prefix functions install
npm --prefix functions test
firebase deploy --only functions:lookupDirectoryHandle --project gr-prod
```

After deployment, verify that this URL returns a sanitized result:

```text
https://us-central1-gr-prod.cloudfunctions.net/lookupDirectoryHandle?platform=twitter&handle=jack
```

The content script uses a single shared connection per configured relay. Post
lookups multiplex subscriptions over that pool instead of opening a new set of
WebSockets for every injected button.
