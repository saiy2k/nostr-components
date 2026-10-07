# Agent map

This repo holds several products. Identify the surface before editing. Library source lives in `src/`. `scripts/` is shared build and copy tooling. Other product directories are separate apps, jobs, or plugins.

Read the surface README for runbooks. This file only routes work and names the traps.

## Surfaces

### Component library

- Source: `src/`. Package root is [package.json](package.json).
- Likes and zaps on a page without a host transport use the rendezvous relays in [backend/relay-roles.json](backend/relay-roles.json). Profile lookups follow the pubkey's relay list. A host transport that does not implement the newer methods keeps the previous relay list and URL strings.
- Check: `npm test`, `npm run storybook`, `npm run build`.
- Ships as the `nostr-components` npm package, and as Firebase Hosting target `storybook` on site `nostr-component` ([.firebaserc](.firebaserc), [firebase.json](firebase.json)).
- `src/nostr-comment`, `src/nostr-dm`, and `src/nostr-live-chat` remain in the tree. Their imports in `src/index.ts` and entries in `vite.config.esm.ts` are disabled, so they are not published.

### Nostr Atlas site

- Source: `nostr-atlas/`. Local notes: [nostr-atlas/AGENTS.md](nostr-atlas/AGENTS.md).
- Check: `npm run dev:atlas`, `npm run build:atlas`.
- Ships as Firebase Hosting target `atlas` on site `nostr-atlas` (`https://nostr-atlas.web.app`).
- `VITE_*` values are bundled into the public site. Keep credentials out of them.

### Directory HTTP API

- Source: `functions/`. Local notes: [functions/AGENTS.md](functions/AGENTS.md).
- Runtime: Node 22. Check: `npm run test:functions`.
- Deploy named functions only, to project `nostr-components`: `listAtlasProfiles`, `lookupAtlasHandle`, `checkClaimProof`, `ingestClaim`, `lookupNostrProfiles`, `getUrlActivity`, `listUrlEvents`, `listViewerReactions`, `ingestUrlEvent`.
- `listAtlasProfiles` omits claims, evidence, `lud16`, and retry state. `lookupAtlasHandle` returns `activeIdentity.lud16` when `zappable` is true, plus the signed profile and an `nprofile` with up to two write relays. `zappable` stays null until a check finishes.

### Crawler jobs

- Source: `backend/`. Own `package.json`. Local notes: [backend/AGENTS.md](backend/AGENTS.md).
- Cloud Run: `backend/deploy-nostr-atlas-backfill.sh`, `backend/deploy-nostr-atlas-projection.sh`, and `backend/deploy-nostr-pulse-sweep.sh`.
- Firestore rules live in [backend/firebase.json](backend/firebase.json). Deploy them with `--config backend/firebase.json --project nostr-components`. A root `firebase deploy` does not publish those rules. Leave project `sat-the-standard` alone.

### Browser extension

- Source: `browser-extension/src/`. Load the `browser-extension/` folder unpacked in Chromium. Local notes: [browser-extension/AGENTS.md](browser-extension/AGENTS.md).
- After source changes: `npm run build:browser-extension`, then `npm run test:browser-extension`.
- Leave `browser-extension/lib/` to that build.

### WordPress plugin

- Source: `saiy2k-nostr-components/` PHP and blocks, plus component behavior in `src/`. Local notes: [saiy2k-nostr-components/AGENTS.md](saiy2k-nostr-components/AGENTS.md).
- `npm run wp-build` copies bundles into `saiy2k-nostr-components/assets/`.
- Release with `npm run wp-release`. This plugin does not deploy through Firebase.

### Promo videos

- Source: `promo/`. HyperFrames compositions only. No product deploy target.

## Shared blast radius

Like and Zap source under `src/` is consumed by the npm package, Storybook, the browser extension, and the WordPress plugin. After changing it, rebuild and test each consumer you touched.

## Generated outputs

Leave these paths to their build commands: `dist/`, `storybook-static/`, `browser-extension/lib/`, `saiy2k-nostr-components/assets/`.

## Tests

Root Vitest ([vitest.config.ts](vitest.config.ts)) excludes `functions/` and `backend/`. `npm test` does not cover them. Use the check command for the surface you changed.

## Deploys

Deploy only when asked, and name the exact target in the command. Hosting targets are `hosting:storybook` and `hosting:atlas`. Function deploys list function names. Crawler deploys use the Cloud Run scripts. WordPress uses `npm run wp-release`.

## Install

On newer npm, the root install may need `npm install --legacy-peer-deps`.
