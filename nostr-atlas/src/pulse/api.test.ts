import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPulseActivity,
  fetchPulseOverview,
  parseDisplayProfiles,
  parsePulseActivity,
  parsePulseDomain,
  parsePulseDomainName,
  parsePulseOverview,
  parseUrlEvents,
  PulseNotFoundError,
} from "./api";

const PUBKEY = "ab".repeat(32);
const URL_KEY = "cd".repeat(32);

const counts = {
  likeCount: 3,
  dislikeCount: 1,
  emojiCount: 2,
  reactionCount: 6,
  zapCount: 4,
  zapMsats: 1_500_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Web Pulse response checks", () => {
  it("reads an overview, a domain, and activity", () => {
    const overview = parsePulseOverview({
      totals: { domainCount: 2, ...counts },
      domains: [
        {
          domain: "x.com",
          urlCount: 8,
          lastActivityAt: 1_700_000_000,
          ...counts,
        },
      ],
    });
    expect(overview.totals.domainCount).toBe(2);
    expect(overview.domains[0]?.domain).toBe("x.com");

    const domain = parsePulseDomain({
      domain: "x.com",
      totals: { urlCount: 8, lastActivityAt: null, ...counts },
      urls: [
        {
          url: "https://x.com/a/status/1",
          urlKey: URL_KEY,
          lastActivityAt: 1_700_000_000,
          ...counts,
        },
      ],
    });
    expect(domain.urls[0]?.urlKey).toBe(URL_KEY);

    const activity = parsePulseActivity({
      zaps: [
        {
          id: URL_KEY,
          sats: 1.5,
          createdAt: 1_700_000_000,
          senderPubkey: null,
          comment: "thanks",
          url: "https://x.com/a",
          domain: "x.com",
        },
      ],
      reactions: [
        {
          pubkey: PUBKEY,
          reaction: "emoji",
          content: "🇺🇸",
          createdAt: 1_700_000_100,
          urlKey: URL_KEY,
          url: "https://x.com/a",
          domain: "x.com",
        },
      ],
    });
    expect(activity.zaps[0]?.senderPubkey).toBeNull();
    expect(activity.reactions[0]?.reaction).toBe("emoji");
  });

  it("rejects a broken envelope and an unsafe domain", () => {
    expect(() => parsePulseOverview({ totals: counts, domains: [{}] })).toThrow(
      /invalid response/,
    );
    expect(() => parsePulseOverview({ totals: { domainCount: 1, ...counts }, domains: "no" })).toThrow(
      /invalid response/,
    );
    expect(() =>
      parseDisplayProfiles({
        profiles: [{ pubkey: PUBKEY, name: "<b>", picture: "http://evil.test/a.png" }],
      }),
    ).not.toThrow();
    expect(parsePulseDomainName("WWW.X.com", true)).toBe("x.com");
    expect(() => parsePulseDomainName("not a domain", true)).toThrow(/not valid/);
    expect(parsePulseDomainName("")).toBe("");
  });

  it("reads a URL's events without requiring the page URL again", () => {
    const events = parseUrlEvents({
      zaps: [
        {
          id: URL_KEY,
          sats: 21,
          createdAt: null,
          senderPubkey: PUBKEY,
          comment: "",
        },
      ],
      reactions: [
        {
          pubkey: PUBKEY,
          reaction: "like",
          content: "+",
          createdAt: 10,
          urlKey: null,
        },
      ],
    });
    expect(events.zaps[0]?.url).toBe("");
    expect(events.reactions[0]?.urlKey).toBeNull();
  });
});

describe("Web Pulse requests", () => {
  it("calls the overview with the directory credentials omitted", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ totals: { domainCount: 0, ...counts }, domains: [] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await fetchPulseOverview(
      "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles",
      { sort: "reactions", search: "x" },
    );

    const [input, init] = fetcher.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/getPulseOverview");
    expect(url.searchParams.get("sort")).toBe("reactions");
    expect(url.searchParams.get("search")).toBe("x");
    expect(init).toMatchObject({ credentials: "omit", method: "GET" });
  });

  it("turns a missing domain into a not-found error and a timeout into a slow response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("<html>missing</html>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    await expect(
      fetchPulseActivity(
        "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles",
        { days: 7, domain: "missing.test" },
      ),
    ).rejects.toThrow(/could not be loaded/);

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: "not_found" }), { status: 404 }),
      ),
    );
    await expect(
      fetchPulseActivity(
        "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles",
        { days: 7, domain: "missing.test" },
      ),
    ).rejects.toBeInstanceOf(PulseNotFoundError);

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      ),
    );
    await expect(
      fetchPulseActivity(
        "https://us-central1-nostr-components.cloudfunctions.net/listAtlasProfiles",
        { days: 1, domain: "" },
      ),
    ).rejects.toThrow(/too long/);
  });
});
