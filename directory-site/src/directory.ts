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
    return (b.followers ?? -1) - (a.followers ?? -1);
  });
}

export function formatFollowers(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(".0", "")}K`;
  }

  return value.toLocaleString("en-US");
}

export function nip05ProfileUrl(value: string): string | null {
  const match =
    /^(?:[a-zA-Z0-9_.-]+@)?((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/.exec(
      value,
    );
  return match ? `https://${match[1]}` : null;
}

export function truncateNpub(npub: string): string {
  if (npub.length <= 22) return npub;
  return `${npub.slice(0, 12)}…${npub.slice(-7)}`;
}

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export interface PaginationResult<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export function paginateProfiles<T>(
  items: readonly T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.max(1, Math.min(Math.floor(page) || 1, totalPages));
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
  };
}

export function getPaginationPageList(
  currentPage: number,
  totalPages: number,
): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "…", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "…",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "…",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "…",
    totalPages,
  ];
}
