# Nostr Atlas

Nostr Atlas is a self-contained Vite + TypeScript site for creator account
claims. It is designed to connect the X and YouTube accounts an audience already
knows to a creator's Nostr identity, making that identity easier to find and zap
from compatible Nostr clients. It intentionally lives beside the existing
component library so the package build and backend jobs remain unchanged.

## Data connection

The site fetches `listAtlasProfiles`, an HTTP Firebase Function that reads
`nostrDirectoryHandles` in Firestore using the Admin SDK. It uses each handle's
current `activeIdentity`, so pending claims and obsolete identities are excluded.
The response contains the handle, verified public key, name, NIP-05, and `picture`.
`picture` is the Nostr profile image, the stored X avatar when that image is
missing, or an empty string. Claim evidence and payment details stay on the
server. No Firebase web API key, browser database credentials, or public
Firestore rules are needed.

`VITE_ATLAS_API_URL` selects the endpoint. Builds for a different Firebase
project should set it to that project's deployed function URL. Without an
override, the site uses
`https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles`.
**Deploy the function before building against a new project**, or use the local
Functions emulator below. `VITE_DIRECTORY_CLAIM_RELAYS` optionally overrides the
public relays used when publishing a claim. At least one must appear in
`backend/relays.json`.

The API reads up to 50 documents per request. `limit` accepts 1–100 and `offset`
tracks the first logical record in a batch. Every response includes `total`, the
count of verified records matching the request, and `nextCursor`, the last
document ID when more records exist. The UI can therefore show all database-backed
pages before those pages are loaded.

Direct Firestore offsets are capped at 10,000 records because Firestore bills
skipped documents. Pages inside that result window can be opened directly. For a
deeper page, the browser starts from the nearest cached `nextCursor` (or the
10,000-record boundary) and advances with keyset `startAfter` requests. Each such
request still reads at most one batch; it never applies the large logical offset
to Firestore. The browser caches all fetched 50-record batches and cursors.

The optional `search` parameter performs an exact, server-side lookup by X handle
(including `@handle` and X/Twitter profile URLs), NIP-05 address, or npub. It does
not download the collection or filter only browser-cached rows. The unfiltered
query uses `activeIdentity.status == verified`, ordered by `listingKey`. The first
50 keys (`0-0000` through `0-0049`) are the curated X handles in
`functions/featured-handles.js`, which fills the first five pages at the default
page size of 10. Every other verified handle uses `1-` plus its document id, so
the rest of the directory stays in handle order. A curated handle that is missing
or not verified is skipped. Search keeps its own handle, NIP-05, or npub order
and does not apply this pin list. `listingKey` must be backfilled before the
listing function is deployed, because documents without that field are excluded.
The composite index is `activeIdentity.status` plus `listingKey` in
`firestore.indexes.json`. Deploying that file reconciles the project's composite
indexes, so merge any indexes already in the project into the file first.
Successful responses may be cached for 60 seconds; errors are not cached.

The directory table includes page navigation (Previous, Next, and numbered page
buttons) and customizable page sizes (10, 25, or 50 claims per page, defaulting
to 10). Fetched batches stay in memory until the page is reloaded. A failed load
shows **Retry**, which reloads the current page. API failures never display
sample data as real records.

The current crawler projection contains verified X identities. The public handle
documents do not currently store X follower counts, Nostr follower counts, or a
ranking snapshot, and they do not supply YouTube claims. Audience fields show `—`,
the misleading client-side "Most followed" sort is not shown, and the Nostr tab
explains its empty state. A verified mark means X account
ownership was verified by the projector; a NIP-05 address is profile metadata,
not a separate NIP-05 verification. The claim form signs a kind-10011 event,
publishes it to Nostr relays, and asks `ingestClaim` to record it. That request
does not by itself mark the account verified; the directory shows it after the
proof check succeeds.

