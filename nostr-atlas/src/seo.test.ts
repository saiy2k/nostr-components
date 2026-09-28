import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyDocumentSeo,
  DEFAULT_SITE_ORIGIN,
  HOME_DESCRIPTION,
  HOME_TITLE,
  homeDocumentSeo,
  robotsTxt,
  sitemapXml,
  xProfileUrl,
} from "./seo";

describe("Nostr Atlas homepage SEO", () => {
  it("describes the public homepage", () => {
    const seo = homeDocumentSeo(DEFAULT_SITE_ORIGIN);
    expect(seo.title).toBe(HOME_TITLE);
    expect(seo.description).toBe(HOME_DESCRIPTION);
    expect(seo.canonical).toBe("https://nostr-atlas.web.app/");
    expect(seo.image).toBe("https://nostr-atlas.web.app/og.png");
    const action = seo.jsonLd.potentialAction as {
      target: { urlTemplate: string };
    };
    expect(action.target.urlTemplate).toBe(
      "https://nostr-atlas.web.app/?q={search_term_string}",
    );
  });

  it("publishes only the homepage in the sitemap", () => {
    const xml = sitemapXml(DEFAULT_SITE_ORIGIN, ["/"]);
    expect(xml).toContain("<loc>https://nostr-atlas.web.app/</loc>");
    expect(xml).not.toContain("/x/");
    expect(robotsTxt(DEFAULT_SITE_ORIGIN)).toContain(
      "Sitemap: https://nostr-atlas.web.app/sitemap.xml",
    );
  });

  it("links an X handle without creating an Atlas profile URL", () => {
    expect(xProfileUrl("@Jack")).toBe("https://x.com/jack");
    expect(xProfileUrl("../jack")).toBeNull();
  });

  it("ships the crawlable homepage shell", () => {
    const html = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../index.html"),
      "utf8",
    );
    expect(html).toContain(HOME_TITLE);
    expect(html).toContain(HOME_DESCRIPTION);
    expect(html).toContain("https://nostr-atlas.web.app/");
    expect(html).toContain('id="hero-heading"');
    expect(html).not.toContain('id="profile-page"');
    expect(html).not.toContain("/x/");
  });

  it("regenerates the marked SEO block for another origin at build time", () => {
    const html = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../index.html"),
      "utf8",
    );
    const updated = applyDocumentSeo(
      html,
      homeDocumentSeo("https://atlas.example"),
    );
    expect(updated).toContain(
      '<link rel="canonical" href="https://atlas.example/"',
    );
    expect(updated).toContain('content="https://atlas.example/og.png"');
    expect(updated).toContain(HOME_TITLE);
    // Only the marked block is replaced; the page body stays untouched.
    expect(updated).toContain('id="hero-heading"');
    expect(() =>
      applyDocumentSeo("<html></html>", homeDocumentSeo(DEFAULT_SITE_ORIGIN)),
    ).toThrow(/SEO markers/);
  });
});
