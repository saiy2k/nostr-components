#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gr-prod}"
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

gcloud run worker-pools deploy "${WORKER_POOL_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --instances "${INSTANCE_COUNT}" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_PROJECT=${PROJECT_ID},LIVE_FLUSH_LIMIT=${LIVE_FLUSH_LIMIT},LIVE_FLUSH_INTERVAL_MS=${LIVE_FLUSH_INTERVAL_MS},LIVE_HEARTBEAT_INTERVAL_MS=${LIVE_HEARTBEAT_INTERVAL_MS}" \
  --args "relay-directory/live-monitor.js,--firestore-project,${PROJECT_ID},--no-json"
