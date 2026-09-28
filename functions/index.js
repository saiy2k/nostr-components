// SPDX-License-Identifier: MIT

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { lookupAtlasHandle as lookupAtlasRecord } from "./lookup.js";
import { createAtlasListHandler } from "./profiles.js";
import { createClaimProofHandler } from "./claim-proof.js";
import { createIngestClaimHandler, defaultIngestDb } from "./ingest-claim.js";

initializeApp();
const db = getFirestore();

async function handleDirectoryLookup(request, response) {
  if (request.method !== "GET") {
    response.set("Allow", "GET");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (request.query.platform && request.query.platform !== "twitter") {
    response.status(400).json({ error: "unsupported_platform" });
    return;
  }

  try {
    const result = await lookupAtlasRecord(db, request.query.handle);
    response.set("Cache-Control", "public, max-age=300, s-maxage=300");
    response.status(result.status).json(result.body);
  } catch (error) {
    console.error("Atlas lookup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    response.status(503).json({ error: "directory_unavailable" });
  }
}

export const lookupAtlasHandle = onRequest(
  {
    region: "us-central1",
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 10,
  },
  handleDirectoryLookup,
);

const ingestProjectId =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

export const ingestClaim = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    maxInstances: 5,
    timeoutSeconds: 60,
    ...(ingestProjectId
      ? {
          serviceAccount: `nostr-atlas-crawler@${ingestProjectId}.iam.gserviceaccount.com`,
        }
      : {}),
  },
  createIngestClaimHandler({ createDb: defaultIngestDb }),
);

export const checkClaimProof = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 15,
  },
  createClaimProofHandler(),
);

export const listAtlasProfiles = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 10,
  },
  createAtlasListHandler(
    getFirestore(process.env.FIRESTORE_DATABASE || "(default)"),
    {
      collection:
        process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
    },
  ),
);
