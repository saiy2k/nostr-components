# Nostr Atlas directory site

Nostr Atlas is a self-contained Vite + TypeScript site for creator account
claims. It is designed to connect the X and YouTube accounts an audience already
knows to a creator's Nostr identity, making that identity easier to find and zap
from compatible Nostr clients. It intentionally lives beside the existing
component library so the package build and backend jobs remain unchanged.

## Data connection

The site fetches `listDirectoryProfiles`, an HTTP Firebase Function that reads
`nostrDirectoryHandles` in Firestore using the Admin SDK. It uses each handle's
current `activeIdentity`, so pending claims and obsolete identities are excluded.
The response contains only the handle, verified public key, name, and NIP-05
metadata; claim evidence and payment details stay on the server. No Firebase
web API key, browser database credentials, or public Firestore rules are needed.

`VITE_DIRECTORY_API_URL` selects the endpoint. Builds for the separate live
Firebase project should always set it to that project's deployed function URL.
Without an override, the site retains the existing `gr-prod` endpoint as a
backward-compatible development fallback. **Deploy the function before building
against a new project**, or use the local Functions emulator below.

The API reads up to 50 documents per request. `limit` accepts 1–100 and `offset`
selects the first record in a batch. Every response includes `total`, the count of
verified records matching the request, so the UI can show all database-backed
pages before those pages are loaded. The browser caches 50-record batches and
requests the batch containing a page only when the user opens that page.

The optional `search` parameter performs an exact, server-side lookup by X handle
(including `@handle` and X/Twitter profile URLs), NIP-05 address, or npub. It does
not download the collection or filter only browser-cached rows. The unfiltered
query uses `activeIdentity.status == verified`, ordered by document ID. Search
adds an equality filter for the normalized identifier. Keep the corresponding
Firestore fields indexed; Firebase will report any additional index required by
the selected project. Successful responses may be cached for 60 seconds; errors
are not cached.

The directory table includes page navigation (Previous, Next, and numbered page
buttons) and customizable page sizes (10, 25, or 50 claims per page, defaulting
to 10). **Refresh** clears the cached batches and reloads the current search from
the first page. Local previews survive a refresh but disappear when the page is
reloaded. API failures never display sample data as real records.

The current crawler projection contains verified X identities. The public handle
documents do not currently store X follower counts, Nostr follower counts, or a
ranking snapshot, and they do not supply YouTube claims. Audience fields show `—`,
the misleading client-side "Most followed" sort is not shown, and the Nostr tab
explains its empty state. A verified mark means X account
ownership was verified by the projector; a NIP-05 address is profile metadata,
not a separate NIP-05 verification. The claim form still creates a **local preview**;
it does not write to Firestore, publish a claim, or verify ownership.

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
firebase emulators:start --only functions --project gr-prod
```

The signed-in Google account needs permission to read the directory database.
This runs the HTTP function locally and reads the existing Firestore database;
only the Functions emulator is started. The new endpoint performs no writes.
If local credentials already exist, the login step is unnecessary.

In a second terminal, from the repository root:

```sh
VITE_DIRECTORY_API_URL=http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles npm run dev:directory
```

Open the URL printed by Vite. For a persistent endpoint override, copy
`directory-site/.env.example` to `directory-site/.env.local`, set its URL, and
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
   confirm `listDirectoryProfiles?limit=50&offset=0` returns HTTP 200 with
   `profiles`, `total`, and `offset`. The page should show real verified X records,
   or an honest empty state if the database has none. Loading should never briefly
   show demo rows.
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
   `offset=50`; a distant page should request its containing 50-record batch.
   Returning to a page in a cached batch should not fetch the entire collection.
5. Select **Popular on Nostr** and check the explanatory empty state. Return to
   the X tab. Add a local claim preview: it should be marked **Local preview**, have
   no verification check, and cause no write request. Refreshing the directory
   keeps the preview; reloading the page removes it.
6. Block the endpoint in DevTools or stop the Functions emulator, then click
   **Refresh**. Expect an error and **Retry**, with existing rows retained. A page
   reload while it is blocked should show an error rather than sample data.
   Restore the endpoint and retry. For a timeout check, throttle or stall the
   request; it should stop after about 15 seconds.
7. To check an empty directory, set `FIRESTORE_HANDLES_COLLECTION` to an unused
   collection name and restart the Functions emulator. Expect
   `{ "profiles": [], "nextCursor": null }`. Use a separate test Firebase project
   for invalid-record fixtures: documents without a verified active identity must
   never become verified rows. The Functions-only emulator still reads real
   Firestore, so do not modify production claims for this check.

You can also inspect the endpoint without opening a browser:

```sh
curl --fail-with-body 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles?limit=2&offset=0'
curl --fail-with-body 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles?search=%40jack'
# Expect 400 invalid_limit:
curl -i 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles?limit=101'
# Expect 405 method_not_allowed:
curl -i -X POST 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles'
```

## Deploy the read API

The repository's default Firebase project is for Storybook. Always specify the
directory project and deploy only the new function:

```sh
firebase deploy --only functions:listDirectoryProfiles --project YOUR_LIVE_PROJECT_ID
```

The function's runtime service account needs Firestore read access in that
project/database. It is a public GET API with CORS enabled, following Firebase's
[HTTP function configuration](https://firebase.google.com/docs/functions/http-events).
Use the function URL printed by deployment as `VITE_DIRECTORY_API_URL` if it
differs from the default. The existing extension lookup is not redeployed by this
command. No hosting target or database rules are changed.

## Run against the deployed API

From the repository root:

```sh
npm run dev:directory
```

Then open the URL printed by Vite.

## Build

```sh
npm run build:directory
```

The deployable static site is written to `directory-site/dist/`.

Vite captures `VITE_DIRECTORY_API_URL` at build time. If `.env.local` points to the
emulator, override it when building for deployment:

```sh
VITE_DIRECTORY_API_URL=https://us-central1-YOUR_LIVE_PROJECT_ID.cloudfunctions.net/listDirectoryProfiles npm run build:directory
```

## Code checks

```sh
npm run test:functions
npx vitest run directory-site/src
npx tsc --project directory-site/tsconfig.json
npm run build:directory
```

These cover the API contract, public field filtering, pagination, error handling,
frontend mapping, TypeScript, and the static build. They do not launch a browser.
