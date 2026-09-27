// SPDX-License-Identifier: MIT

const MAX_BODY_BYTES = 64 * 1024;

async function loadIngest() {
  try {
    return await import("./relay-directory/ingest-claim.js");
  } catch {
    return await import("../backend/relay-directory/ingest-claim.js");
  }
}

export function createIngestClaimHandler(options = {}) {
  return async function handleIngestClaim(request, response) {
    if (request.method !== "POST") {
      response.set("Allow", "POST");
      response.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }
    const rawLength = request.rawBody?.length ?? 0;
    if (rawLength > MAX_BODY_BYTES) {
      response.status(413).json({ ok: false, error: "body-too-large" });
      return;
    }
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      response.status(400).json({ ok: false, error: "invalid-body" });
      return;
    }

    try {
      const ingest =
        options.ingestPublishedClaim ||
        (await loadIngest()).ingestPublishedClaim;
      const db = options.db || (await options.createDb());
      const result = await ingest(
        db,
        { event: body.event, relay: body.relay },
        options.config,
      );
      response.set("Cache-Control", "no-store");
      response.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      console.error("Claim ingest failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(503).json({ ok: false, error: "ingest-unavailable" });
    }
  };
}

export async function defaultIngestDb() {
  const { createFirestore, firestoreConfigFromEnv } = await loadRuntime();
  return createFirestore(firestoreConfigFromEnv());
}

async function loadRuntime() {
  try {
    return await import("./relay-directory/runtime.js");
  } catch {
    return await import("../backend/relay-directory/runtime.js");
  }
}
