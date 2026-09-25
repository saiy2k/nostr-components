# Nostr Atlas directory site

Nostr Atlas is a self-contained Vite + TypeScript concept for creator account
claims. It is designed to connect the X and YouTube accounts an audience already
knows to a creator's Nostr identity, making that identity easier to find and zap
from compatible Nostr clients. It intentionally lives beside the existing
component library so the package build and backend jobs remain unchanged.

## Run locally

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

The current profile list is local demo data. Search, categories, sorting, copy
feedback, and responsive navigation are functional. The claim dialog publishes a
real X-account claim through the existing relay-directory protocol:

1. The user connects a NIP-07 browser signer. No private key is requested or
   stored by the site.
2. The dialog shows the signer's npub and opens an X composer with proof text.
3. The user pastes the proof tweet URL. The author in the URL must match the
   claimed X handle.
4. The signer signs a kind `10011` NIP-39 event with an `i` tag containing the X
   handle and proof URL. The site validates the returned signature and exact
   event fields before publishing it.
5. At least one configured Nostr relay must acknowledge the event. The existing
   backend later discovers the event and independently checks the proof tweet
   before promoting the identity.

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
5. Run the directory crawler/backfill and confirm its independent proof check
   promotes the claim before the account appears as verified. A relay
   acknowledgement alone must never add a verified row.
