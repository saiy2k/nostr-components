import type { DocumentSeo } from "./seo";

export { escapeHtml } from "./seo";

export function applyDocumentSeo(seo: DocumentSeo): void {
  document.title = seo.title;
  setMeta("description", seo.description);
  setMeta("robots", seo.robots);
  setMeta("twitter:title", seo.title);
  setMeta("twitter:description", seo.description);
  setMeta("twitter:image", seo.image);
  setProperty("og:title", seo.title);
  setProperty("og:description", seo.description);
  setProperty("og:url", seo.canonical);
  setProperty("og:image", seo.image);
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = seo.canonical;
  const jsonLd = document.querySelector<HTMLScriptElement>("#seo-jsonld");
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c");
  }
}

function setMeta(name: string, content: string): void {
  const element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (element) element.content = content;
}

function setProperty(property: string, content: string): void {
  const element = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (element) element.content = content;
}

export function configureSiteActions(siteOrigin: string): void {
  const origin = siteOrigin.replace(/\/+$/, "");
  const pathname = window.location.pathname || "/";
  const pagePath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const pageUrl = `${origin}${pagePath}`;
  document.querySelector("nostr-like-button")?.setAttribute("url", pageUrl);
  document.querySelector("nostr-zap-button")?.setAttribute("url", pageUrl);
}

export function showToast(message: string): void {
  const toast = document.querySelector<HTMLDivElement>("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}
