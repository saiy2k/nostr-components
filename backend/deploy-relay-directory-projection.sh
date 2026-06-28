#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gr-prod}"
REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-relay-directory-projector}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-relay-directory-crawler}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:latest"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"
PROJECTION_LIMIT="${PROJECTION_LIMIT:-1000}"
PROJECTION_WRITE_BUDGET="${PROJECTION_WRITE_BUDGET:-10000}"
MAX_PROOFS="${MAX_PROOFS:-250}"
SCAN_X_PROFILES="${SCAN_X_PROFILES:-0}"
X_PROFILE_MAX="${X_PROFILE_MAX:-100}"
MAX_PENDING_CLAIMS="${MAX_PENDING_CLAIMS:-20}"
MAX_INACTIVE_VERIFIED_CLAIMS="${MAX_INACTIVE_VERIFIED_CLAIMS:-10}"
MAX_REJECTION_TOMBSTONES="${MAX_REJECTION_TOMBSTONES:-100}"
X_BEARER_TOKEN_SECRET="${X_BEARER_TOKEN_SECRET:-}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create relay-directory-crawler \
    --display-name="Relay Directory Crawler"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

gcloud builds submit \
  --config backend/cloudbuild.yaml \
  --substitutions "_IMAGE=${IMAGE}" backend

DEPLOY_ARGS=(
  "${JOB_NAME}"
  --image "${IMAGE}"
  --region "${REGION}"
  --service-account "${SERVICE_ACCOUNT}"
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_PROJECT=${PROJECT_ID},SCAN_X_PROFILES=${SCAN_X_PROFILES},X_PROFILE_MAX=${X_PROFILE_MAX}"
  --args "relay-directory/projection.js,--firestore-project,${PROJECT_ID},--projection-limit,${PROJECTION_LIMIT},--projection-write-budget,${PROJECTION_WRITE_BUDGET},--max-proofs,${MAX_PROOFS},--max-pending-claims,${MAX_PENDING_CLAIMS},--max-inactive-verified-claims,${MAX_INACTIVE_VERIFIED_CLAIMS},--max-rejection-tombstones,${MAX_REJECTION_TOMBSTONES},--no-json"
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
