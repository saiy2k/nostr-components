#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${PROJECT_ID:-}" ]; then
  echo "PROJECT_ID is required." >&2
  echo "Example: PROJECT_ID=gr-prod ./deploy-relay-directory-projection.sh" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-relay-directory-projector}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-relay-directory-crawler}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:${IMAGE_TAG}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"

# Cloud Scheduler → Cloud Run Job (daily projection after backfill by default).
CREATE_SCHEDULER="${CREATE_SCHEDULER:-true}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-relay-directory-projection-daily}"
SCHEDULER_REGION="${SCHEDULER_REGION:-${REGION}}"
SCHEDULE="${SCHEDULE:-0 7 * * *}"
SCHEDULE_TIME_ZONE="${SCHEDULE_TIME_ZONE:-Etc/UTC}"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT:-relay-directory-scheduler@${PROJECT_ID}.iam.gserviceaccount.com}"

FIRESTORE_DATABASE="${FIRESTORE_DATABASE:-(default)}"
FIRESTORE_HANDLES_COLLECTION="${FIRESTORE_HANDLES_COLLECTION:-nostrDirectoryHandles}"
FIRESTORE_ENTRIES_COLLECTION="${FIRESTORE_ENTRIES_COLLECTION:-nostrDirectoryEntries}"
FIRESTORE_PROJECTION_RUNS_COLLECTION="${FIRESTORE_PROJECTION_RUNS_COLLECTION:-relayProjectionRuns}"
PROJECTION_TIMEOUT_MS="${PROJECTION_TIMEOUT_MS:-12000}"
PROJECTION_LIMIT="${PROJECTION_LIMIT:-100}"
PROJECTION_EXTERNAL_RETRY_MS="${PROJECTION_EXTERNAL_RETRY_MS:-900000}"
PROJECTION_RUN_DEADLINE_MS="${PROJECTION_RUN_DEADLINE_MS:-3300000}"
MAX_PROOFS="${MAX_PROOFS:-250}"
VERIFY_TWEETS="${VERIFY_TWEETS:-1}"
CHECK_ZAPS="${CHECK_ZAPS:-1}"
MAX_PENDING_CLAIMS="${MAX_PENDING_CLAIMS:-20}"
MAX_INACTIVE_VERIFIED_CLAIMS="${MAX_INACTIVE_VERIFIED_CLAIMS:-10}"
MAX_REJECTION_TOMBSTONES="${MAX_REJECTION_TOMBSTONES:-100}"
MAX_RETRY_ATTEMPTS="${MAX_RETRY_ATTEMPTS:-5}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  SERVICE_ACCOUNT_ID="${SERVICE_ACCOUNT%%@*}"
  SERVICE_ACCOUNT_DOMAIN="${SERVICE_ACCOUNT#*@}"
  if [ "${SERVICE_ACCOUNT_DOMAIN}" != "${PROJECT_ID}.iam.gserviceaccount.com" ]; then
    echo "SERVICE_ACCOUNT ${SERVICE_ACCOUNT} does not exist and is not in ${PROJECT_ID}." >&2
    exit 1
  fi
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_ID}" \
    --display-name="Relay Directory Crawler"
fi

if [ "${CREATE_SCHEDULER}" = "true" ]; then
  SCHEDULER_SA_ID="${SCHEDULER_SERVICE_ACCOUNT%%@*}"
  if ! gcloud iam service-accounts describe "${SCHEDULER_SERVICE_ACCOUNT}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${SCHEDULER_SA_ID}" \
      --display-name="Relay Directory Scheduler"
  fi
fi

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

ENV_VARS="^@^GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@FIRESTORE_PROJECT=${PROJECT_ID}@FIRESTORE_DATABASE=${FIRESTORE_DATABASE}@FIRESTORE_HANDLES_COLLECTION=${FIRESTORE_HANDLES_COLLECTION}@FIRESTORE_ENTRIES_COLLECTION=${FIRESTORE_ENTRIES_COLLECTION}@FIRESTORE_PROJECTION_RUNS_COLLECTION=${FIRESTORE_PROJECTION_RUNS_COLLECTION}@PROJECTION_TIMEOUT_MS=${PROJECTION_TIMEOUT_MS}@PROJECTION_LIMIT=${PROJECTION_LIMIT}@PROJECTION_EXTERNAL_RETRY_MS=${PROJECTION_EXTERNAL_RETRY_MS}@PROJECTION_RUN_DEADLINE_MS=${PROJECTION_RUN_DEADLINE_MS}@MAX_PROOFS=${MAX_PROOFS}@VERIFY_TWEETS=${VERIFY_TWEETS}@CHECK_ZAPS=${CHECK_ZAPS}@MAX_PENDING_CLAIMS=${MAX_PENDING_CLAIMS}@MAX_INACTIVE_VERIFIED_CLAIMS=${MAX_INACTIVE_VERIFIED_CLAIMS}@MAX_REJECTION_TOMBSTONES=${MAX_REJECTION_TOMBSTONES}@MAX_RETRY_ATTEMPTS=${MAX_RETRY_ATTEMPTS}"

DEPLOY_ARGS=(
  "${JOB_NAME}"
  --image "${IMAGE}"
  --region "${REGION}"
  --service-account "${SERVICE_ACCOUNT}"
  --set-env-vars "${ENV_VARS}"
  --args "relay-directory/projection.js"
  --max-retries 0
  --task-timeout 3600
)

gcloud run jobs deploy "${DEPLOY_ARGS[@]}"

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
