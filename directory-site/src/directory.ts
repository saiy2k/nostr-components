import type { DirectoryCategory, DirectoryProfile } from "./data";

export type DirectorySort = "followers" | "name";

export interface DirectoryFilters {
  readonly category: DirectoryCategory;
  readonly query: string;
  readonly sort: DirectorySort;
  readonly verifiedOnly: boolean;
}

export function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function getVisibleProfiles(
  profiles: readonly DirectoryProfile[],
  filters: DirectoryFilters,
): DirectoryProfile[] {
  const query = normalizeSearch(filters.query);

  const filtered = profiles.filter((profile) => {
    if (
      filters.category !== "Trending" &&
      profile.category !== filters.category
    ) {
      return false;
    }

    if (filters.verifiedOnly && !profile.verified) {
      return false;
    }

    if (!query) return true;

    return [
      profile.name,
      profile.handle,
      profile.nip05,
      profile.npub,
      profile.category,
      profile.category === "Communities"
        ? "community"
        : profile.category.slice(0, -1),
    ].some((value) => normalizeSearch(value).includes(query));
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    return b.followers - a.followers;
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
