#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gr-prod}"
REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-relay-directory-backfill}"
IMAGE_JOB_NAME="${IMAGE_JOB_NAME:-relay-directory-crawler}"
IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_JOB_NAME}:latest"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-relay-directory-crawler@${PROJECT_ID}.iam.gserviceaccount.com}"
BACKFILL_MAX_PAGES="${BACKFILL_MAX_PAGES:-200}"
BACKFILL_PAGE_LIMIT="${BACKFILL_PAGE_LIMIT:-500}"
BACKFILL_MAX_PAGE_LIMIT="${BACKFILL_MAX_PAGE_LIMIT:-2000}"
BACKFILL_SINCE="${BACKFILL_SINCE:-0}"

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
  --config cloudbuild.relay-directory-crawler.yaml \
  --substitutions "_IMAGE=${IMAGE}" .

gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FIRESTORE_PROJECT=${PROJECT_ID}" \
  --args "scripts/relay-directory/backfill.mjs,--firestore-project,${PROJECT_ID},--backfill-max-pages,${BACKFILL_MAX_PAGES},--backfill-page-limit,${BACKFILL_PAGE_LIMIT},--backfill-max-page-limit,${BACKFILL_MAX_PAGE_LIMIT},--backfill-since,${BACKFILL_SINCE},--no-json" \
  --max-retries 1 \
  --task-timeout 3600

if [ "${RUN_AFTER_DEPLOY:-false}" = "true" ]; then
  gcloud run jobs execute "${JOB_NAME}" --region "${REGION}"
fi
