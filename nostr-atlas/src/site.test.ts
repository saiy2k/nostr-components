import { afterEach, describe, expect, it, vi } from "vitest";
import { homeDocumentSeo } from "./seo";
import {
  applyDocumentSeo,
  configureSiteActions,
  escapeHtml,
  showToast,
} from "./site";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("site chrome helpers", () => {
  it("escapes text that would break markup", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;",
    );
  });

  it("points header actions at the current page on the site origin", () => {
    const like = { setAttribute: vi.fn() };
    const zap = { setAttribute: vi.fn() };
    const location = { pathname: "/" };
    vi.stubGlobal("document", {
      querySelector(selector: string) {
        if (selector === "nostr-like-button") return like;
        if (selector === "nostr-zap-button") return zap;
        return null;
      },
    });
    vi.stubGlobal("window", { location });

    configureSiteActions("https://nostr-atlas.web.app/");

    expect(like.setAttribute).toHaveBeenCalledWith(
      "url",
      "https://nostr-atlas.web.app/",
    );
    expect(zap.setAttribute).toHaveBeenCalledWith(
      "url",
      "https://nostr-atlas.web.app/",
    );

    location.pathname = "/pulse";
    configureSiteActions("https://nostr-atlas.web.app");
    expect(like.setAttribute).toHaveBeenLastCalledWith(
      "url",
      "https://nostr-atlas.web.app/pulse/",
    );
  });

  it("writes the live document SEO tags", () => {
    const elements = new Map<string, { content?: string; href?: string; textContent?: string }>();
    const title = { textContent: "" };
    elements.set('meta[name="description"]', { content: "" });
    elements.set('meta[name="robots"]', { content: "" });
    elements.set('meta[name="twitter:title"]', { content: "" });
    elements.set('meta[name="twitter:description"]', { content: "" });
    elements.set('meta[name="twitter:image"]', { content: "" });
    elements.set('meta[property="og:title"]', { content: "" });
    elements.set('meta[property="og:description"]', { content: "" });
    elements.set('meta[property="og:url"]', { content: "" });
    elements.set('meta[property="og:image"]', { content: "" });
    elements.set('link[rel="canonical"]', { href: "" });
    elements.set("#seo-jsonld", title);
    vi.stubGlobal("document", {
      title: "",
      querySelector(selector: string) {
        return elements.get(selector) ?? null;
      },
    });

    applyDocumentSeo(homeDocumentSeo("https://nostr-atlas.web.app"));

    expect(document.title).toBe(
      "Nostr Atlas — Receive zaps on X.com and YouTube",
    );
    expect(elements.get('link[rel="canonical"]')?.href).toBe(
      "https://nostr-atlas.web.app/",
    );
    expect(title.textContent).toContain("SearchAction");
  });

  it("shows a toast and hides it after the timeout", () => {
    vi.useFakeTimers();
    const toast = {
      textContent: "",
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
    vi.stubGlobal("document", {
      querySelector(selector: string) {
        return selector === "#toast" ? toast : null;
      },
    });
    vi.stubGlobal("window", { setTimeout });

    showToast("Saved");

    expect(toast.textContent).toBe("Saved");
    expect(toast.classList.add).toHaveBeenCalledWith("visible");
    vi.advanceTimersByTime(2600);
    expect(toast.classList.remove).toHaveBeenCalledWith("visible");
  });
});
