#!/usr/bin/env bash
set -euo pipefail

if [ -z "${PROJECT_ID:-}" ]; then
  echo "PROJECT_ID is required." >&2
  echo "Example: PROJECT_ID=gr-prod ./deploy-relay-directory-live-listener.sh" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
WORKER_POOL_NAME="${WORKER_POOL_NAME:-relay-directory-live-listener}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-relay-directory-crawler}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:latest"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"
INSTANCE_COUNT="${INSTANCE_COUNT:-1}"
LIVE_FLUSH_LIMIT="${LIVE_FLUSH_LIMIT:-25}"
LIVE_FLUSH_INTERVAL_MS="${LIVE_FLUSH_INTERVAL_MS:-5000}"
LIVE_HEARTBEAT_INTERVAL_MS="${LIVE_HEARTBEAT_INTERVAL_MS:-30000}"

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
    --display-name="Relay Directory Crawler (${SERVICE_ACCOUNT_ID})"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

gcloud builds submit \
  --config backend/cloudbuild.yaml \
  --substitutions "_IMAGE=${IMAGE}" backend

gcloud run worker-pools deploy "${WORKER_POOL_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --instances "${INSTANCE_COUNT}" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_PROJECT=${PROJECT_ID},LIVE_FLUSH_LIMIT=${LIVE_FLUSH_LIMIT},LIVE_FLUSH_INTERVAL_MS=${LIVE_FLUSH_INTERVAL_MS},LIVE_HEARTBEAT_INTERVAL_MS=${LIVE_HEARTBEAT_INTERVAL_MS}" \
  --args "relay-directory/live-monitor.js,--firestore-project,${PROJECT_ID},--no-json"
