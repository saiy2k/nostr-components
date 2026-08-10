# Relay directory backend

The relay-directory backfill and projection jobs are isolated from the frontend
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
PROJECT_ID=your-gcp-project backend/deploy-relay-directory-backfill.sh
PROJECT_ID=your-gcp-project backend/deploy-relay-directory-projection.sh
```

By default the deploy script also creates a Cloud Scheduler job
(`relay-directory-backfill-daily`) that triggers the Cloud Run Job once per day
at 06:00 UTC (`0 6 * * *`). Each run resumes Firestore cursors and processes up
to `BACKFILL_MAX_PAGES` pages per relay/kind.

Schedule knobs:

```sh
# Custom cadence (unix-cron) and timezone
SCHEDULE="0 3 * * *" SCHEDULE_TIME_ZONE="Asia/Kolkata" \
  PROJECT_ID=your-gcp-project backend/deploy-relay-directory-backfill.sh

# Deploy the job image only (no scheduler)
CREATE_SCHEDULER=false PROJECT_ID=your-gcp-project \
  backend/deploy-relay-directory-backfill.sh

# Execute once immediately after deploy
RUN_AFTER_DEPLOY=true PROJECT_ID=your-gcp-project \
  backend/deploy-relay-directory-backfill.sh
```

Grant project-wide `roles/datastore.user` only when bootstrapping an isolated
crawler project (not a shared production project):

```sh
GRANT_DATASTORE_IAM=true PROJECT_ID=your-isolated-project \
  backend/deploy-relay-directory-backfill.sh
```

Prefer a dedicated GCP project or Firestore database for this job, and grant the
`relay-directory-crawler` service account least-privilege access to that database
only. The scheduler uses a separate `relay-directory-scheduler` service account
with `roles/run.invoker` on the Cloud Run Job.

Relay connections and subscriptions use NDK. The jobs retain explicit event
validation, pagination, deduplication, Firestore writes, and checkpoint logic.

Run projection after backfill because it consumes the handle documents created
by backfill. `deploy-relay-directory-projection.sh` creates an unscheduled job;
execute it manually, or set `RUN_AFTER_DEPLOY=true` to run it once immediately.
X bio scans and NIP-39 proof-tweet checks both use FxTwitter's public API
(`api.fxtwitter.com`); no X bearer token is required. Projection limits and
timeouts are passed to Cloud Run as environment variables.

The projector orders due work in Firestore before applying its read limit. For
the default handles collection, create the required composite index once per
database:

```sh
gcloud firestore indexes composite create \
  --project=your-gcp-project \
  --database='(default)' \
  --collection-group=nostrDirectoryHandles \
  --field-config=field-path=pendingClaimCount,order=ascending \
  --field-config=field-path=nextAttemptAt,order=ascending
```

Use the configured `FIRESTORE_HANDLES_COLLECTION` and `FIRESTORE_DATABASE`
values when they differ from the defaults.
