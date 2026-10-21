# Agent map

This repo holds several products. Identify the surface before editing. Library source lives in `src/`. `scripts/` is shared build and copy tooling. Other product directories are separate apps, jobs, or plugins.

Read the surface README for runbooks. This file routes work, names the traps, and states how to change the repo. Vocabulary: [CONTEXT.md](CONTEXT.md).

## Product

Current launch milestone: Like and Zap on x.com and youtube.com, the Nostr Atlas directory, and Nostr crawling.

## Voice

Answer only what was asked, then stop. [.cursor/rules/voice.mdc](.cursor/rules/voice.mdc).

## Where truth lives

| File | Job |
|------|-----|
| [CONTEXT.md](CONTEXT.md) | Vocabulary. Glossary only. |
| [docs/adr/](docs/adr/) | Why a hard-to-reverse choice was made. |
| `src/<component>/spec/spec.md` | What that component does. Like, Zap, and Livestream already use this path. |

## Code

The smallest change that satisfies the task. No speculative features. No drive-by refactors. A refactor is its own step and its own commit, and it changes structure only.

## Development loop

A documentation-only or configuration-only change with no observable behavior skips this loop. Use the commit format under Everything else.

1. **Vocabulary.** Read `CONTEXT.md`. Use its terms. Done when every name in the change matches the glossary, or the glossary is updated first.
2. **Decisions.** Before the spec, write `docs/adr/NNNN-slug.md` (next unused number) only when all three hold: hard to reverse, surprising without context, and a real trade-off. The file has a title and states the context, the choice, and why. Done when all three hold and the new ADR does that, or when any one is missing and this change adds no ADR. [.cursor/rules/decisions.mdc](.cursor/rules/decisions.mdc).
3. **Spec.** Write or update `src/<component>/spec/spec.md` next to the component, and name the interfaces under test there. Like, Zap, and Livestream already use that path. Done when the intended behavior and those interfaces are stated. Do not invent a spec for behavior this change does not touch. Leave the tests unwritten until this step is done.
4. **Red.** Write the failing tests at those seams. Run the check for the surface you changed. Commit `Red: <behavior>.` Stop for review. Done when that check fails at the seam and the user has the red output. [.cursor/rules/tdd.mdc](.cursor/rules/tdd.mdc).
5. **Green.** Starts only after the user approves the tests. The smallest change that makes them pass. Commit `Green: <behavior>.` Done when the surface check is green.
6. **Refactor.** After the green commit, stop. The user reviews that commit. This step starts only when the user says `refactor`. One commit of its own. Change structure only: the spec, the tests, and the observable behavior stay as they are, and the surface check stays green. Done when that commit is on the branch and the surface check is green. This step is skipped only when the user says to merge without a refactor.

A feature branch may carry red commits. The branch is ready for review when the last slice's green commit passes the surface check. A refactor commit may be the tip of that branch.

## Commit messages

Feature slices:

```
Red: <behavior>.
Green: <behavior>.
Refactor: <what changed>.
```

Everything else:

```
Short summary.

Optional one-sentence why.
```

## Safety

Fixture data only. Never commit secrets, keys, `nsec`s, or `.env` files. Ask before destructive git. Never push to `main`. [.cursor/rules/safety-privacy.mdc](.cursor/rules/safety-privacy.mdc).

## Surfaces

### Component library

- Source: `src/`. Package root is [package.json](package.json).
- On x.com and YouTube, the Like and Zap buttons are injected by the browser extension, so their queries can use the directory HTTP API. On any other website, all Like and Zap communication goes directly to relays. The page does not call the directory API. Without a host transport, use the rendezvous relays in [backend/relay-roles.json](backend/relay-roles.json). Profile lookups follow the pubkey's relay list. A host transport that does not implement the newer methods keeps the previous relay list and URL strings.
- Check: `npm test`, `npm run storybook`, `npm run build`.
- Ships as the `nostr-components` npm package, and as Firebase Hosting target `storybook` on site `nostr-component` ([.firebaserc](.firebaserc), [firebase.json](firebase.json)).
- `src/nostr-comment`, `src/nostr-dm`, and `src/nostr-live-chat` remain in the tree. Their imports in `src/index.ts` and entries in `vite.config.esm.ts` are disabled, so they are not published.

