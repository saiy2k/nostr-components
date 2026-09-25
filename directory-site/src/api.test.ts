import { afterEach, describe, expect, it, vi } from "vitest";
import { npubEncode } from "nostr-tools/nip19";
import { fetchDirectoryPage, parseDirectoryPage } from "./api";

const profile = {
  id: "twitter:alice",
  platform: "twitter",
  handle: "alice",
  pubkey: "a".repeat(64),
  verified: true,
  name: "Alice",
  nip05: "alice@example.com",
};
const endpoint = "https://example.com/listDirectoryProfiles";

afterEach(() => vi.useRealTimers());

describe("directory API", () => {
  it("maps verified identities to the UI without inventing follower counts or YouTube claims", () => {
    const page = parseDirectoryPage({
      profiles: [profile],
      total: 1,
      offset: 0,
    });
    expect(page.profiles[0]).toMatchObject({
      id: "twitter:alice",
      name: "Alice",
      handle: "@alice",
      verified: true,
      npub: npubEncode(profile.pubkey),
      followers: null,
      youtube: "",
      category: "Popular on X.com",
    });
    expect(page.total).toBe(1);
    expect(page.offset).toBe(0);
  });

  it.each([
    null,
    { profiles: [], total: -1, offset: 0 },
    { profiles: [], total: 0, offset: -1 },
    { profiles: [profile] },
    { profiles: [{ ...profile, verified: false }], total: 1, offset: 0 },
    { profiles: [{ ...profile, pubkey: "invalid" }], total: 1, offset: 0 },
    { profiles: [{ ...profile, id: "twitter:bob" }], total: 1, offset: 0 },
    { profiles: [{ ...profile, platform: "youtube" }], total: 1, offset: 0 },
    { profiles: Array(51).fill(profile), total: 51, offset: 0 },
  ])("rejects malformed responses: %j", (value) => {
    expect(() => parseDirectoryPage(value)).toThrow();
  });

  it("uses GET, a bounded batch size, offset, and backend search", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ profiles: [profile], total: 1, offset: 50 }),
        ),
      );
    await fetchDirectoryPage(
      endpoint,
      { offset: 50, search: "@alice" },
      fetcher,
    );
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
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"profiles":[],"total":0,"offset":0}'));
    await expect(fetchDirectoryPage(endpoint, {}, fetcher)).resolves.toEqual({
      profiles: [],
      total: 0,
      offset: 0,
    });
  });

  it("surfaces unavailable APIs and network failures instead of substituting demo data", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(fetchDirectoryPage(endpoint, {}, fetcher)).rejects.toThrow(
      "503",
    );
    fetcher.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchDirectoryPage(endpoint, {}, fetcher)).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("rejects non-JSON responses, including an incorrect hosting rewrite", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>Site</html>"));
    await expect(fetchDirectoryPage(endpoint, {}, fetcher)).rejects.toThrow();
  });

  it("rejects responses for a different offset", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"profiles":[],"total":100,"offset":0}'),
      );
    await expect(
      fetchDirectoryPage(endpoint, { offset: 50 }, fetcher),
    ).rejects.toThrow("wrong page");
  });

  it("rejects invalid offsets and overlong searches before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchDirectoryPage(endpoint, { offset: -1 }, fetcher),
    ).rejects.toThrow("page is invalid");
    await expect(
      fetchDirectoryPage(endpoint, { search: "x".repeat(256) }, fetcher),
    ).rejects.toThrow("too long");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts stalled requests and reports a timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const result = expect(
      fetchDirectoryPage(endpoint, {}, fetcher),
    ).rejects.toThrow("too long");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});
