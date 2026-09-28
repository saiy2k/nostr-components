import { nip19 } from "nostr-tools";
import type { DirectoryProfile } from "./data";

export const DIRECTORY_BATCH_SIZE = 50;
export const DIRECT_OFFSET_LIMIT = 10_000;
export const DEFAULT_ATLAS_API_URL =
  "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles";

const REQUEST_TIMEOUT_MS = 15_000;

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
  readonly handle?: unknown;
  readonly name?: unknown;
  readonly nip05?: unknown;
  readonly picture?: unknown;
  readonly pubkey?: unknown;
  readonly verified?: unknown;
}

export function mapDirectoryProfile(raw: RawDirectoryProfile): DirectoryProfile | null {
  const slug = String(raw.handle ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(slug)) return null;
  const pubkey = String(raw.pubkey ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) return null;

  let npub = "";
  try {
    npub = nip19.npubEncode(pubkey);
  } catch {
    return null;
  }

  const name = String(raw.name ?? "").trim() || slug;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || slug.slice(0, 2).toUpperCase();

  return {
    id: String(raw.id ?? `twitter:${slug}`),
    name,
    handle: `@${slug}`,
    nip05: String(raw.nip05 ?? "").trim(),
    category: "Popular on X.com",
    followers: null,
    verified: raw.verified === true,
    npub,
    youtube: "",
    picture: typeof raw.picture === "string" ? raw.picture.trim() : "",
    avatar: {
      initials,
      foreground: "#ffffff",
      background: "#7456f6",
    },
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
  const url = new URL(apiUrl);
  url.searchParams.set("limit", String(DIRECTORY_BATCH_SIZE));
  url.searchParams.set("offset", String(options.offset));
  const search = options.search.trim();
  if (search) url.searchParams.set("search", search);
  if (options.cursor) url.searchParams.set("cursor", options.cursor);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Directory request failed (${response.status}).`);
  }

  const body = (await response.json()) as {
    profiles?: unknown;
    total?: unknown;
    offset?: unknown;
    nextCursor?: unknown;
  };
  if (!Array.isArray(body.profiles) || typeof body.total !== "number") {
    throw new Error("Directory response was not valid.");
  }

  return {
    profiles: body.profiles
      .map((profile) => mapDirectoryProfile(profile as RawDirectoryProfile))
      .filter((profile): profile is DirectoryProfile => profile !== null),
    total: body.total,
    offset: typeof body.offset === "number" ? body.offset : options.offset,
    nextCursor:
      typeof body.nextCursor === "string" && body.nextCursor
        ? body.nextCursor
        : null,
  };
}
