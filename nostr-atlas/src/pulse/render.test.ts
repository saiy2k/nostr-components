import { describe, expect, it } from "vitest";
import type { DisplayProfile, PulseActivity, PulseDomainRow } from "./api";
import {
  activityHtml,
  actorHtml,
  domainTableHtml,
  firstGrapheme,
  formatMsatsAsSats,
  formatSats,
  httpsPageUrl,
  mergeActivity,
  reactionBadge,
  urlPathAndQuery,
} from "./render";

const PUBKEY = "ab".repeat(32);
const NOW = 1_700_000_000;

const emptyCounts = {
  likeCount: 0,
  dislikeCount: 0,
  emojiCount: 0,
  reactionCount: 4,
  zapCount: 2,
  zapMsats: 1_500_000,
  urlCount: 1,
  lastActivityAt: NOW,
};

describe("Web Pulse rendering", () => {
  it("formats sats and keeps one grapheme, including a joined emoji", () => {
    expect(formatMsatsAsSats(1_500_000)).toBe("1,500");
    expect(formatMsatsAsSats(999)).toBe("0");
    expect(formatSats(1.5)).toBe("1.5");
    expect(firstGrapheme("🇺🇸👍")).toBe("🇺🇸");
    expect(firstGrapheme("👍🏻")).toBe("👍🏻");
    expect(firstGrapheme("👩‍👩‍👧‍👦")).toBe("👩‍👩‍👧‍👦");
    expect(firstGrapheme(`a${"\u0301".repeat(20)}`)).toBe("");
    expect(reactionBadge("emoji", "🇺🇸👍")).toContain("🇺🇸");
    expect(reactionBadge("emoji", "🇺🇸👍")).not.toContain("👍");
    expect(reactionBadge("emoji", `a${"\u0301".repeat(20)}`)).not.toContain("\u0301");
    expect(reactionBadge("like", "+")).toContain("+");
  });

  it("escapes text, links only https pages, and shows a path with its query", () => {
    expect(httpsPageUrl("http://example.com/a")).toBeNull();
    expect(httpsPageUrl("javascript:alert(1)")).toBeNull();
    expect(httpsPageUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(urlPathAndQuery("https://www.youtube.com/watch?v=abc")).toBe("/watch?v=abc");

    const row: PulseDomainRow = {
      ...emptyCounts,
      domain: `x.com"><script>`,
    };
    const table = domainTableHtml([row], "reactions", "", "ready", NOW);
    expect(table).toContain("&lt;script&gt;");
    expect(table).not.toContain(`x.com"><script>`);
    expect(table).toContain("1,500");
    expect(table).toContain('aria-sort="descending"');

    const activity: PulseActivity = {
      zaps: [
        {
          id: "cd".repeat(32),
          sats: 21,
          createdAt: NOW - 90,
          senderPubkey: null,
          comment: `<b>thanks</b>`,
          url: "http://example.com/secret",
        },
      ],
      reactions: [
        {
          pubkey: PUBKEY,
          reaction: "emoji",
          content: "🇺🇸",
          createdAt: NOW - 10,
          url: "https://example.com/ok",
          urlKey: null,
        },
      ],
    };
    const items = mergeActivity(activity);
    expect(items.map((item) => item.kind)).toEqual(["reaction", "zap"]);
    const html = activityHtml(items, 7, new Map(), NOW, "ready");
    expect(html).toContain("&lt;b&gt;thanks&lt;/b&gt;");
    expect(html).toContain("Anonymous");
    expect(html).not.toContain('href="http://example.com/secret"');
    expect(html).toContain('href="https://example.com/ok"');
    expect(html).toContain('aria-pressed="true">7D');
  });

  it("links a named profile and drops an http avatar", () => {
    const profiles = new Map<string, DisplayProfile>([
      [
        PUBKEY,
        {
          pubkey: PUBKEY,
          name: `<Ada>`,
          picture: "http://evil.test/a.png",
        },
      ],
    ]);
    const html = actorHtml(PUBKEY, profiles);
    expect(html).toContain("&lt;Ada&gt;");
    expect(html).toContain("https://njump.me/");
    expect(html).not.toContain("http://evil.test");
    expect(html).not.toContain("<img");
    expect(actorHtml(null, profiles)).toContain("Anonymous");
    expect(actorHtml(null, profiles)).not.toContain("href");
  });
});
