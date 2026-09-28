import { nip19 } from "nostr-tools";
import type { DirectoryProfile } from "./data";
import { httpsPictureUrl } from "./directory";

export const DIRECTORY_BATCH_SIZE = 50;
export const DIRECT_OFFSET_LIMIT = 10_000;
export const DEFAULT_ATLAS_API_URL =
  "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CURSOR_POSITION = 1_000_000;
const MAX_SEARCH_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MAX_NIP05_LENGTH = 255;
const CURSOR_PATTERN = /^twitter:[a-z0-9_]{1,15}$/;

export interface DirectoryPage {
  readonly profiles: DirectoryProfile[];
  readonly total: number;
  readonly offset: number;
  readonly nextCursor: string | null;
}

export interface DirectoryPageRequest {
  readonly offset: number;
  readonly search: string;
  readonly cachedCursors: ReadonlyMap<number, string | null>;
}

interface RawDirectoryProfile {
  readonly id?: unknown;
  readonly platform?: unknown;
  readonly handle?: unknown;
  readonly name?: unknown;
  readonly nip05?: unknown;
  readonly picture?: unknown;
  readonly pubkey?: unknown;
  readonly verified?: unknown;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapDirectoryProfile(raw: RawDirectoryProfile): DirectoryProfile | null {
  const slug = String(raw.handle ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(slug)) return null;
  const pubkey = String(raw.pubkey ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) return null;
  // The API lists verified X identities only. Anything else must not render:
  // an unverified row would be labelled "Local preview", which is misleading.
  if (raw.verified !== true || raw.platform !== "twitter") return null;
  // The document id must agree with the handle; never pair a handle with a
  // pubkey stored under a different identity.
  if (raw.id !== `twitter:${slug}`) return null;
  if (
    raw.name !== undefined &&
    (typeof raw.name !== "string" || raw.name.length > MAX_NAME_LENGTH)
  ) {
    return null;
  }
  if (
    raw.nip05 !== undefined &&
    (typeof raw.nip05 !== "string" || raw.nip05.length > MAX_NIP05_LENGTH)
  ) {
    return null;
  }
  const picture = readPicture(raw.picture);
  if (picture === null) return null;

  let npub = "";
  try {
    npub = nip19.npubEncode(pubkey);
  } catch {
    return null;
  }

  const name = (typeof raw.name === "string" ? raw.name.trim() : "") || slug;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || slug.slice(0, 2).toUpperCase();

  return {
    id: `twitter:${slug}`,
    name,
    handle: `@${slug}`,
    nip05: typeof raw.nip05 === "string" ? raw.nip05.trim() : "",
    category: "Popular on X.com",
    followers: null,
    verified: true,
    // Encode the verified key; never trust a stored npub that may disagree.
    npub,
    youtube: "",
    picture,
    avatar: {
      initials,
      foreground: "#ffffff",
      background: "#7456f6",
    },
  };
}

function readPicture(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  const picture = httpsPictureUrl(value);
  return picture || null;
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
    (value.offset as number) > MAX_CURSOR_POSITION ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === "string" &&
        CURSOR_PATTERN.test(value.nextCursor))
    )
  ) {
    throw new Error("The directory returned an invalid response.");
  }

  return {
    profiles: value.profiles
      .map((profile) => mapDirectoryProfile(profile as RawDirectoryProfile))
      .filter((profile): profile is DirectoryProfile => profile !== null),
    total: value.total as number,
    offset: value.offset as number,
    nextCursor: value.nextCursor as string | null,
  };
}

export async function fetchDirectoryPageAtOffset(
  apiUrl: string,
  request: DirectoryPageRequest,
  onPage: (page: DirectoryPage) => void,
): Promise<void> {
  const target = normalizeOffset(request.offset);
  if (target < DIRECT_OFFSET_LIMIT) {
    onPage(
      await requestPage(apiUrl, {
        offset: target,
        search: request.search,
      }),
    );
    return;
  }

  const cursors = new Map(request.cachedCursors);
  let cursorOffset = nearestCursorOffset(cursors, target);
  if (cursorOffset === null) {
    const boundary = DIRECT_OFFSET_LIMIT - DIRECTORY_BATCH_SIZE;
    const boundaryPage = await requestPage(apiUrl, {
      offset: boundary,
      search: request.search,
    });
    onPage(boundaryPage);
    cursors.set(boundaryPage.offset, boundaryPage.nextCursor);
    cursorOffset = boundaryPage.offset;
  }

  let nextOffset = cursorOffset + DIRECTORY_BATCH_SIZE;
  while (nextOffset <= target) {
    const cursor = cursors.get(nextOffset - DIRECTORY_BATCH_SIZE);
    if (!cursor) throw new Error("Directory page cursor is missing.");
    const page = await requestPage(apiUrl, {
      offset: nextOffset,
      search: request.search,
      cursor,
    });
    onPage(page);
    cursors.set(page.offset, page.nextCursor);
    if (!page.nextCursor && nextOffset < target) {
      throw new Error("Directory page cursor is missing.");
    }
    nextOffset += DIRECTORY_BATCH_SIZE;
  }
}

function normalizeOffset(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset / DIRECTORY_BATCH_SIZE) * DIRECTORY_BATCH_SIZE;
}

function nearestCursorOffset(
  cursors: ReadonlyMap<number, string | null>,
  target: number,
): number | null {
  const floor = DIRECT_OFFSET_LIMIT - DIRECTORY_BATCH_SIZE;
  let best: number | null = null;
  for (const [offset, cursor] of cursors) {
    if (!cursor || offset < floor || offset >= target) continue;
    if (best === null || offset > best) best = offset;
  }
  return best;
}

async function requestPage(
  apiUrl: string,
  options: { offset: number; search: string; cursor?: string },
): Promise<DirectoryPage> {
  const offset = options.offset;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > MAX_CURSOR_POSITION
  ) {
    throw new Error("The requested directory page is invalid.");
  }
  if (options.cursor !== undefined && !CURSOR_PATTERN.test(options.cursor)) {
    throw new Error("The requested directory cursor is invalid.");
  }
  const search = options.search.trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new Error("The directory search is too long.");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("limit", String(DIRECTORY_BATCH_SIZE));
  url.searchParams.set("offset", String(offset));
  if (search) url.searchParams.set("search", search);
  if (options.cursor) url.searchParams.set("cursor", options.cursor);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Directory request failed (${response.status}).`);
  }

  const page = parseDirectoryPage(await response.json());
  if (page.offset !== offset) {
    throw new Error("The directory returned the wrong page.");
  }
  return page;
}
