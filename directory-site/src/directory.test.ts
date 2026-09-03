import { describe, expect, it } from "vitest";
import { directoryProfiles } from "./data";
import {
  formatFollowers,
  getVisibleProfiles,
  normalizeSearch,
  truncateNpub,
} from "./directory";

const baseFilters = {
  category: "Trending" as const,
  query: "",
  sort: "followers" as const,
  verifiedOnly: true,
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
        query: "community",
      }).map((profile) => profile.id),
    ).toEqual(["nostr", "snort"]);
  });

  it("applies the category and alphabetical sort together", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        category: "Creators",
        sort: "name",
      }).map((profile) => profile.name),
    ).toEqual(["Damus", "Guy Swann"]);
  });
});

describe("directory formatting", () => {
  it("formats follower counts for compact display", () => {
    expect(formatFollowers(311_200)).toBe("311.2K");
    expect(formatFollowers(1_000_000)).toBe("1M");
    expect(formatFollowers(820)).toBe("820");
  });

  it("truncates long public keys without hiding their ends", () => {
    expect(truncateNpub("npub1234567890abcdefghijklmnopqrstuvwxyz")).toBe(
      "npub12345678…tuvwxyz",
    );
  });
});
