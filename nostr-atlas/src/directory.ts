import type { DirectoryCategory, DirectoryProfile } from "./data";

export type DirectorySort = "followers" | "name";

export interface DirectoryFilters {
  readonly category: DirectoryCategory;
  readonly query: string;
  readonly sort: DirectorySort;
}

export function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function categorySearchTerms(category: DirectoryCategory): string[] {
  if (category === "Popular on X.com") {
    return [category, "x.com", "x", "twitter"];
  }

  return [category, "nostr"];
}

export function getVisibleProfiles(
  profiles: readonly DirectoryProfile[],
  filters: DirectoryFilters,
): DirectoryProfile[] {
  const query = normalizeSearch(filters.query);

  const filtered = profiles.filter((profile) => {
    if (profile.category !== filters.category) {
      return false;
    }

    if (!query) return true;

    return [
      profile.name,
      profile.handle,
      profile.nip05,
      profile.npub,
      ...categorySearchTerms(profile.category),
    ].some((value) => normalizeSearch(value).includes(query));
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    return (b.followers ?? 0) - (a.followers ?? 0);
  });
}

export function formatFollowers(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(".0", "")}K`;
  }

  return value.toLocaleString("en-US");
}

export function truncateNpub(npub: string): string {
  if (npub.length <= 22) return npub;
  return `${npub.slice(0, 12)}…${npub.slice(-7)}`;
}

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export interface DirectoryPagination<T> {
  readonly items: T[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export function paginateProfiles<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): DirectoryPagination<T> {
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const safePage =
    totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
  };
}

export function getPaginationPageList(
  page: number,
  totalPages: number,
): Array<number | "…"> {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("…");
  for (let number = start; number <= end; number += 1) items.push(number);
  if (end < totalPages - 1) items.push("…");
  items.push(totalPages);
  return items;
}

export function getRequiredBatchOffsets(
  startIndex: number,
  endIndex: number,
  previewCount: number,
  totalProfiles: number,
  batchSize: number,
  cachedOffsets: ReadonlySet<number>,
): number[] {
  const remoteStart = Math.max(0, startIndex - previewCount);
  const remoteEnd = Math.max(remoteStart, endIndex - previewCount);
  if (remoteStart >= totalProfiles || remoteStart >= remoteEnd) return [];

  const lastIndex = Math.min(remoteEnd, totalProfiles) - 1;
  const offsets: number[] = [];
  for (let index = remoteStart; index <= lastIndex; index += 1) {
    const offset = Math.floor(index / batchSize) * batchSize;
    if (!cachedOffsets.has(offset) && !offsets.includes(offset)) {
      offsets.push(offset);
    }
  }
  return offsets;
}

export function profileAvatarHtml(profile: DirectoryProfile): string {
  const style = `--avatar-bg:${escapeHtml(profile.avatar.background)};--avatar-fg:${escapeHtml(profile.avatar.foreground)}`;
  const picture = httpsPictureUrl(profile.picture);
  if (picture) {
    return `<span class="avatar" style="${style}"><img class="avatar-image" src="${escapeHtml(picture)}" alt="" /></span>`;
  }
  return `<span class="avatar" aria-hidden="true" style="${style}">${escapeHtml(profile.avatar.initials)}</span>`;
}

const PICTURE_MAX_LENGTH = 2000;

export function httpsPictureUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > PICTURE_MAX_LENGTH) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (!url.hostname) return "";
    const serialized = url.toString();
    if (
      !serialized.startsWith("https://") ||
      serialized.length > PICTURE_MAX_LENGTH
    ) {
      return "";
    }
    return serialized;
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
