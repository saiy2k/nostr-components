<!-- SPDX-License-Identifier: MIT -->

# X Nostr Like browser extension

Load this directory as an unpacked Manifest V3 extension in Chromium. The Like
button is injected for every X/Twitter status, while author identity metadata is
looked up through the `lookupDirectoryHandle` Firebase HTTPS function.

The extension registers the repository's real `nostr-like-button` component in
X's MAIN world, where it can use the page-owned NIP-07 signer. X's restrictive
`connect-src` policy blocks relay WebSockets there, so a narrow message bridge
routes only validated kind-17 queries and signed reaction publishes through the
extension's isolated world. Rebuild the URL helper, relay client, and component
bundles whenever their source changes:

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

The component uses the library's shared Nostr service and Like relay pool rather
than duplicating reaction logic inside the extension. Signer public keys are
cached in `sessionStorage` for the current tab so scrolling does not repeat the
read-public-key prompt for every rendered post.
