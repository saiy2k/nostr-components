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
