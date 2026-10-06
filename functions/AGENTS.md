# Directory HTTP API

Firebase Functions for the Nostr Atlas directory. Runtime is Node 22 (`functions/package.json`).

- Install: `npm --prefix functions ci`.
- `nostr-tools`, `ws`, `@nostr-dev-kit/ndk`, `light-bolt11-decoder`, and `@scure/base` are pinned to the exact versions in `backend/package.json`. `ingestClaim` and `ingestUrlEvent` run the copied crawler code with these dependencies.
- Test: `npm run test:functions` from the repo root, or `npm --prefix functions test`.
- Functions are public HTTP endpoints with CORS. Clients (Atlas, the browser extension, Storybook) do not read these Firestore collections directly.
- `listAtlasProfiles` returns verified public fields only. Omit claims, evidence, `lud16`, and retry state. `lookupAtlasHandle` returns `activeIdentity.lud16` only when `zappable` is true. `zappable` stays null until a check finishes. A `nostrProfiles` document supplies that zap state, the signed kind 0 and kind 10002, and an `nprofile` with up to two write relays. Until that document exists, the lookup uses the zap fields still stored on the claim.
- `lookupNostrProfiles` returns those signed events and `zappable` for up to 50 pubkeys. One call fetches at most 10 missing profiles, inside a 3 second budget. A real miss, where every relay answered without a profile, is remembered for an hour. `fresh=1` is one pubkey, and it refetches a stored copy or a miss older than 10 minutes. A fetch cut off by the budget is not a miss.
- `getUrlActivity`, `listUrlEvents`, and `listViewerReactions` take URL keys and pubkeys, not raw URLs. `getUrlActivity` is cached for 30 seconds. `listViewerReactions` reads the `pubkey` field on reaction documents.
- `ingestUrlEvent` accepts a kind 17 or 9735 body only after a sweep relay returns that event id. It runs as the crawler service account, like `ingestClaim`. The relay check and the profile refresh each stop at 3 seconds, so the call fits its 15 second limit.
- Root `firebase.json` runs `node functions/prepare-ingest-sources.mjs` before a functions deploy. That copies `backend/nostr-atlas`, `backend/nostr-pulse`, and `backend/relay-roles.json` into this directory. Keep that hook in place.
- Deploy named functions to project `nostr-components`: `listAtlasProfiles`, `lookupAtlasHandle`, `checkClaimProof`, `ingestClaim`, `lookupNostrProfiles`, `getUrlActivity`, `listUrlEvents`, `listViewerReactions`, `ingestUrlEvent`. The URL reads need the indexes in [firestore.indexes.json](../firestore.indexes.json). Deploy the `listingKey` index and backfill handles before `listAtlasProfiles` on a new project. See [nostr-atlas/README.md](../nostr-atlas/README.md).
