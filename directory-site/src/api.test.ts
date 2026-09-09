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
    const page = parseDirectoryPage({ profiles: [profile], nextCursor: null });
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
    expect(page.nextCursor).toBeNull();
  });

  it.each([
    null,
    { profiles: [], nextCursor: {} },
    { profiles: [], nextCursor: "twitter:alice/secret" },
    { profiles: [profile] },
    { profiles: [{ ...profile, verified: false }], nextCursor: null },
    { profiles: [{ ...profile, pubkey: "invalid" }], nextCursor: null },
    { profiles: [{ ...profile, id: "twitter:bob" }], nextCursor: null },
    { profiles: [{ ...profile, platform: "youtube" }], nextCursor: null },
    { profiles: Array(51).fill(profile), nextCursor: null },
  ])("rejects malformed responses: %j", (value) => {
    expect(() => parseDirectoryPage(value)).toThrow();
  });

  it("uses GET, a bounded page size and the supplied cursor", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ profiles: [profile], nextCursor: null })),
      );
    await fetchDirectoryPage(endpoint, "twitter:aaron", fetcher);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("limit")).toBe("50");
    expect(new URL(String(url)).searchParams.get("cursor")).toBe(
      "twitter:aaron",
    );
    expect(options).toMatchObject({
      method: "GET",
      credentials: "omit",
      signal: expect.any(AbortSignal),
    });
  });

  it("treats an empty directory as a successful response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"profiles":[],"nextCursor":null}'));
    await expect(fetchDirectoryPage(endpoint, null, fetcher)).resolves.toEqual({
      profiles: [],
      nextCursor: null,
    });
  });

  it("surfaces unavailable APIs and network failures instead of substituting demo data", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(fetchDirectoryPage(endpoint, null, fetcher)).rejects.toThrow(
      "503",
    );
    fetcher.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchDirectoryPage(endpoint, null, fetcher)).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("rejects non-JSON responses, including an incorrect hosting rewrite", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>Site</html>"));
    await expect(fetchDirectoryPage(endpoint, null, fetcher)).rejects.toThrow();
  });

  it("rejects repeated cursors to prevent endless pagination", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"profiles":[],"nextCursor":"twitter:alice"}'),
      );
    await expect(
      fetchDirectoryPage(endpoint, "twitter:alice", fetcher),
    ).rejects.toThrow("page cursor");
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
      fetchDirectoryPage(endpoint, null, fetcher),
    ).rejects.toThrow("too long");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});
