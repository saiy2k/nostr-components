#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${PROJECT_ID:-}" ]; then
  echo "PROJECT_ID is required." >&2
  echo "Example: PROJECT_ID=gr-prod ./deploy-relay-directory-backfill.sh" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-relay-directory-backfill}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-relay-directory-crawler}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:${IMAGE_TAG}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"

# Cloud Scheduler → Cloud Run Job (resumable daily backfill by default).
CREATE_SCHEDULER="${CREATE_SCHEDULER:-true}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-relay-directory-backfill-daily}"
SCHEDULER_REGION="${SCHEDULER_REGION:-${REGION}}"
SCHEDULE="${SCHEDULE:-0 6 * * *}"
SCHEDULE_TIME_ZONE="${SCHEDULE_TIME_ZONE:-Etc/UTC}"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT:-relay-directory-scheduler@${PROJECT_ID}.iam.gserviceaccount.com}"

# Relays default to backend/relays.json baked into the image.
# Set RELAYS=wss://... only to override that file at deploy time.
BACKFILL_TIMEOUT_MS="${BACKFILL_TIMEOUT_MS:-12000}"
BACKFILL_MAX_PAGES="${BACKFILL_MAX_PAGES:-5}"
BACKFILL_PAGE_LIMIT="${BACKFILL_PAGE_LIMIT:-250}"
BACKFILL_MAX_PAGE_LIMIT="${BACKFILL_MAX_PAGE_LIMIT:-1000}"
BACKFILL_SINCE="${BACKFILL_SINCE:-0}"
BACKFILL_STATE_PREFIX="${BACKFILL_STATE_PREFIX:-backfill}"
MAX_PENDING_CLAIMS="${MAX_PENDING_CLAIMS:-20}"
MAX_INACTIVE_VERIFIED_CLAIMS="${MAX_INACTIVE_VERIFIED_CLAIMS:-10}"
MAX_REJECTION_TOMBSTONES="${MAX_REJECTION_TOMBSTONES:-100}"
X_MENTION_CHECK_TIMEOUT_MS="${X_MENTION_CHECK_TIMEOUT_MS:-5000}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create relay-directory-crawler \
    --display-name="Relay Directory Crawler"
fi

if [ "${CREATE_SCHEDULER}" = "true" ]; then
  SCHEDULER_SA_ID="${SCHEDULER_SERVICE_ACCOUNT%%@*}"
  if ! gcloud iam service-accounts describe "${SCHEDULER_SERVICE_ACCOUNT}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${SCHEDULER_SA_ID}" \
      --display-name="Relay Directory Backfill Scheduler"
  fi
fi

# Do not silently grant project-wide Datastore access on every deploy.
# Prefer a dedicated GCP project/Firestore database for this crawler.
# Opt in only for bootstrap of an isolated project:
#   GRANT_DATASTORE_IAM=true PROJECT_ID=... ./deploy-relay-directory-backfill.sh
if [ "${GRANT_DATASTORE_IAM:-false}" = "true" ]; then
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.user" \
    --condition=None >/dev/null
else
  echo "Skipping IAM bind. Ensure ${SERVICE_ACCOUNT} can read/write the crawler Firestore database."
  echo "For an isolated bootstrap project only: GRANT_DATASTORE_IAM=true"
fi

gcloud builds submit \
  --config "${BACKEND_DIR}/cloudbuild.yaml" \
  --substitutions "_IMAGE=${IMAGE}" \
  "${BACKEND_DIR}"

ENV_VARS="^@^GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@FIRESTORE_PROJECT=${PROJECT_ID}@BACKFILL_TIMEOUT_MS=${BACKFILL_TIMEOUT_MS}@BACKFILL_MAX_PAGES=${BACKFILL_MAX_PAGES}@BACKFILL_PAGE_LIMIT=${BACKFILL_PAGE_LIMIT}@BACKFILL_MAX_PAGE_LIMIT=${BACKFILL_MAX_PAGE_LIMIT}@BACKFILL_SINCE=${BACKFILL_SINCE}@BACKFILL_STATE_PREFIX=${BACKFILL_STATE_PREFIX}@MAX_PENDING_CLAIMS=${MAX_PENDING_CLAIMS}@MAX_INACTIVE_VERIFIED_CLAIMS=${MAX_INACTIVE_VERIFIED_CLAIMS}@MAX_REJECTION_TOMBSTONES=${MAX_REJECTION_TOMBSTONES}@X_MENTION_CHECK_TIMEOUT_MS=${X_MENTION_CHECK_TIMEOUT_MS}"
if [ -n "${RELAYS:-}" ]; then
  ENV_VARS="${ENV_VARS}@RELAYS=${RELAYS}"
fi

gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --set-env-vars "${ENV_VARS}" \
  --cpu 1 \
  --memory 512Mi \
  --max-retries 0 \
  --task-timeout 3600

if [ "${CREATE_SCHEDULER}" = "true" ]; then
  gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
    --region "${REGION}" \
    --member="serviceAccount:${SCHEDULER_SERVICE_ACCOUNT}" \
    --role="roles/run.invoker" \
    --quiet >/dev/null

  SCHEDULER_URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"
  SCHEDULER_ARGS=(
    --location="${SCHEDULER_REGION}"
    --schedule="${SCHEDULE}"
    --time-zone="${SCHEDULE_TIME_ZONE}"
    --uri="${SCHEDULER_URI}"
    --http-method=POST
    --oauth-service-account-email="${SCHEDULER_SERVICE_ACCOUNT}"
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
    --description="Triggers ${JOB_NAME} Cloud Run Job on a schedule"
  )

  if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
    --location="${SCHEDULER_REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" "${SCHEDULER_ARGS[@]}"
    echo "Updated Cloud Scheduler job ${SCHEDULER_JOB_NAME} (${SCHEDULE} ${SCHEDULE_TIME_ZONE})."
  else
    gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" "${SCHEDULER_ARGS[@]}"
    echo "Created Cloud Scheduler job ${SCHEDULER_JOB_NAME} (${SCHEDULE} ${SCHEDULE_TIME_ZONE})."
  fi
else
  echo "Skipping Cloud Scheduler (CREATE_SCHEDULER=${CREATE_SCHEDULER})."
fi

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
