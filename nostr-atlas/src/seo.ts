export const DEFAULT_SITE_ORIGIN = "https://nostr-atlas.web.app";

export const HOME_TITLE = "Nostr Atlas — Receive zaps on X.com and YouTube";

export const HOME_DESCRIPTION =
  "Nostr Atlas lists verified X accounts linked to Nostr public keys, so supporters can find a creator and send Lightning zaps on X and YouTube.";

export const PULSE_TITLE = "Nostr Web Pulse — likes and zaps on the open web";

export const PULSE_DESCRIPTION =
  "Nostr Web Pulse shows the sats, zaps, and reactions Nostr Atlas has indexed across the open web.";

const HANDLE_SLUG = /^[a-z0-9_]{1,15}$/;
const SITEMAP_URL_LIMIT = 50_000;

export interface DocumentSeo {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly robots: string;
  readonly image: string;
  readonly jsonLd: Record<string, unknown>;
}

export function siteOriginFrom(value: string | undefined | null): string {
  const trimmed = value?.trim() || DEFAULT_SITE_ORIGIN;
  return trimmed.replace(/\/+$/, "");
}

export function handleSlug(handle: string): string | null {
  const slug = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!HANDLE_SLUG.test(slug)) return null;
  return slug;
}

export function xProfileUrl(handle: string): string | null {
  const slug = handleSlug(handle);
  return slug ? `https://x.com/${slug}` : null;
}

export function nip05ProfileUrl(nip05: string): string | null {
  const value = nip05.trim();
  if (!value || /[\s<>"']/.test(value)) return null;
  return `https://njump.me/${encodeURIComponent(value)}`;
}

export function homeDocumentSeo(origin: string): DocumentSeo {
  const site = siteOriginFrom(origin);
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    canonical: `${site}/`,
    robots: "index, follow",
    image: `${site}/og.png`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Nostr Atlas",
      url: `${site}/`,
      description: HOME_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${site}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  };
}

export function pulseDocumentSeo(origin: string): DocumentSeo {
  const site = siteOriginFrom(origin);
  return {
    title: PULSE_TITLE,
    description: PULSE_DESCRIPTION,
    canonical: `${site}/pulse/`,
    robots: "index, follow",
    image: `${site}/og.png`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Nostr Web Pulse",
      url: `${site}/pulse/`,
      description: PULSE_DESCRIPTION,
      isPartOf: {
        "@type": "WebSite",
        name: "Nostr Atlas",
        url: `${site}/`,
      },
    },
  };
}

export function pulseDomainDocumentSeo(origin: string, domain: string): DocumentSeo {
  const site = siteOriginFrom(origin);
  const title = `${domain} — Web Pulse — Nostr Atlas`;
  const description = `Sats, zaps, and reactions indexed for ${domain}.`;
  const canonical = `${site}/pulse/?domain=${encodeURIComponent(domain)}`;
  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    image: `${site}/og.png`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: canonical,
      description,
      isPartOf: {
        "@type": "WebSite",
        name: "Nostr Atlas",
        url: `${site}/`,
      },
    },
  };
}

export function documentSeoMarkup(seo: DocumentSeo): string {
  const json = JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c");
  return `<!-- seo:start -->
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeAttribute(seo.description)}" />
    <link rel="canonical" href="${escapeAttribute(seo.canonical)}" />
    <meta name="robots" content="${escapeAttribute(seo.robots)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Nostr Atlas" />
    <meta property="og:title" content="${escapeAttribute(seo.title)}" />
    <meta property="og:description" content="${escapeAttribute(seo.description)}" />
    <meta property="og:url" content="${escapeAttribute(seo.canonical)}" />
    <meta property="og:image" content="${escapeAttribute(seo.image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(seo.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(seo.description)}" />
    <meta name="twitter:image" content="${escapeAttribute(seo.image)}" />
    <script type="application/ld+json" id="seo-jsonld">${json}</script>
    <!-- seo:end -->`;
}

export function applyDocumentSeo(html: string, seo: DocumentSeo): string {
  const pattern = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;
  if (!pattern.test(html)) {
    throw new Error("SEO markers were not found.");
  }
  return html.replace(pattern, documentSeoMarkup(seo));
}

export function robotsTxt(origin: string): string {
  const site = siteOriginFrom(origin);
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
}

export function sitemapXml(origin: string, paths: readonly string[]): string {
  if (paths.length > SITEMAP_URL_LIMIT) {
    throw new Error(`Sitemap has ${paths.length} URLs; the limit is ${SITEMAP_URL_LIMIT}.`);
  }
  const site = siteOriginFrom(origin);
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(`${site}${path}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
