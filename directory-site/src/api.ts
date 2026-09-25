import { npubEncode } from "nostr-tools/nip19";
import type { DirectoryProfile } from "./data";

export const DEFAULT_DIRECTORY_API_URL =
  "https://us-central1-gr-prod.cloudfunctions.net/listDirectoryProfiles";
export const DIRECTORY_BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_OFFSET = 1_000_000;
const MAX_SEARCH_LENGTH = 255;

export interface DirectoryPage {
  readonly profiles: DirectoryProfile[];
  readonly total: number;
  readonly offset: number;
}

export interface DirectoryRequest {
  readonly offset?: number;
  readonly search?: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDirectoryPage(value: unknown): DirectoryPage {
  if (
    !record(value) ||
    !Array.isArray(value.profiles) ||
    value.profiles.length > DIRECTORY_BATCH_SIZE ||
    !Number.isSafeInteger(value.total) ||
    (value.total as number) < 0 ||
    !Number.isSafeInteger(value.offset) ||
    (value.offset as number) < 0 ||
    (value.offset as number) > MAX_OFFSET
  ) {
    throw new Error("The directory returned an invalid response.");
  }

  const profiles = value.profiles.map((profile): DirectoryProfile => {
    if (
      !record(profile) ||
      profile.platform !== "twitter" ||
      profile.verified !== true ||
      typeof profile.handle !== "string" ||
      !/^[a-z0-9_]{1,15}$/.test(profile.handle) ||
      profile.id !== `twitter:${profile.handle}` ||
      typeof profile.pubkey !== "string" ||
      !/^[0-9a-f]{64}$/i.test(profile.pubkey) ||
      typeof profile.name !== "string" ||
      profile.name.length > 100 ||
      typeof profile.nip05 !== "string" ||
      profile.nip05.length > 255
    ) {
      throw new Error("The directory returned an invalid profile.");
    }

    const name = profile.name.trim() || profile.handle;
    return {
      id: profile.id as string,
      name,
      handle: `@${profile.handle}`,
      nip05: profile.nip05,
      category: "Popular on X.com",
      followers: null,
      verified: true,
      // Encode the verified key; never trust a stored npub that may disagree.
      npub: npubEncode(profile.pubkey.toLowerCase()),
      youtube: "",
      avatar: {
        initials: name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        foreground: "#ffffff",
        background: "#7456f6",
      },
    };
  });

  return {
    profiles,
    total: value.total as number,
    offset: value.offset as number,
  };
}

export async function fetchDirectoryPage(
  endpoint: string,
  request: DirectoryRequest = {},
  fetcher: typeof fetch = fetch,
): Promise<DirectoryPage> {
  const offset = request.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new Error("The requested directory page is invalid.");
  }
  const search = request.search?.trim() ?? "";
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new Error("The directory search is too long.");
  }

  const url = new URL(endpoint);
  url.searchParams.set("limit", String(DIRECTORY_BATCH_SIZE));
  url.searchParams.set("offset", String(offset));
  if (search) url.searchParams.set("search", search);
  else url.searchParams.delete("search");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error(`Directory request failed (${response.status}).`);
    const page = parseDirectoryPage(await response.json());
    if (page.offset !== offset) {
      throw new Error("The directory returned the wrong page.");
    }
    return page;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The directory took too long to respond. Please retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
