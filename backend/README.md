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

Cloud Run deployment:

```sh
backend/deploy-relay-directory-backfill.sh
```

The backfill uses NDK subscriptions for relay transport while retaining the
explicit Firestore cursor and same-timestamp pagination algorithm.
