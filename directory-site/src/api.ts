import { npubEncode } from "nostr-tools/nip19";
import type { DirectoryProfile } from "./data";

export const DEFAULT_DIRECTORY_API_URL =
  "https://us-central1-gr-prod.cloudfunctions.net/listDirectoryProfiles";
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_EMPTY_PAGE_REQUESTS = 5;
const CURSOR_PATTERN = /^twitter:[a-z0-9_]{1,15}$/;

export interface DirectoryPage {
  readonly profiles: DirectoryProfile[];
  readonly nextCursor: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDirectoryPage(value: unknown): DirectoryPage {
  if (
    !record(value) ||
    !Array.isArray(value.profiles) ||
    value.profiles.length > PAGE_SIZE ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === "string" &&
        CURSOR_PATTERN.test(value.nextCursor))
    )
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

  return { profiles, nextCursor: value.nextCursor };
}

export async function fetchDirectoryPage(
  endpoint: string,
  cursor: string | null = null,
  fetcher: typeof fetch = fetch,
): Promise<DirectoryPage> {
  const url = new URL(endpoint);
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (cursor) url.searchParams.set("cursor", cursor);
  else url.searchParams.delete("cursor");

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
    if (cursor && page.nextCursor && page.nextCursor <= cursor) {
      throw new Error("The directory returned an invalid page cursor.");
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

export async function fetchNextDirectoryPage(
  endpoint: string,
  cursor: string | null = null,
  fetcher: typeof fetch = fetch,
): Promise<DirectoryPage> {
  let requestCursor = cursor;
  let page: DirectoryPage = { profiles: [], nextCursor: requestCursor };

  for (let attempt = 0; attempt < MAX_EMPTY_PAGE_REQUESTS; attempt += 1) {
    page = await fetchDirectoryPage(endpoint, requestCursor, fetcher);
    if (page.profiles.length > 0 || !page.nextCursor) return page;
    requestCursor = page.nextCursor;
  }

  return page;
}
