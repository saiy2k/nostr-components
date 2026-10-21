# Agent map

This repo holds several products. Identify the surface before editing. Library source lives in `src/`. `scripts/` is shared build and copy tooling. Other product directories are separate apps, jobs, or plugins.

Read the surface README for runbooks. This file routes work, names the traps, and states how to change the repo. Vocabulary: [CONTEXT.md](CONTEXT.md).

## Voice

Answer only what was asked, then stop. [.cursor/rules/voice.mdc](.cursor/rules/voice.mdc).

## Where truth lives

| File | Job |
|------|-----|
| [CONTEXT.md](CONTEXT.md) | Vocabulary. Glossary only. |
| [docs/adr/](docs/adr/) | Why a hard-to-reverse choice was made. |
| [docs/spec/](docs/spec/) | New behavior: what it does, including seams. |
| `src/nostr-like-button/spec/`, `src/nostr-zap-button/spec/` | Existing Like and Zap behavior. Leave it there. |

## Code

The smallest change that satisfies the task. No speculative features. No drive-by refactors. A refactor is its own step and its own commit, and it changes structure only.

## Development loop

1. **Vocabulary.** Read `CONTEXT.md`. Use its terms. Done when every name in the change matches the glossary, or the glossary is updated first.
2. **Decisions.** Before the spec, write `docs/adr/NNNN-slug.md` (next unused number) only when all three hold: hard to reverse, surprising without context, and a real trade-off. The file has a title and states the context, the choice, and why. Done when all three hold and the new ADR does that, or when any one is missing and this change adds no ADR. [.cursor/rules/decisions.mdc](.cursor/rules/decisions.mdc).
3. **Spec.** Write or update the spec for this change, including `## Seams`: `docs/spec/` for new behavior, or the existing file under `src/nostr-like-button/spec/` or `src/nostr-zap-button/spec/` when that behavior already lives there. Done when the intended behavior and the interfaces under test are stated. Do not invent a spec for behavior this change does not touch. Leave the tests unwritten until this step is done.
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
