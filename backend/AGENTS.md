# Nostr Atlas crawler

Cloud Run jobs for backfill and projection. This package is separate from the repo-root install.

- From `backend/`: `npm ci`, then `npm test`.
- Run projection after backfill. Backfill writes handle documents; projection consumes them.
- Deploy with `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-backfill.sh` and `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-projection.sh` from the repo root.
- Client Firestore rules are [firestore.rules](firestore.rules), deployed only with:

```sh
firebase deploy --only firestore:rules --project nostr-components \
  --config backend/firebase.json
```

- Deploy those rules to `nostr-components` only. Leave `sat-the-standard` alone. A root `firebase deploy` does not include this file.
- Job behavior, scheduler, and IAM: [README.md](README.md).
- NDK is created only in `nostr-atlas/ingestion.js`. NDK and the claim pool open sockets through `PublicWebSocket`, which refuses a host that resolves to a private address.
- Projection stores signed kind 0 and kind 10002 profiles in `nostrProfiles`, including relay hints and the zap provider. New claim writes leave zap fields off the directory claim. `lookupAtlasHandle` reads `nostrProfiles.zap` when that document exists and the claim fields until then, so deploy that function with this crawler.
- Directory identities refresh every 24 hours. A verified handle with no `nostrProfiles` document is due immediately, including identities imported without a claim queue. The pass also stores `xPicture` when the signed profile has no picture.
- NIP-05 and X bio fetches go through `fetchPublicHttps`. Relay health is written once per run to `nostrRelayHealth`, keyed by the sha256 of the normalized relay URL.
- Profile refresh replaces `zap-pass.js`, `nip05-backfill.js`, `picture-backfill.js`, and `kind0-metadata-backfill.js`.
