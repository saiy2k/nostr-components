import type { Event } from "nostr-tools";
import { DEFAULT_DIRECTORY_API_URL } from "./api";
import {
  claimHandleIssue,
  connectClaimSigner,
  createClaimEvent,
  loadExistingClaimEvent,
  normalizeClaimHandle,
  parseClaimRelays,
  publishClaimToCoveredRelays,
  relaysCoveredBy,
  signClaimEvent,
  validateProofUrl,
  type NostrSigner,
} from "./claim";

export const CLAIM_COPY = {
  idle: "Connect a signer to begin.",
  connectFirst: "Connect your Nostr signer before publishing.",
  signerGone: "The connected Nostr signer is no longer available.",
  invalidHandle: "Enter an X handle of 1–15 letters, numbers, or underscores.",
  reservedHandle: "That X handle is reserved and cannot be claimed.",
  proofMismatch:
    "The proof tweet URL must belong to the X handle being claimed.",
  proofField: "Use a proof tweet URL posted by the same X handle.",
  proofMissingNpub: "The proof tweet does not contain the connected npub.",
  proofAuthor: "The proof tweet was not posted by that X handle.",
  proofUnreadable:
    "The proof tweet could not be read. Check the URL and try again.",
  signerChanged:
    "The Nostr signer account changed. Connect again before publishing.",
  noCoveredRelay:
    "Add a claim relay that the directory crawler reads before publishing.",
  working: "Waiting for signature and relay acknowledgement…",
  published: "Claim published. The directory will finish checking it shortly.",
  verified: "Your X account is verified. The directory can show it.",
  rejected: "The proof check rejected this claim.",
  publishedToast: "Signed X account claim published to Nostr relays.",
  publishFailed: "The signed claim could not be published.",
  signerConnected:
    "Signer connected. Post the proof tweet, then paste its URL below.",
} as const;

export interface ClaimIdentity {
  pubkey: string;
  npub: string;
}

export type ClaimStatusState = "idle" | "working" | "error" | "success";

export type ClaimProofResult =
  | { ok: true; crawlerRelays: string[] }
  | { ok: false; message: string };

const PROOF_ERRORS: Record<string, string> = {
  "npub-not-in-proof-tweet": CLAIM_COPY.proofMissingNpub,
  "proof-author-mismatch": CLAIM_COPY.proofAuthor,
  "reserved-handle": CLAIM_COPY.reservedHandle,
  "invalid-handle": CLAIM_COPY.invalidHandle,
};

export type ClaimIngestStatus = "verified" | "rejected" | "pending";

export type ClaimSubmitResult =
  | {
      ok: true;
      message: string;
      toast: string;
      ingestStatus: ClaimIngestStatus;
    }
  | {
      ok: false;
      reason: "missing-identity" | "missing-signer" | "failed";
      message: string;
    }
  | {
      ok: false;
      reason: "invalid-handle" | "invalid-proof";
      message: string;
      field: "handle" | "proofUrl";
      fieldMessage: string;
    }
  | {
      ok: false;
      reason: "signer-changed";
      message: string;
      clearIdentity: true;
    };

function directoryFunctionUrl(
  directoryApiUrl: string,
  functionName: string,
): string {
  const url = new URL(directoryApiUrl);
  if (!url.pathname.endsWith("/listDirectoryProfiles")) {
    throw new Error(
      "The directory API URL cannot be used to reach directory functions.",
    );
  }
  url.pathname = url.pathname.replace(
    /\/listDirectoryProfiles$/,
    `/${functionName}`,
  );
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function claimProofEndpoint(directoryApiUrl: string): string {
  return directoryFunctionUrl(directoryApiUrl, "checkClaimProof");
}

export function claimIngestEndpoint(directoryApiUrl: string): string {
  return directoryFunctionUrl(directoryApiUrl, "ingestClaim");
}

export async function fetchClaimProof(input: {
  directoryApiUrl: string;
  proofUrl: string;
  npub: string;
  fetchImpl?: typeof fetch;
}): Promise<ClaimProofResult> {
  let endpoint: URL;
  try {
    endpoint = new URL(claimProofEndpoint(input.directoryApiUrl));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : CLAIM_COPY.proofUnreadable,
    };
  }
  endpoint.searchParams.set("url", input.proofUrl);
  endpoint.searchParams.set("npub", input.npub);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      crawlerRelays?: unknown;
    } | null;
    if (!response.ok || !body || body.ok !== true) {
      return {
        ok: false,
        message: PROOF_ERRORS[body?.error ?? ""] ?? CLAIM_COPY.proofUnreadable,
      };
    }
    const crawlerRelays = Array.isArray(body.crawlerRelays)
      ? body.crawlerRelays.filter(
          (relay): relay is string => typeof relay === "string",
        )
      : [];
    return { ok: true, crawlerRelays };
  } catch {
    return { ok: false, message: CLAIM_COPY.proofUnreadable };
  }
}

export async function fetchIngestClaim(input: {
  directoryApiUrl: string;
  event: Event;
  relay: string;
  handle: string;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; handle: string; status: ClaimIngestStatus }
  | { ok: false; message: string }
> {
  let endpoint: string;
  try {
    endpoint = claimIngestEndpoint(input.directoryApiUrl);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : CLAIM_COPY.published,
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: input.event,
        relay: input.relay,
        handle: input.handle,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      handle?: string;
      status?: string;
    } | null;
    if (
      !response.ok ||
      !body?.ok ||
      (body.status !== "verified" &&
        body.status !== "rejected" &&
        body.status !== "pending")
    ) {
      return { ok: false, message: CLAIM_COPY.published };
    }
    return { ok: true, handle: body.handle || "", status: body.status };
  } catch {
    return { ok: false, message: CLAIM_COPY.published };
  }
}

