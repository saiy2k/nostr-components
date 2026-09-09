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

`VITE_DIRECTORY_API_URL` selects the endpoint. Without an override, the site uses
`https://us-central1-gr-prod.cloudfunctions.net/listDirectoryProfiles`, matching
the extension's directory project. **Deploy the new function before using that
production URL**, or use the local Functions emulator below.

The API reads up to 51 documents per default request (50 records plus one to
detect another page). `limit` accepts 1–100; `cursor` is the last scanned handle
document ID. The query uses `activeIdentity.status == verified`, ordered by
document ID, using Firestore's normal single-field index. If that field has been
exempted from indexing in your database, restore its ascending single-field index.
Successful responses may be cached for 60 seconds; errors are not cached.

Search and sorting apply to loaded records. The directory table includes
pagination controls with page navigation (Previous, Next, and numbered page
buttons) and customizable page sizes (10, 25, or 50 claims per page, defaulting
to 10). **Load more creator claims** fetches the next 50-record batch from Firestore,
expanding the paginated results; **Refresh** returns to the first page. Local previews
survive a refresh but disappear when the page is reloaded. API failures never display
sample data as real records.

The current crawler projection contains verified X identities. It does not supply
audience counts, YouTube claims, or Nostr popularity rankings: those fields show
`—`, and the Nostr tab explains its empty state. A verified mark means X account
ownership was verified by the projector; a NIP-05 address is profile metadata,
not a separate NIP-05 verification. The claim form still creates a **local preview**;
it does not write to Firestore, publish a claim, or verify ownership.

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
   confirm `listDirectoryProfiles?limit=50` returns HTTP 200 with `profiles` and
   `nextCursor`. The page should show real verified X records, or an honest empty
   state if the database has none. Loading should never briefly show demo rows.
2. Compare a returned `twitter:HANDLE` with the same document in Firestore:
   `activeIdentity.status` must be `verified`, the API `pubkey` must match the active
   key, and the displayed name/NIP-05 must match available metadata. Missing
   metadata falls back to the handle and `—`. The response must not contain
   `claims`, evidence, `lud16`, or retry state.
3. Search for a loaded handle, name, NIP-05, and copied npub. Check Name A–Z
   sorting, clear filters, copy a key and paste it, and open its Nostr profile.
   Audience counts should display `—`, without fabricated rankings.
4. Check the directory pagination bar: verify previous/next page navigation,
   direct page selection, and page-size switching (10, 25, 50). If `nextCursor` is
   non-null, click **Load more creator claims**. Confirm the next request includes
   that cursor, earlier rows remain, and no handle is duplicated. The pagination
   page count will update to reflect the newly loaded records. Continue until the
   button disappears. Search includes each newly loaded page; it does not search
   pages you have not loaded.
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
curl --fail-with-body 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles?limit=2'
# Expect 400 invalid_limit:
curl -i 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles?limit=101'
# Expect 405 method_not_allowed:
curl -i -X POST 'http://127.0.0.1:5001/gr-prod/us-central1/listDirectoryProfiles'
```

## Deploy the read API

The repository's default Firebase project is for Storybook. Always specify the
directory project and deploy only the new function:

```sh
firebase deploy --only functions:listDirectoryProfiles --project gr-prod
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
VITE_DIRECTORY_API_URL=https://us-central1-gr-prod.cloudfunctions.net/listDirectoryProfiles npm run build:directory
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
