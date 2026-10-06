#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"

if [ -z "${PROJECT_ID:-}" ]; then
  echo "PROJECT_ID is required." >&2
  echo "Example: PROJECT_ID=nostr-components ./deploy-nostr-pulse-sweep.sh" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-nostr-pulse-sweep}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-nostr-atlas-crawler}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:${IMAGE_TAG}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-nostr-atlas-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"
CREATE_SCHEDULER="${CREATE_SCHEDULER:-true}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-nostr-pulse-sweep-every-10-min}"
SCHEDULER_REGION="${SCHEDULER_REGION:-${REGION}}"
SCHEDULE="${SCHEDULE:-*/10 * * * *}"
SCHEDULE_TIME_ZONE="${SCHEDULE_TIME_ZONE:-Etc/UTC}"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT:-nostr-atlas-scheduler@${PROJECT_ID}.iam.gserviceaccount.com}"
FIRESTORE_DATABASE="${FIRESTORE_DATABASE:-(default)}"
SWEEP_MAX_PAGES="${SWEEP_MAX_PAGES:-4}"
SWEEP_PAGE_LIMIT="${SWEEP_PAGE_LIMIT:-500}"
SWEEP_MAX_PAGE_LIMIT="${SWEEP_MAX_PAGE_LIMIT:-2000}"
SWEEP_TIMEOUT_MS="${SWEEP_TIMEOUT_MS:-12000}"

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
    --display-name="Nostr Atlas Crawler"
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
  "${REPOSITORY_ROOT}"

ENV_VARS="^@^GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@FIRESTORE_PROJECT=${PROJECT_ID}@FIRESTORE_DATABASE=${FIRESTORE_DATABASE}@SWEEP_MAX_PAGES=${SWEEP_MAX_PAGES}@SWEEP_PAGE_LIMIT=${SWEEP_PAGE_LIMIT}@SWEEP_MAX_PAGE_LIMIT=${SWEEP_MAX_PAGE_LIMIT}@SWEEP_TIMEOUT_MS=${SWEEP_TIMEOUT_MS}"

gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --set-env-vars "${ENV_VARS}" \
  --args "nostr-pulse/sweep.js" \
  --max-retries 0 \
  --task-timeout 1800

if [ "${CREATE_SCHEDULER}" = "true" ]; then
  if ! gcloud iam service-accounts describe "${SCHEDULER_SERVICE_ACCOUNT}" >/dev/null 2>&1; then
    SCHEDULER_SA_ID="${SCHEDULER_SERVICE_ACCOUNT%%@*}"
    SCHEDULER_SA_DOMAIN="${SCHEDULER_SERVICE_ACCOUNT#*@}"
    if [ "${SCHEDULER_SA_DOMAIN}" != "${PROJECT_ID}.iam.gserviceaccount.com" ]; then
      echo "SCHEDULER_SERVICE_ACCOUNT ${SCHEDULER_SERVICE_ACCOUNT} does not exist and is not in ${PROJECT_ID}." >&2
      exit 1
    fi
    gcloud iam service-accounts create "${SCHEDULER_SA_ID}" \
      --display-name="Nostr Atlas Scheduler"
  fi

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
    --description="Triggers ${JOB_NAME} Cloud Run Job every 10 minutes"
  )

  if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
    --location="${SCHEDULER_REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" "${SCHEDULER_ARGS[@]}"
    echo "Updated Cloud Scheduler job ${SCHEDULER_JOB_NAME} (${SCHEDULE} ${SCHEDULE_TIME_ZONE})."
  else
    gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" "${SCHEDULER_ARGS[@]}"
    echo "Created Cloud Scheduler job ${SCHEDULER_JOB_NAME} (${SCHEDULE} ${SCHEDULE_TIME_ZONE})."
  fi
fi

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
