# Nostr Atlas backend

The Nostr Atlas backfill and projection jobs are isolated from the frontend
package. They own their dependencies and read runtime configuration from
environment variables.

Relay URLs default to the ranked list in `relays.json`. Set `RELAYS` (comma-
separated) or `RELAYS_FILE` to override.

```sh
cd backend
npm ci
cp .env.example .env
# Set FIRESTORE_PROJECT and local Google credentials in your environment.
npm test
npm run backfill
npm run project
```

Cloud Run deployment scripts (PROJECT_ID is required):

```sh
cd "$(git rev-parse --show-toplevel)"
PROJECT_ID=nostr-components backend/deploy-nostr-atlas-backfill.sh
PROJECT_ID=nostr-components backend/deploy-nostr-atlas-projection.sh
```

By default the deploy script also creates a Cloud Scheduler job
(`nostr-atlas-backfill-daily`) that triggers the Cloud Run Job once per day
at 06:00 UTC (`0 6 * * *`). Each run resumes Firestore cursors and processes up
to `BACKFILL_MAX_PAGES` pages per relay/kind.

Schedule knobs:

```sh
# Custom cadence (unix-cron) and timezone
SCHEDULE="0 3 * * *" SCHEDULE_TIME_ZONE="Asia/Kolkata" \
  PROJECT_ID=nostr-components backend/deploy-nostr-atlas-backfill.sh

# Deploy the job image only (no scheduler)
CREATE_SCHEDULER=false PROJECT_ID=nostr-components \
  backend/deploy-nostr-atlas-backfill.sh

# Execute once immediately after deploy
RUN_AFTER_DEPLOY=true PROJECT_ID=nostr-components \
  backend/deploy-nostr-atlas-backfill.sh
```

Grant project-wide `roles/datastore.user` only when bootstrapping an isolated
crawler project (not a shared production project):

```sh
GRANT_DATASTORE_IAM=true PROJECT_ID=nostr-components \
  backend/deploy-nostr-atlas-backfill.sh
```

Prefer a dedicated GCP project or Firestore database for this job, and grant the
`nostr-atlas-crawler` service account least-privilege access to that database
only. The scheduler uses a separate `nostr-atlas-scheduler` service account
with `roles/run.invoker` on the Cloud Run Job.

Relay connections use NDK. Every relay socket goes through `PublicWebSocket`
in `nostr-atlas/public-network.js`, which resolves the host and refuses a
private address before connecting. The jobs retain explicit event validation,
pagination, deduplication, Firestore writes, and checkpoint logic.

Run projection after backfill because it consumes the handle documents created
by backfill. `deploy-nostr-atlas-projection.sh` schedules
`nostr-atlas-projection-daily` at 08:00 UTC, two hours after the backfill.
Set `CREATE_SCHEDULER=false` to deploy the job without that schedule, or
`RUN_AFTER_DEPLOY=true` to execute it once immediately.
X bio scans, NIP-39 proof-tweet checks, and backfill `@mention` existence
checks all use FxTwitter's public API (`api.fxtwitter.com`); no X bearer token
is required. Projection limits and timeouts are passed to Cloud Run as
environment variables.

The projector orders due work in Firestore before applying its read limit. For
the default handles collection, create the required composite index once per
database:

```sh
gcloud firestore indexes composite create \
  --project=nostr-components \
  --database='(default)' \
  --collection-group=nostrDirectoryHandles \
  --field-config=field-path=pendingClaimCount,order=ascending \
  --field-config=field-path=nextAttemptAt,order=ascending
```

Use the configured `FIRESTORE_HANDLES_COLLECTION` and `FIRESTORE_DATABASE`
values when they differ from the defaults.

`nostr-pulse/import-web-pulse.js` copies historical URL reactions and zap receipts
into this project. It only reads `Nostr_reactions` and `Nostr_zaps` in
`sat-the-standard`. The default run is a dry run and writes nothing. Pass
`--write` to store the events it still finds on relays into `nostr-components`
through the URL ingest. Do not point it at any other project, and do not
write to `sat-the-standard`.

```sh
cd backend
node --env-file-if-exists=.env nostr-pulse/import-web-pulse.js
node --env-file-if-exists=.env nostr-pulse/import-web-pulse.js --write
```

Client Firestore rules for this database live in `backend/firestore.rules`.
Nostr Atlas, the browser extension, and Storybook never read these collections
directly. Deploy the rules only to the new directory project (`nostr-components`):

```sh
firebase deploy --only firestore:rules --project nostr-components \
  --config backend/firebase.json
```

Do not deploy this rules file to `sat-the-standard`. A full `firebase deploy`
from the repository root does not include it. If `FIRESTORE_*_COLLECTION`
overrides rename a collection, add that name to the rules before using it.
