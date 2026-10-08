export const SITE_HEADER_MARKER = "<!-- site-header -->";
export const SITE_FOOTER_MARKER = "<!-- site-footer -->";

export function injectSiteChrome(
  html: string,
  header: string,
  footer: string,
): string {
  if (!html.includes(SITE_HEADER_MARKER) || !html.includes(SITE_FOOTER_MARKER)) {
    throw new Error("Site chrome markers were not found.");
  }
  return html
    .replace(SITE_HEADER_MARKER, header.trimEnd())
    .replace(SITE_FOOTER_MARKER, footer.trimEnd());
}
