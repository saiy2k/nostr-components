import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { injectSiteChrome, sitePageFromPath } from "./site-chrome";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("injectSiteChrome", () => {
  const header = readFileSync(resolve(root, "partials/site-header.html"), "utf8");
  const footer = readFileSync(resolve(root, "partials/site-footer.html"), "utf8");

  it("inserts the shared header, footer, and component scripts", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    const injected = injectSiteChrome(html, header, footer);

    expect(injected).not.toContain("<!-- site-header -->");
    expect(injected).not.toContain("<!-- site-footer -->");
    expect(injected).toContain('class="site-header"');
    expect(injected).toContain('class="site-nav"');
    expect(injected).toContain('data-nav="directory" aria-current="page"');
    expect(injected).not.toContain('data-nav="pulse" aria-current="page"');
    expect(injected.indexOf('class="brand"')).toBeLessThan(injected.indexOf('class="site-nav"'));
    expect(injected.indexOf('class="site-nav"')).toBeLessThan(
      injected.indexOf('class="header-actions"'),
    );
    expect(injected).toContain('class="site-footer"');
    expect(injected).toContain("nostr-like-button.es.js");
    expect(injected).toContain("nostr-zap-button.es.js");
    expect(injected.indexOf("<header")).toBeLessThan(injected.indexOf("<main"));
    expect(injected.indexOf("</footer>")).toBeLessThan(
      injected.indexOf('id="profile-dialog"'),
    );
    expect(injected.indexOf("nostr-zap-button.es.js")).toBeLessThan(
      injected.indexOf("/src/main.ts"),
    );
    expect(injected.match(/<header /g)).toHaveLength(1);
    expect(injected.match(/<footer /g)).toHaveLength(1);
  });

  it("marks Web Pulse as the current page", () => {
    const html = readFileSync(resolve(root, "pulse/index.html"), "utf8");
    const injected = injectSiteChrome(html, header, footer, "pulse");

    expect(injected).toContain('data-nav="pulse" aria-current="page"');
    expect(injected).not.toContain('data-nav="directory" aria-current="page"');
    expect(injected).toContain("/src/pulse/main.ts");
    expect(injected.indexOf("nostr-zap-button.es.js")).toBeLessThan(
      injected.indexOf("/src/pulse/main.ts"),
    );
  });

  it("recognizes the pulse page from a build path or a request path", () => {
    expect(sitePageFromPath("/pulse/")).toBe("pulse");
    expect(sitePageFromPath("nostr-atlas/pulse/index.html /pulse/")).toBe("pulse");
    expect(sitePageFromPath("/index.html /")).toBe("directory");
  });

  it("rejects a page that is missing a chrome marker", () => {
    expect(() => injectSiteChrome("<html></html>", header, footer)).toThrow(
      /chrome markers/,
    );
    expect(() =>
      injectSiteChrome("<!-- site-header --><html></html>", header, footer),
    ).toThrow(/chrome markers/);
  });
});
