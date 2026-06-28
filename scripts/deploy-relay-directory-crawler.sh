#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gr-prod}"
REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-relay-directory-projector}"
SCHEDULE_NAME="${SCHEDULE_NAME:-relay-directory-projector-hourly}"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}:latest"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"
SCAN_X_PROFILES="${SCAN_X_PROFILES:-0}"
X_PROFILE_MAX="${X_PROFILE_MAX:-100}"
X_BEARER_TOKEN_SECRET="${X_BEARER_TOKEN_SECRET:-}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create relay-directory-crawler \
    --display-name="Relay Directory Crawler"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.developer" \
  --condition=None >/dev/null

gcloud builds submit \
  --config cloudbuild.relay-directory-crawler.yaml \
  --substitutions "_IMAGE=${IMAGE}" .

DEPLOY_ARGS=(
  "${JOB_NAME}"
  --image "${IMAGE}"
  --region "${REGION}"
  --service-account "${SERVICE_ACCOUNT}"
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_PROJECT=${PROJECT_ID},SCAN_X_PROFILES=${SCAN_X_PROFILES},X_PROFILE_MAX=${X_PROFILE_MAX}"
  --args "scripts/relay-directory/projection.mjs,--firestore-project,${PROJECT_ID},--no-json"
  --max-retries 1
  --task-timeout 1800
)

if [ -n "${X_BEARER_TOKEN_SECRET}" ]; then
  DEPLOY_ARGS+=(--set-secrets "X_BEARER_TOKEN=${X_BEARER_TOKEN_SECRET}:latest")
fi

gcloud run jobs deploy "${DEPLOY_ARGS[@]}"

gcloud scheduler jobs create http "${SCHEDULE_NAME}" \
  --location "${REGION}" \
  --schedule "0 * * * *" \
  --uri "https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run" \
  --http-method POST \
  --oauth-service-account-email "${SERVICE_ACCOUNT}" \
  --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
  --attempt-deadline 1800s || \
gcloud scheduler jobs update http "${SCHEDULE_NAME}" \
  --location "${REGION}" \
  --schedule "0 * * * *" \
  --uri "https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run" \
  --http-method POST \
  --oauth-service-account-email "${SERVICE_ACCOUNT}" \
  --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
  --attempt-deadline 1800s

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
