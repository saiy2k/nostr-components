# Nostr Atlas crawler

Cloud Run jobs for backfill, projection, and the URL activity sweep. This package is separate from the repo-root install.

- From `backend/`: `npm ci`, then `npm test`.
- Run projection after backfill. Backfill writes handle documents; projection consumes them.
- Deploy with `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-backfill.sh`, `PROJECT_ID=nostr-components backend/deploy-nostr-atlas-projection.sh`, and `PROJECT_ID=nostr-components backend/deploy-nostr-pulse-sweep.sh` from the repo root.
- The pulse sweep runs every 10 minutes as Cloud Run job `nostr-pulse-sweep`. It reads the rendezvous relays plus `sweepExtra` and writes `nostrUrlActivity` (with `reactions` and `recipients`), `nostrUrlZaps`, and `nostrPulseSweepState`. Ingest keeps each pubkey's newest web reaction and counts a zap receipt only after the NIP-57 check. Repeats are no-ops. Reaction documents store `pubkey`. Each sweep also copies that field from the document id onto reactions that were stored without it, one page at a time, until that pass is done. A provider check that is still failing on the third try is left unstored so one address cannot stall the job. A second that does not fit in one page is stored on that cursor as `lastGap`. A sweep writes a cursor only when its stored revision still matches the one it read, so an overlapping run cannot roll that cursor back. Deploy the sweep only when asked.
- `nostr-pulse/import-web-pulse.js` is a local one-time import, not a Cloud Run job. It only reads document ids from `Nostr_reactions` and `Nostr_zaps` in project `sat-the-standard`. It does not read `Nostr_urls`, `Nostr_domains`, or `Nostr_syncState`, and it never writes to `sat-the-standard`. A dry run is the default and writes nothing, including profiles. `--write` sends events it still finds on relays through `ingestUrlEvent` into project `nostr-components`.
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
