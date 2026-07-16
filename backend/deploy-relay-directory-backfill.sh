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

RELAYS="${RELAYS:-wss://purplepag.es,wss://relay.damus.io,wss://relay.primal.net,wss://relay.nostr.band}"
BACKFILL_TIMEOUT_MS="${BACKFILL_TIMEOUT_MS:-12000}"
BACKFILL_MAX_PAGES="${BACKFILL_MAX_PAGES:-20}"
BACKFILL_PAGE_LIMIT="${BACKFILL_PAGE_LIMIT:-250}"
BACKFILL_MAX_PAGE_LIMIT="${BACKFILL_MAX_PAGE_LIMIT:-1000}"
BACKFILL_SINCE="${BACKFILL_SINCE:-0}"
BACKFILL_STATE_PREFIX="${BACKFILL_STATE_PREFIX:-backfill}"
MAX_PENDING_CLAIMS="${MAX_PENDING_CLAIMS:-20}"
MAX_INACTIVE_VERIFIED_CLAIMS="${MAX_INACTIVE_VERIFIED_CLAIMS:-10}"
MAX_REJECTION_TOMBSTONES="${MAX_REJECTION_TOMBSTONES:-100}"
X_MENTION_CHECK_TIMEOUT_MS="${X_MENTION_CHECK_TIMEOUT_MS:-5000}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create relay-directory-crawler \
    --display-name="Relay Directory Crawler"
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

ENV_VARS="^@^GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@FIRESTORE_PROJECT=${PROJECT_ID}@RELAYS=${RELAYS}@BACKFILL_TIMEOUT_MS=${BACKFILL_TIMEOUT_MS}@BACKFILL_MAX_PAGES=${BACKFILL_MAX_PAGES}@BACKFILL_PAGE_LIMIT=${BACKFILL_PAGE_LIMIT}@BACKFILL_MAX_PAGE_LIMIT=${BACKFILL_MAX_PAGE_LIMIT}@BACKFILL_SINCE=${BACKFILL_SINCE}@BACKFILL_STATE_PREFIX=${BACKFILL_STATE_PREFIX}@MAX_PENDING_CLAIMS=${MAX_PENDING_CLAIMS}@MAX_INACTIVE_VERIFIED_CLAIMS=${MAX_INACTIVE_VERIFIED_CLAIMS}@MAX_REJECTION_TOMBSTONES=${MAX_REJECTION_TOMBSTONES}@X_MENTION_CHECK_TIMEOUT_MS=${X_MENTION_CHECK_TIMEOUT_MS}"

gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --set-env-vars "${ENV_VARS}" \
  --cpu 1 \
  --memory 512Mi \
  --max-retries 0 \
  --task-timeout 3600

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
