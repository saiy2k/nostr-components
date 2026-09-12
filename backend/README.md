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
X bio scans, NIP-39 proof-tweet checks, and backfill `@mention` existence
checks all use FxTwitter's public API (`api.fxtwitter.com`); no X bearer token
is required. Projection limits and timeouts are passed to Cloud Run as
environment variables.

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

## Web of Trust

Identifier validation — NIP-39 proof tweets and X bio `npub` / `nprofile` /
NIP-05 scanning — only proves that an X profile and a Nostr profile point at
each other. It cannot tell an honest pair from a scammer who controls both
halves of their own link, and proof tweets are scarce enough that they cannot
carry the trust decision alone. `relay-directory/web-of-trust.js` scores the
pair separately, after identifier validation has already passed. It never
promotes a claim that failed validation; it can only withhold trust.

### Inputs

| Side | Signals |
| --- | --- |
| X profile | account age, follower / following / tweet counts, follow ratio, bio text, handle and display name |
| Nostr profile | kind-0 `name`, `about`, `nip05`, `lud16`, `website` |
| Linkage | X bio links the pubkey, Nostr profile links the handle, NIP-39 proof tweet verified |

X signals come from the FxTwitter profile already fetched during the bio scan,
so scoring adds no extra network requests.

### Scoring

Each rule contributes a fixed weight from `WOT_SIGNAL_WEIGHTS`. Trust signals
(mutual link, proof tweet, established account, real follower base, NIP-05 and
Lightning address) add; risk signals (brand-new account, negligible followers
or activity, empty Nostr profile) subtract; scam signals (scam phrasing in
either bio, support/giveaway impersonation names, mass-follow ratio) subtract
the most. Rules run in a fixed order over deterministic inputs, so the same
profiles always produce the same score and the same reason list. Repeated scam
phrases are capped so one keyword-stuffed bio cannot dominate the score.

### Decisions

| Outcome | Rule |
| --- | --- |
| `unavailable` | The X profile could not be read, so nothing is assessable. |
| `rejected` | Both profiles emit a scam signal, or score ≤ `WOT_REJECT_SCORE`. |
| `accepted` | score ≥ `WOT_ACCEPT_SCORE`. |
| `ambiguous` | Assessable, but between the two thresholds. |

The "both profiles emit a scam signal" rule is the case this exists for: a
scam X account linked to a scam Nostr account is rejected on the evidence of
the pair, regardless of the numeric score.

### Failure behavior

The evaluation performs no I/O and never throws. Missing or unparseable fields
withhold their signals, which pushes the outcome toward `ambiguous` or
`unavailable` rather than a false `accepted` or `rejected`. A failed X profile
fetch therefore leaves the identity verified and unscored rather than
rejecting it.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `WOT_MODE` | `flag` | `off` skips scoring; `flag` records the outcome; `enforce` also rejects a `rejected` pair. |
| `WOT_ACCEPT_SCORE` | `3` | Score at or above which a pair is accepted. |
| `WOT_REJECT_SCORE` | `-3` | Score at or below which a pair is rejected. Must be below `WOT_ACCEPT_SCORE`. |

Claims and directory entries carry `trustStatus`, `trustScore`,
`trustReasons` and `trustEvaluatedAt`. In every mode except `off`, a
`rejected` pair loses `autoZapAllowed` and its entry is written with
`directoryStatus: "verified_untrusted"`, so a flagged scam pair can never be
zapped automatically even while `WOT_MODE=flag` keeps it in the directory for
review. Run summaries report `trustOutcomes` and `trustEnforcedRejections`.
