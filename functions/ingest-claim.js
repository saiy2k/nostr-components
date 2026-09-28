// SPDX-License-Identifier: MIT

const MAX_BODY_BYTES = 64 * 1024;

async function loadIngest() {
  try {
    return await import("./nostr-atlas/ingest-claim.js");
  } catch (packagedError) {
    try {
      return await import("../backend/nostr-atlas/ingest-claim.js");
    } catch (fallbackError) {
      throw new Error(
        `Could not load the claim ingest module. Packaged copy: ${errorText(packagedError)}. Repo fallback: ${errorText(fallbackError)}`,
      );
    }
  }
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
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
        { event: body.event, relay: body.relay, handle: body.handle },
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

let ingestDbPromise;
export async function defaultIngestDb() {
  ingestDbPromise ??= loadRuntime().then(
    ({ createFirestore, firestoreConfigFromEnv }) =>
      createFirestore(firestoreConfigFromEnv()),
  );
  try {
    return await ingestDbPromise;
  } catch (error) {
    ingestDbPromise = undefined;
    throw error;
  }
}

async function loadRuntime() {
  try {
    return await import("./nostr-atlas/runtime.js");
  } catch (packagedError) {
    try {
      return await import("../backend/nostr-atlas/runtime.js");
    } catch (fallbackError) {
      throw new Error(
        `Could not load the claim ingest runtime. Packaged copy: ${errorText(packagedError)}. Repo fallback: ${errorText(fallbackError)}`,
      );
    }
  }
}
