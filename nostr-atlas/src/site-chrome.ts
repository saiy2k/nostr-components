export const SITE_HEADER_MARKER = "<!-- site-header -->";
export const SITE_FOOTER_MARKER = "<!-- site-footer -->";

export type SitePage = "directory" | "pulse";

export function sitePageFromPath(path: string): SitePage {
  const normalized = path.replace(/\\/g, "/");
  return /(?:^|\/)pulse(?:\/|$)/.test(normalized) ? "pulse" : "directory";
}

export function markCurrentNav(header: string, page: SitePage): string {
  const token = `data-nav="${page}"`;
  if (!header.includes(token)) {
    throw new Error("Site navigation was not found.");
  }
  return header.replace(token, `${token} aria-current="page"`);
}

export function injectSiteChrome(
  html: string,
  header: string,
  footer: string,
  page: SitePage = "directory",
): string {
  if (!html.includes(SITE_HEADER_MARKER) || !html.includes(SITE_FOOTER_MARKER)) {
    throw new Error("Site chrome markers were not found.");
  }
  return html
    .replace(SITE_HEADER_MARKER, markCurrentNav(header.trimEnd(), page))
    .replace(SITE_FOOTER_MARKER, footer.trimEnd());
}