To make the two popularity tabs real, a separate metrics job should materialize
bounded public fields such as `metrics.xFollowers` and
`metrics.nostrFollowers`, together with source and capture timestamps. X counts
must come from an authorized X API source. Nostr counts need a defined rule (for
example, distinct valid kind-3 authors whose latest contact list follows the
pubkey) and a relay/indexer coverage policy. The list API can then order by the
selected metric using explicit composite indexes and deterministic document-ID
tie-breaking. Counts should be refreshed asynchronously; a page request should
not call either network to calculate popularity live.

## Run locally against Firestore

Use Node.js 22 and the Firebase CLI. From the repository root:

```sh
npm ci
npm --prefix functions ci
gcloud auth application-default login
firebase emulators:start --only functions --project nostr-components
```

The signed-in Google account needs permission to read the directory database.
This runs the HTTP function locally and reads the existing Firestore database;
only the Functions emulator is started. The new endpoint performs no writes.
If local credentials already exist, the login step is unnecessary.

In a second terminal, from the repository root:

```sh
VITE_ATLAS_API_URL=http://127.0.0.1:5001/nostr-components/us-central1/listAtlasProfiles npm run dev:atlas
```

Open the URL printed by Vite. For a persistent endpoint override, copy
`nostr-atlas/.env.example` to `nostr-atlas/.env.local`, set its URL, and
restart Vite. Never put a service-account key or other credentials in a `VITE_*`
variable; these values are bundled into the public site.

For another Firebase project, change both `--project` and the project segment in
the emulator URL. The function reads that project's `(default)` database and
`nostrDirectoryHandles` collection. Optional server environment variables
`FIRESTORE_DATABASE` and `FIRESTORE_HANDLES_COLLECTION` select a named database or
another collection. Set these in `functions/.env.local` for the emulator, or
`functions/.env.PROJECT_ID` for deployment.

## Manual test checklist (no automated browser test)

1. Start the function and site using the commands above. In DevTools Network,
   confirm `listAtlasProfiles?limit=50&offset=0` returns HTTP 200 with
   `profiles`, `total`, and `offset`. Those 50 profiles are the curated handles,
   in list order, and `offset=50` continues with the alphabetical tail without
   repeating them. The page should show real verified X records, or an honest
   empty state if the database has none. Loading should never briefly show demo
   rows.
2. Compare a returned `twitter:HANDLE` with the same document in Firestore:
   `activeIdentity.status` must be `verified`, the API `pubkey` must match the active
   key, and the displayed name/NIP-05 must match available metadata. Missing
   metadata falls back to the handle and `—`. The response must not contain
   `claims`, evidence, `lud16`, or retry state.
3. Search for an exact handle, NIP-05, and copied npub that are outside the first
   50 rows. Confirm each request includes `search`, the result is returned, clear
   filters, copy a key and paste it, and open its Nostr profile. Audience counts
   should display `—`, without fabricated rankings.
4. Check the directory pagination bar: verify its total page count matches
   `ceil(total / pageSize)`, then use previous/next, a distant direct page, and
   page-size switching (10, 25, 50). Page 6 at the default size should request
   `offset=50`; a distant page inside the first 10,000 records should request its
   containing 50-record batch. For a synthetic directory larger than 10,000,
   confirm deeper requests include a validated `cursor` and advance in 50-record
   batches rather than applying a deep Firestore offset. Returning to a cached
   page should not fetch the collection again.
5. Select **Popular on Nostr** and check the explanatory empty state. Return to
   the X tab. Open **Claim your X account**. The dialog should ask for a signer
   and a proof tweet. Closing it without publishing should add no row and cause
   no write request. Live claim checks are in `qa.md`.
6. Block the endpoint in DevTools or stop the Functions emulator, then open a
   page that is not cached. Expect an error and **Retry**, with existing rows
   retained. A page reload while it is blocked should show an error rather than
   sample data.
   Restore the endpoint and retry. For a timeout check, throttle or stall the
   request; it should stop after about 15 seconds.
