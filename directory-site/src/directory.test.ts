import { describe, expect, it } from "vitest";
import { directoryProfiles } from "./data";
import {
  formatFollowers,
  getPaginationPageList,
  getVisibleProfiles,
  normalizeSearch,
  nip05ProfileUrl,
  paginateProfiles,
  truncateNpub,
} from "./directory";

const baseFilters = {
  category: "Popular on X.com" as const,
  query: "",
  sort: "followers" as const,
};

describe("directory filtering", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeSearch("  NIP-05  ")).toBe("nip-05");
  });

  it("finds profiles across handles, NIP-05 and categories", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        query: "@GUYSWANN",
      }).map((profile) => profile.id),
    ).toEqual(["guy-swann"]);

    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        query: "x.com",
      }).map((profile) => profile.id),
    ).toEqual(["jack", "tbot", "guy-swann"]);
  });

  it("keeps each tab limited to its platform", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        category: "Popular on Nostr",
      }).map((profile) => profile.id),
    ).toEqual(["damus", "nostr", "snort"]);
  });

  it("applies the category and alphabetical sort together", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        sort: "name",
      }).map((profile) => profile.name),
    ).toEqual(["Guy Swann", "jack", "tbot"]);
  });
});

describe("directory formatting", () => {
  it("formats follower counts for compact display", () => {
    expect(formatFollowers(null)).toBe("—");
    expect(formatFollowers(311_200)).toBe("311.2K");
    expect(formatFollowers(1_000_000)).toBe("1M");
    expect(formatFollowers(820)).toBe("820");
  });

  it("sorts missing audience counts after known counts without losing profiles", () => {
    const profiles = directoryProfiles
      .filter((profile) => profile.category === baseFilters.category)
      .map((profile, index) => ({
        ...profile,
        followers: index === 1 ? 100 : null,
      }));
    expect(
      getVisibleProfiles(profiles, baseFilters).map((profile) => profile.id),
    ).toEqual(["tbot", "jack", "guy-swann"]);
  });

  it("preserves original arrival order when audience counts are absent", () => {
    const profiles = directoryProfiles
      .filter((profile) => profile.category === baseFilters.category)
      .map((profile) => ({
        ...profile,
        followers: null,
      }));
    expect(
      getVisibleProfiles(profiles, baseFilters).map((profile) => profile.id),
    ).toEqual(["jack", "tbot", "guy-swann"]);
  });

  it("only links profile-provided Nostr addresses with valid domains", () => {
    expect(nip05ProfileUrl("alice@example.com")).toBe("https://example.com");
    expect(nip05ProfileUrl("example.com")).toBe("https://example.com");
    for (const value of [
      "",
      "javascript:alert(1)",
      "alice@example.com/path",
      "alice@localhost",
      'alice@example.com\" onclick=\"alert(1)',
    ]) {
      expect(nip05ProfileUrl(value)).toBeNull();
    }
  });

  it("truncates long public keys without hiding their ends", () => {
    expect(truncateNpub("npub1234567890abcdefghijklmnopqrstuvwxyz")).toBe(
      "npub12345678…tuvwxyz",
    );
  });
});

describe("directory pagination", () => {
  const sampleItems = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

  it("paginates items into slices and computes total pages", () => {
    const page1 = paginateProfiles(sampleItems, 1, 10);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(10);
    expect(page1.totalItems).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.startIndex).toBe(0);
    expect(page1.endIndex).toBe(10);
    expect(page1.items).toEqual(sampleItems.slice(0, 10));

    const page2 = paginateProfiles(sampleItems, 2, 10);
    expect(page2.page).toBe(2);
    expect(page2.startIndex).toBe(10);
    expect(page2.endIndex).toBe(20);
    expect(page2.items).toEqual(sampleItems.slice(10, 20));

    const page3 = paginateProfiles(sampleItems, 3, 10);
    expect(page3.page).toBe(3);
    expect(page3.startIndex).toBe(20);
    expect(page3.endIndex).toBe(25);
    expect(page3.items).toEqual(sampleItems.slice(20, 25));
  });

  it("clamps out-of-bounds page numbers safely", () => {
    const clampedHigh = paginateProfiles(sampleItems, 99, 10);
    expect(clampedHigh.page).toBe(3);
    expect(clampedHigh.items.length).toBe(5);

    const clampedLow = paginateProfiles(sampleItems, 0, 10);
    expect(clampedLow.page).toBe(1);
    expect(clampedLow.items.length).toBe(10);

    const clampedNegative = paginateProfiles(sampleItems, -5, 10);
    expect(clampedNegative.page).toBe(1);
    expect(clampedNegative.items.length).toBe(10);
  });

  it("handles empty items array gracefully", () => {
    const emptyResult = paginateProfiles([], 1, 10);
    expect(emptyResult.page).toBe(1);
    expect(emptyResult.totalItems).toBe(0);
    expect(emptyResult.totalPages).toBe(1);
    expect(emptyResult.startIndex).toBe(0);
    expect(emptyResult.endIndex).toBe(0);
    expect(emptyResult.items).toEqual([]);
  });

  it("handles invalid or default page size gracefully", () => {
    const defaultResult = paginateProfiles(sampleItems, 1);
    expect(defaultResult.pageSize).toBe(10);

    const zeroSizeResult = paginateProfiles(sampleItems, 1, 0);
    expect(zeroSizeResult.pageSize).toBe(10);
  });

  it("generates page list without ellipses for 7 or fewer pages", () => {
    expect(getPaginationPageList(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationPageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("generates page list with ellipses for more than 7 pages", () => {
    // Near start
    expect(getPaginationPageList(1, 10)).toEqual([1, 2, 3, 4, 5, "…", 10]);
    expect(getPaginationPageList(4, 10)).toEqual([1, 2, 3, 4, 5, "…", 10]);

    // In middle
    expect(getPaginationPageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(getPaginationPageList(6, 10)).toEqual([1, "…", 5, 6, 7, "…", 10]);

    // Near end
    expect(getPaginationPageList(7, 10)).toEqual([1, "…", 6, 7, 8, 9, 10]);
    expect(getPaginationPageList(10, 10)).toEqual([1, "…", 6, 7, 8, 9, 10]);
  });
});
