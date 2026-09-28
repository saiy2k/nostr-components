import { afterEach, describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import {
  fetchDirectoryPageAtOffset,
  mapDirectoryProfile,
  parseDirectoryPage,
  type DirectoryPage,
} from "./api";

const profile = {
  id: "twitter:alice",
  platform: "twitter",
  handle: "alice",
  pubkey: "a".repeat(64),
  verified: true,
  name: "Alice",
  nip05: "alice@example.com",
};
const endpoint = "https://example.com/listAtlasProfiles";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function fetchPages(request: {
  offset: number;
  search?: string;
  cachedCursors?: ReadonlyMap<number, string | null>;
}): Promise<DirectoryPage[]> {
  const pages: DirectoryPage[] = [];
  await fetchDirectoryPageAtOffset(
    endpoint,
    {
      offset: request.offset,
      search: request.search ?? "",
      cachedCursors: request.cachedCursors ?? new Map(),
    },
    (page) => pages.push(page),
  );
  return pages;
}

describe("directory API", () => {
  it("maps verified identities to the UI without inventing follower counts or YouTube claims", () => {
    const page = parseDirectoryPage({
      profiles: [profile],
      total: 1,
      offset: 0,
      nextCursor: null,
    });
    expect(page.profiles[0]).toMatchObject({
      id: "twitter:alice",
      name: "Alice",
      handle: "@alice",
      verified: true,
      npub: nip19.npubEncode(profile.pubkey),
      followers: null,
      youtube: "",
      picture: "",
      category: "Popular on X.com",
    });
    expect(page.total).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps a missing picture and accepts one https picture", () => {
    expect(mapDirectoryProfile(profile)?.picture).toBe("");
    expect(
      mapDirectoryProfile({ ...profile, picture: " HTTPS://CDN.Example/a.png " })
        ?.picture,
    ).toBe("https://cdn.example/a.png");
  });

  it.each([
    "javascript:alert(1)",
    "http://cdn.example/a.png",
    "https://user:pass@cdn.example/a.png",
    "not a url",
  ])("drops a profile with an unsafe picture: %s", (picture) => {
    expect(mapDirectoryProfile({ ...profile, picture })).toBeNull();
  });

  it.each([
    { ...profile, verified: false },
    { ...profile, platform: "youtube" },
    { ...profile, id: "twitter:bob" },
    { ...profile, pubkey: "invalid" },
    { ...profile, handle: "not a handle" },
    { ...profile, name: "x".repeat(101) },
    { ...profile, nip05: "x".repeat(256) },
  ])("drops a profile outside the verified X contract: %j", (value) => {
    expect(mapDirectoryProfile(value)).toBeNull();
  });

  it("omits dropped profiles while retaining the page metadata", () => {
    const page = parseDirectoryPage({
      profiles: [profile, { ...profile, verified: false }],
      total: 2,
      offset: 0,
      nextCursor: null,
    });
    expect(page.profiles).toHaveLength(1);
    expect(page.total).toBe(2);
  });

  it.each([
    null,
    { profiles: [], total: -1, offset: 0, nextCursor: null },
    { profiles: [], total: 1.5, offset: 0, nextCursor: null },
    { profiles: [], total: 0, offset: -1, nextCursor: null },
    { profiles: [], total: 0, offset: 1_000_001, nextCursor: null },
    { profiles: [profile] },
    {
      profiles: [],
      total: 0,
      offset: 0,
      nextCursor: "invalid/cursor",
    },
    {
      profiles: Array(51).fill(profile),
      total: 51,
      offset: 0,
      nextCursor: null,
    },
  ])("rejects malformed responses: %j", (value) => {
    expect(() => parseDirectoryPage(value)).toThrow();
  });

  it("uses GET, a bounded batch size, offset, and backend search", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          profiles: [profile],
          total: 1,
          offset: 50,
          nextCursor: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    await fetchPages({ offset: 50, search: "@alice" });
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("limit")).toBe("50");
    expect(new URL(String(url)).searchParams.get("offset")).toBe("50");
    expect(new URL(String(url)).searchParams.get("search")).toBe("@alice");
    expect(options).toMatchObject({
      method: "GET",
      credentials: "omit",
      signal: expect.any(AbortSignal),
    });
  });

  it("treats an empty directory as a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"profiles":[],"total":0,"offset":0,"nextCursor":null}'),
      ),
    );
    await expect(fetchPages({ offset: 0 })).resolves.toEqual([
      { profiles: [], total: 0, offset: 0, nextCursor: null },
    ]);
  });

  it("surfaces unavailable APIs and network failures instead of substituting demo data", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchPages({ offset: 0 })).rejects.toThrow("503");
    fetcher.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchPages({ offset: 0 })).rejects.toThrow("Failed to fetch");
  });

  it("rejects non-JSON responses, including an incorrect hosting rewrite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>Site</html>")),
    );
    await expect(fetchPages({ offset: 0 })).rejects.toThrow();
  });

  it("rejects responses for a different offset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"profiles":[],"total":100,"offset":0,"nextCursor":null}'),
      ),
    );
    await expect(fetchPages({ offset: 50 })).rejects.toThrow("wrong page");
  });

  it("rejects invalid cursors and overlong searches before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      fetchPages({
        offset: 10_050,
        cachedCursors: new Map([[10_000, "invalid/cursor"]]),
      }),
    ).rejects.toThrow("cursor is invalid");
    await expect(
      fetchPages({ offset: 0, search: "x".repeat(256) }),
    ).rejects.toThrow("too long");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("walks keyset cursors from the direct offset boundary to reach deep batches", async () => {
    const finalProfile = {
      ...profile,
      id: "twitter:carol",
      handle: "carol",
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      const cursor = url.searchParams.get("cursor");
      if (offset === 9_950 && cursor === null) {
        return new Response(
          '{"profiles":[],"total":10101,"offset":9950,"nextCursor":"twitter:a09950"}',
        );
      }
      if (offset === 10_000 && cursor === "twitter:a09950") {
        return new Response(
          '{"profiles":[],"total":10101,"offset":10000,"nextCursor":"twitter:a10000"}',
        );
      }
      if (offset === 10_050 && cursor === "twitter:a10000") {
        return new Response(
          '{"profiles":[],"total":10101,"offset":10050,"nextCursor":"twitter:a10050"}',
        );
      }
      return new Response(
        JSON.stringify({
          profiles: [finalProfile],
          total: 10_101,
          offset: 10_100,
          nextCursor: null,
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);

    const pages = await fetchPages({ offset: 10_100 });

    expect(pages.map((page) => page.offset)).toEqual([
      9_950, 10_000, 10_050, 10_100,
    ]);
    expect(pages.at(-1)?.profiles).toEqual([
      expect.objectContaining({ id: "twitter:carol" }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("resumes a deep page from the nearest cached cursor at or after the boundary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      const cursor = url.searchParams.get("cursor");
      if (offset === 10_050 && cursor === "twitter:a10000") {
        return new Response(
          '{"profiles":[],"total":10101,"offset":10050,"nextCursor":"twitter:a10050"}',
        );
      }
      return new Response(
        JSON.stringify({
          profiles: [],
          total: 10_101,
          offset: 10_100,
          nextCursor: null,
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);

    await fetchPages({
      offset: 10_100,
      cachedCursors: new Map([
        [0, "twitter:stale"],
        [10_000, "twitter:a10000"],
      ]),
    });

    const offsets = fetcher.mock.calls.map(([input]) =>
      Number(new URL(String(input)).searchParams.get("offset")),
    );
    expect(offsets).toEqual([10_050, 10_100]);
    expect(
      fetcher.mock.calls.every(
        ([input]) =>
          new URL(String(input)).searchParams.get("cursor") !==
          "twitter:stale",
      ),
    ).toBe(true);
  });

  it("stops the walk when a covered page stops returning a cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          '{"profiles":[],"total":10101,"offset":9950,"nextCursor":null}',
        ),
      ),
    );
    await expect(fetchPages({ offset: 10_100 })).rejects.toThrow(
      "cursor is missing",
    );
  });
});