function ingestMessage(status: ClaimIngestStatus): string {
  if (status === "verified") return CLAIM_COPY.verified;
  if (status === "rejected") return CLAIM_COPY.rejected;
  return CLAIM_COPY.published;
}

export async function submitXClaim(input: {
  identity: ClaimIdentity | null;
  signer: NostrSigner | null;
  handle: string;
  proofUrl: string;
  relayConfig?: string;
  directoryApiUrl?: string;
  now?: Date;
  getIdentity?: () => ClaimIdentity | null;
  onStart?: () => void;
  readProof?: (args: {
    proofUrl: string;
    npub: string;
  }) => Promise<ClaimProofResult>;
  loadExisting?: (pubkey: string, relays: string[]) => Promise<Event | null>;
  publish?: (
    event: Event,
    relays: string[],
    coveredRelays: readonly string[],
  ) => Promise<string>;
  ingestClaim?: (args: {
    event: Event;
    relay: string;
    handle: string;
  }) => Promise<
    | { ok: true; handle: string; status: ClaimIngestStatus }
    | { ok: false; message: string }
  >;
}): Promise<ClaimSubmitResult> {
  if (!input.identity) {
    return {
      ok: false,
      reason: "missing-identity",
      message: CLAIM_COPY.connectFirst,
    };
  }
  if (!input.signer) {
    return {
      ok: false,
      reason: "missing-signer",
      message: CLAIM_COPY.signerGone,
    };
  }

  const handleIssue = claimHandleIssue(input.handle);
  if (handleIssue) {
    const message =
      handleIssue === "reserved"
        ? CLAIM_COPY.reservedHandle
        : CLAIM_COPY.invalidHandle;
    return {
      ok: false,
      reason: "invalid-handle",
      message,
      field: "handle",
      fieldMessage: message,
    };
  }
  const handle = normalizeClaimHandle(input.handle);
  const proofUrl = handle ? validateProofUrl(input.proofUrl, handle) : null;
  if (!handle || !proofUrl) {
    return {
      ok: false,
      reason: "invalid-proof",
      message: CLAIM_COPY.proofMismatch,
      field: "proofUrl",
      fieldMessage: CLAIM_COPY.proofField,
    };
  }

  input.onStart?.();
  try {
    const signer = input.signer;
    const current = await connectClaimSigner(signer);
    const identity = input.getIdentity?.() ?? input.identity;
    if (!identity || current.pubkey !== identity.pubkey) {
      return {
        ok: false,
        reason: "signer-changed",
        message: CLAIM_COPY.signerChanged,
        clearIdentity: true,
      };
    }

    const proof = input.readProof
      ? await input.readProof({ proofUrl, npub: identity.npub })
      : await fetchClaimProof({
          directoryApiUrl: input.directoryApiUrl ?? DEFAULT_DIRECTORY_API_URL,
          proofUrl,
          npub: identity.npub,
        });
    if (!proof.ok) {
      return { ok: false, reason: "failed", message: proof.message };
    }

    const relays = parseClaimRelays(input.relayConfig);
    const coveredRelays = relaysCoveredBy(relays, proof.crawlerRelays);
    if (coveredRelays.length === 0) {
      throw new Error(CLAIM_COPY.noCoveredRelay);
    }

    const loadExisting = input.loadExisting ?? loadExistingClaimEvent;
    const existing = await loadExisting(identity.pubkey, relays);
    const unsigned = createClaimEvent(
      handle,
      proofUrl,
      input.now ?? new Date(),
      existing && {
        createdAt: existing.created_at,
        tags: existing.tags,
      },
    );
    const signed = await signClaimEvent(signer, identity.pubkey, unsigned);
    const publish = input.publish ?? publishClaimToCoveredRelays;
    const relay = await publish(signed, relays, coveredRelays);
    const ingested = input.ingestClaim
      ? await input.ingestClaim({ event: signed, relay, handle })
      : await fetchIngestClaim({
          directoryApiUrl: input.directoryApiUrl ?? DEFAULT_DIRECTORY_API_URL,
          event: signed,
          relay,
          handle,
        });
    const ingestStatus = ingested.ok ? ingested.status : "pending";
    return {
      ok: true,
      message: ingestMessage(ingestStatus),
      toast: CLAIM_COPY.publishedToast,
      ingestStatus,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message:
        error instanceof Error ? error.message : CLAIM_COPY.publishFailed,
    };
  }
}

export function claimDialogAfterClose(input: {
  publishing: boolean;
  hasIdentity: boolean;
  status: ClaimStatusState;
}): {
  publishDisabled: boolean;
  statusMessage: string;
  status: ClaimStatusState;
} | null {
  if (input.publishing) return null;
  if (input.hasIdentity) {
    return {
      publishDisabled: false,
      statusMessage: CLAIM_COPY.signerConnected,
      status: "success",
    };
  }
  return {
    publishDisabled: true,
    statusMessage: CLAIM_COPY.idle,
    status: "idle",
  };
}
