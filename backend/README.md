# Relay directory backend

The relay-directory crawler is isolated from the frontend package and reads its
runtime configuration from environment variables.

```sh
cd backend
npm install --package-lock=false
cp .env.example .env
# Set FIRESTORE_PROJECT and local Google credentials in your environment.
npm run backfill
```

Cloud Run deployment (PROJECT_ID is required):

```sh
PROJECT_ID=your-gcp-project backend/deploy-relay-directory-backfill.sh
```

Grant project-wide `roles/datastore.user` only when bootstrapping an isolated
crawler project (not a shared production project):

```sh
GRANT_DATASTORE_IAM=true PROJECT_ID=your-isolated-project \
  backend/deploy-relay-directory-backfill.sh
```

Prefer a dedicated GCP project or Firestore database for this job, and grant the
`relay-directory-crawler` service account least-privilege access to that database
only.

The backfill uses NDK subscriptions for relay transport while retaining the
explicit Firestore cursor and same-timestamp pagination algorithm.
