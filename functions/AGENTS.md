# Directory HTTP API

Firebase Functions for the Nostr Atlas directory. Runtime is Node 22 (`functions/package.json`).

- Install: `npm --prefix functions ci`.
- Test: `npm run test:functions` from the repo root, or `npm --prefix functions test`.
- Functions are public HTTP endpoints with CORS. Clients (Atlas, the browser extension, Storybook) do not read these Firestore collections directly.
- `listAtlasProfiles` returns verified public fields only. Omit claims, evidence, `lud16`, and retry state.
- Root `firebase.json` runs `node functions/prepare-ingest-sources.mjs` before a functions deploy. Keep that hook in place.
- Deploy named functions to project `nostr-components`: `listAtlasProfiles`, `lookupAtlasHandle`, `checkClaimProof`, `ingestClaim`. Deploy the `listingKey` index and backfill handles before `listAtlasProfiles` on a new project. See [nostr-atlas/README.md](../nostr-atlas/README.md).
