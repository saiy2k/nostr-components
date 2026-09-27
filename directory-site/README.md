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
The response contains the handle, verified public key, name, NIP-05, and `picture`.
`picture` is the Nostr profile image, the stored X avatar when that image is
missing, or an empty string. Claim evidence and payment details stay on the
server. No Firebase web API key, browser database credentials, or public
Firestore rules are needed.

`VITE_DIRECTORY_API_URL` selects the endpoint. Builds for a different Firebase
project should set it to that project's deployed function URL. Without an
override, the site uses
`https://us-central1-nostr-components.cloudfunctions.net/listDirectoryProfiles`.
**Deploy the function before building against a new project**, or use the local
Functions emulator below.

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
to 10). **Refresh** clears the cached batches and reloads the current search from
the first page. Local previews survive a refresh but disappear when the page is
reloaded. API failures never display sample data as real records.

The current crawler projection contains verified X identities. The public handle
documents do not currently store X follower counts, Nostr follower counts, or a
ranking snapshot, and they do not supply YouTube claims. Audience fields show `—`,
the misleading client-side "Most followed" sort is not shown, and the Nostr tab
explains its empty state. A verified mark means X account
ownership was verified by the projector; a NIP-05 address is profile metadata,
not a separate NIP-05 verification. The claim dialog does not write to
Firestore itself. After a relay acknowledges the signed claim, `ingestClaim`
can verify that handle and project it immediately.

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
VITE_DIRECTORY_API_URL=http://127.0.0.1:5001/nostr-components/us-central1/listDirectoryProfiles npm run dev:directory
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
   the X tab. Publishing a claim does not add a local preview row or a verified
   mark; use the claim dialog checks below.
6. Block the endpoint in DevTools or stop the Functions emulator, then click
   **Refresh**. Expect an error and **Retry**, with existing rows retained. A page
   reload while it is blocked should show an error rather than sample data.
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
curl --fail-with-body 'http://127.0.0.1:5001/nostr-components/us-central1/listDirectoryProfiles?limit=2&offset=0'
curl --fail-with-body 'http://127.0.0.1:5001/nostr-components/us-central1/listDirectoryProfiles?search=%40jack'
# Expect 400 invalid_limit:
curl -i 'http://127.0.0.1:5001/nostr-components/us-central1/listDirectoryProfiles?limit=101'
# Expect 405 method_not_allowed:
curl -i -X POST 'http://127.0.0.1:5001/nostr-components/us-central1/listDirectoryProfiles'
```

## Deploy the read API

The repository's default Firebase project is for Storybook. Always specify the
directory project. Deploy the `listingKey` index and backfill every handle
before the listing function, then deploy only that function:

```sh
firebase deploy --only firestore:indexes --project YOUR_LIVE_PROJECT_ID
node backend/relay-directory/listing-key-backfill.js --project YOUR_LIVE_PROJECT_ID
node backend/relay-directory/listing-key-backfill.js --write --project YOUR_LIVE_PROJECT_ID
firebase deploy --only functions:listDirectoryProfiles,functions:checkClaimProof,functions:ingestClaim --project YOUR_LIVE_PROJECT_ID
```

`ingestClaim` runs as `relay-directory-crawler@YOUR_LIVE_PROJECT_ID.iam.gserviceaccount.com`.
That account is chosen from the Firebase project at deploy time. It needs
permission to write `nostrDirectoryHandles` in that project.

The backfill refuses to write if any curated handle is missing or not verified.
Run it from the repository root with Application Default Credentials that can
read and update `nostrDirectoryHandles`.

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

The claim dialog publishes a real X-account claim through the existing
relay-directory protocol:

1. The user connects a NIP-07 browser signer. No private key is requested or
   stored by the site.
2. The dialog shows the signer's npub and opens an X composer with proof text.
3. The user pastes the proof tweet URL. The author in the URL must match the
   claimed X handle. A `/photo` or `/video` suffix on that status URL is
   accepted.
4. Before signing, the site asks `checkClaimProof` to read the proof tweet.
   The tweet author must match the handle, and the tweet text must contain the
   connected npub. That function also returns the relay list the directory
   crawler is using.
5. The signer signs a kind `10011` NIP-39 event. Other `i` tags already published
   for that pubkey are kept, up to 20 identity tags in total. The event includes
   a `client` tag, `Nostr Atlas`, so the stored claim shows that this site
   created it. The site snapshots the event fields before signing and rejects a
   signature that does not match that snapshot.
6. A relay from that crawler list must acknowledge the event. An
   acknowledgement from any other configured relay is not enough.
7. The site then sends that signed event to `ingestClaim`, which writes and
   projects only that handle. The daily crawler remains the catch-up path when
   this call cannot finish.

Claim publication never writes directly to Firestore and does not show the
account as verified before backend verification. The backend currently verifies
X claims only, so the dialog does not pretend to support YouTube claims.

By default, claims are published to three public relays already covered by the
directory crawler. A deployment can override them with up to five comma-separated
secure root relay URLs:

```sh
VITE_DIRECTORY_CLAIM_RELAYS=wss://relay.damus.io,wss://nos.lol npm run build:directory
```

The crawler/backfill must read at least one configured relay and run after the
claim is published. Publication is therefore not proof that verification has
completed. The Firestore-backed directory listing can replace `src/data.ts`
independently.

## Claim dialog checks

1. Open the dialog without a NIP-07 extension and confirm it gives an actionable
   error without asking for a secret key.
2. Connect an unlocked signer, confirm the displayed npub belongs to the active
   account, and check that the X composer text contains that exact npub.
3. Confirm a proof URL from a different handle is rejected before signing.
4. Paste a proof tweet URL from the matching handle, approve the kind `10011`
   event in the signer, and confirm at least one configured relay acknowledges it.
5. After the relay acknowledges the event, `ingestClaim` verifies that handle.
   A verified result can show the account without waiting for the daily crawler.
   A relay acknowledgement alone must never add a verified row. The crawler
   remains the retry path when that call does not finish.