### Nostr Atlas site

- Source: `nostr-atlas/`. Local notes: [nostr-atlas/AGENTS.md](nostr-atlas/AGENTS.md).
- Check: `npm run dev:atlas`, `npm run build:atlas`.
- Ships as Firebase Hosting target `atlas` on site `nostr-atlas` (`https://nostr-atlas.web.app`). `/` is the directory. `/pulse/` is Web Pulse, which reads the pulse HTTP functions. Each page's header like and zap buttons target one fixed URL for that page.
- `VITE_*` values are bundled into the public site. Keep credentials out of them.

### Directory HTTP API

- Source: `functions/`. Local notes: [functions/AGENTS.md](functions/AGENTS.md).
- Runtime: Node 22. Check: `npm run test:functions`.
- Deploy named functions only, to project `nostr-components`: `listAtlasProfiles`, `lookupAtlasHandle`, `checkClaimProof`, `ingestClaim`, `lookupNostrProfiles`, `getUrlActivity`, `listUrlEvents`, `listViewerReactions`, `ingestUrlEvent`, `getPulseOverview`, `getPulseDomain`, `listPulseActivity`.
- `listAtlasProfiles` omits claims, evidence, `lud16`, and retry state. `lookupAtlasHandle` returns `activeIdentity.lud16` when `zappable` is true, plus the signed profile and an `nprofile` with up to two write relays. `zappable` stays null until a check finishes.

### Crawler jobs

- Source: `backend/`. Own `package.json`. Local notes: [backend/AGENTS.md](backend/AGENTS.md).
- Cloud Run: `backend/deploy-nostr-atlas-backfill.sh`, `backend/deploy-nostr-atlas-frontfill.sh`, `backend/deploy-nostr-atlas-projection.sh`, and `backend/deploy-nostr-pulse-sweep.sh`.
- Firestore rules live in [backend/firebase.json](backend/firebase.json). Deploy them with `--config backend/firebase.json --project nostr-components`. A root `firebase deploy` does not publish those rules. Leave project `sat-the-standard` alone.

### Browser extension

- Source: `browser-extension/src/`. Load the `browser-extension/` folder unpacked in Chromium. Local notes: [browser-extension/AGENTS.md](browser-extension/AGENTS.md).
- After source changes: `npm run build:browser-extension`, then `npm run test:browser-extension`. Commit the regenerated `browser-extension/lib/` files in the same PR.
- Leave `browser-extension/lib/` to that build.

### WordPress plugin

- Source: `saiy2k-nostr-components/` PHP and blocks, plus component behavior in `src/`. Local notes: [saiy2k-nostr-components/AGENTS.md](saiy2k-nostr-components/AGENTS.md).
- `npm run wp-build` copies bundles into `saiy2k-nostr-components/assets/`.
- `npm run wp-release` prepares a zip and SVN instructions. It does not publish. The WordPress.org `svn commit` needs the owner's approval. This plugin does not deploy through Firebase.

### Promo videos

- Source: `promo/`. HyperFrames compositions only. No product deploy target. `npm run publish` creates a public link and needs the owner's approval.

## Shared blast radius

Like and Zap source under `src/` is consumed by the npm package, Storybook, the browser extension, and the WordPress plugin. After changing it, rebuild and test each consumer you touched.

## Generated outputs

Leave these paths to their build commands: `dist/`, `storybook-static/`, `browser-extension/lib/`, `saiy2k-nostr-components/assets/`.

## Tests

Root Vitest ([vitest.config.ts](vitest.config.ts)) excludes `functions/` and `backend/`. `npm test` does not cover them. Use the check command for the surface you changed.