7. To check an empty directory, set `FIRESTORE_HANDLES_COLLECTION` to an unused
   collection name and restart the Functions emulator. Expect
   `{ "profiles": [], "total": 0, "offset": 0, "nextCursor": null }`. Use a
   separate test Firebase project for invalid-record fixtures: documents without
   a verified active identity must never become verified rows. The Functions-only
   emulator still reads real Firestore, so do not modify production claims for
   this check.

You can also inspect the endpoint without opening a browser:

```sh
curl --fail-with-body 'http://127.0.0.1:5001/nostr-components/us-central1/listAtlasProfiles?limit=2&offset=0'
curl --fail-with-body 'http://127.0.0.1:5001/nostr-components/us-central1/listAtlasProfiles?search=%40jack'
# Expect 400 invalid_limit:
curl -i 'http://127.0.0.1:5001/nostr-components/us-central1/listAtlasProfiles?limit=101'
# Expect 405 method_not_allowed:
curl -i -X POST 'http://127.0.0.1:5001/nostr-components/us-central1/listAtlasProfiles'
```

## Deploy the read API

The repository's default Firebase project is for Storybook. Always specify the
directory project. Deploy the `listingKey` index and backfill every handle
before the listing function, then deploy the renamed read APIs:

```sh
firebase deploy --only firestore:indexes --project YOUR_LIVE_PROJECT_ID
node backend/nostr-atlas/listing-key-backfill.js --project YOUR_LIVE_PROJECT_ID
node backend/nostr-atlas/listing-key-backfill.js --write --project YOUR_LIVE_PROJECT_ID
firebase deploy --only functions:listAtlasProfiles,functions:lookupAtlasHandle,functions:checkClaimProof,functions:ingestClaim --project YOUR_LIVE_PROJECT_ID
```

The backfill refuses to write if any curated handle is missing or not verified.
Run it from the repository root with Application Default Credentials that can
read and update `nostrDirectoryHandles`.

The function's runtime service account needs Firestore read access in that
project/database. It is a public GET API with CORS enabled, following Firebase's
[HTTP function configuration](https://firebase.google.com/docs/functions/http-events).
Use the function URL printed by deployment as `VITE_ATLAS_API_URL` if it
differs from the default. This command adds `lookupAtlasHandle` and leaves the
previous `lookupDirectoryHandle` deployment in place for older extensions. It
also deploys `checkClaimProof` and `ingestClaim`, which the claim form calls.
Database rules are not changed.

## Deploy the site

From the repository root, after `npm ci`:

```sh
npm run build:atlas
firebase deploy --only hosting:atlas --project nostr-components
```

This publishes `nostr-atlas/dist` to https://nostr-atlas.web.app. It does not
deploy Cloud Functions or the Storybook hosting target.

## Run against the deployed API

From the repository root:

```sh
npm run dev:atlas
```

Then open the URL printed by Vite.

## Build

```sh
npm run build:atlas
```

The deployable static site is written to `nostr-atlas/dist/`.

## SEO

The public origin is `https://nostr-atlas.web.app`. Set `VITE_SITE_ORIGIN` when the site is served from another origin. The homepage HTML already contains the title, description, canonical URL, and social tags. `build:atlas` also writes `robots.txt` and a sitemap for that one page. There are no per-account URLs. Search query strings such as `?q=` stay canonical to the homepage.

Vite captures `VITE_ATLAS_API_URL` at build time. If `.env.local` points to the
emulator, override it when building for deployment:

```sh
VITE_ATLAS_API_URL=https://us-central1-YOUR_LIVE_PROJECT_ID.cloudfunctions.net/listAtlasProfiles npm run build:atlas
```

## Code checks

```sh
npm run test:functions
npx vitest run nostr-atlas/src
npx tsc --project nostr-atlas/tsconfig.json
npm run build:atlas
```

These cover the API contract, public field filtering, pagination, error handling,
frontend mapping, TypeScript, and the static build. They do not launch a browser.
