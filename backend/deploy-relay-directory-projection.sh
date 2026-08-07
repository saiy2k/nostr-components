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
PROJECTION_TIMEOUT_MS="${PROJECTION_TIMEOUT_MS:-12000}"
PROJECTION_LIMIT="${PROJECTION_LIMIT:-1000}"
PROJECTION_EXTERNAL_RETRY_MS="${PROJECTION_EXTERNAL_RETRY_MS:-900000}"
PROJECTION_RUN_DEADLINE_MS="${PROJECTION_RUN_DEADLINE_MS:-3300000}"
MAX_PROOFS="${MAX_PROOFS:-250}"
VERIFY_TWEETS="${VERIFY_TWEETS:-1}"
CHECK_ZAPS="${CHECK_ZAPS:-1}"
X_PROFILE_MAX="${X_PROFILE_MAX:-100}"
MAX_PENDING_CLAIMS="${MAX_PENDING_CLAIMS:-20}"
MAX_INACTIVE_VERIFIED_CLAIMS="${MAX_INACTIVE_VERIFIED_CLAIMS:-10}"
MAX_REJECTION_TOMBSTONES="${MAX_REJECTION_TOMBSTONES:-100}"
MAX_RETRY_ATTEMPTS="${MAX_RETRY_ATTEMPTS:-5}"
X_BEARER_TOKEN_SECRET="${X_BEARER_TOKEN_SECRET:-}"

if [ -z "${X_BEARER_TOKEN_SECRET}" ]; then
  EXISTING_JOB_JSON="$(
    gcloud run jobs describe "${JOB_NAME}" \
      --project "${PROJECT_ID}" \
      --region "${REGION}" \
      --format json 2>/dev/null || true
  )"
  if [[ "${EXISTING_JOB_JSON}" == *X_BEARER_TOKEN* ]]; then
    echo "Existing ${JOB_NAME} has an X_BEARER_TOKEN binding." >&2
    echo "Set X_BEARER_TOKEN_SECRET explicitly before redeploying." >&2
    exit 1
  fi
fi

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

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

ENV_VARS="^@^GOOGLE_CLOUD_PROJECT=${PROJECT_ID}@FIRESTORE_PROJECT=${PROJECT_ID}@PROJECTION_TIMEOUT_MS=${PROJECTION_TIMEOUT_MS}@PROJECTION_LIMIT=${PROJECTION_LIMIT}@PROJECTION_EXTERNAL_RETRY_MS=${PROJECTION_EXTERNAL_RETRY_MS}@PROJECTION_RUN_DEADLINE_MS=${PROJECTION_RUN_DEADLINE_MS}@MAX_PROOFS=${MAX_PROOFS}@VERIFY_TWEETS=${VERIFY_TWEETS}@CHECK_ZAPS=${CHECK_ZAPS}@X_PROFILE_MAX=${X_PROFILE_MAX}@MAX_PENDING_CLAIMS=${MAX_PENDING_CLAIMS}@MAX_INACTIVE_VERIFIED_CLAIMS=${MAX_INACTIVE_VERIFIED_CLAIMS}@MAX_REJECTION_TOMBSTONES=${MAX_REJECTION_TOMBSTONES}@MAX_RETRY_ATTEMPTS=${MAX_RETRY_ATTEMPTS}"

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

if [ -n "${X_BEARER_TOKEN_SECRET}" ]; then
  DEPLOY_ARGS+=(--set-secrets "X_BEARER_TOKEN=${X_BEARER_TOKEN_SECRET}:latest")
fi

gcloud run jobs deploy "${DEPLOY_ARGS[@]}"

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