## Contracts

Do not change these without the owner's approval:

- URL canonicalisation in [backend/nostr-pulse/url-canonical.js](backend/nostr-pulse/url-canonical.js). [src/common/url-tags.ts](src/common/url-tags.ts) and the browser extension import it.
- Like and zap event semantics and tags, including kind 17 `+` / `-` and the zap request and receipt tags. The behavior specs are `src/nostr-like-button/spec/spec.md` and `src/nostr-zap-button/spec/spec.md`.
- Directory API request and response shapes in [functions/AGENTS.md](functions/AGENTS.md).
- Firestore collections and fields the directory API and the crawler write, named in [functions/AGENTS.md](functions/AGENTS.md) and [backend/AGENTS.md](backend/AGENTS.md).

## Security

- No key material and no software signer in x.com or YouTube pages. Signer public keys stay in memory for the current tab. Do not write them to `sessionStorage`.
- X Zaps require a verified, zappable directory identity. YouTube Zaps require a checksum-valid lowercase `npub` in the creator-owned channel identity area. Ignore titles, descriptions, metadata, and channel-URL mappings as payment recipients.
- Signing, invoice requests, and payments need a trusted user event. A zap may complete only for the same URL and recipient.
- A refused or closed signer never falls back to anonymous signing.
- Outbound HTTPS and WebSocket from the extension, the directory API, and the crawler use public hosts only, with size, time, and URL-length caps.
- Only NIP-57-validated zap receipts count. A like count is each pubkey's newest reaction.
- No secrets in the repo, in `VITE_*` values, in logs, or in issue and PR text. Firestore stays closed to clients.
- Public endpoints cap their inputs. Widening the extension's host permission needs the owner's approval.

## Deploys

Every deploy and publish needs the owner's explicit approval, not another bot's. Name one target. Do not run a bare `firebase deploy`.

| Action | Command |
|--------|---------|
| Firebase Hosting | `firebase deploy --only hosting:storybook --project nostr-components` or `firebase deploy --only hosting:atlas --project nostr-components` |
| Firebase Functions | `firebase deploy --only functions:<name> --project nostr-components` |
| Firestore rules | `firebase deploy --only firestore:rules --config backend/firebase.json --project nostr-components` |
| Firestore indexes | `firebase deploy --only firestore:indexes --project nostr-components` |
| Cloud Run crawlers | `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-backfill.sh`, `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-frontfill.sh`, `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-projection.sh`, or `PROJECT_ID=nostr-components backend/deploy-nostr-pulse-sweep.sh`. These scripts also create service accounts, IAM, and schedulers. |
| npm | `npm publish` of `nostr-components` |
| Chrome Web Store | store upload of the extension |
| WordPress | `svn commit` after `npm run wp-release` prepares the zip |
| Promo | `npm run publish` under `promo/` |

Leave project `sat-the-standard` alone. Scripts that write production Firestore (`hide.js`, `--rebuild`, `import-web-pulse.js --write`, deleting `frontfill:` state docs) need the same approval. The unpacked extension calls the production directory API.

## Definition of done

- `npx tsc --noEmit -p tsconfig.json` and `npm test`, plus the check for each surface you touched. Fix type errors your change introduces. Leave an unrelated failure for its own change.
- If `src/` or `browser-extension/src/` changed, run `npm run build:browser-extension` and commit the regenerated `browser-extension/lib/` files in the same PR.

## TODOs for the owner

- TODO(owner): product-goal wording and the out-of-scope list.
- TODO(owner): whether to write down the pause on outside contributions.
- TODO(owner): branch naming and squash-merge conventions.
- TODO(owner): limits for real-payment QA.
- TODO(owner): whether to add a staging project. Production today is Firebase/GCP project `nostr-components`.

## Install

On newer npm, the root install may need `npm install --legacy-peer-deps`.
