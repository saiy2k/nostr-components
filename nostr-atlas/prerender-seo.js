import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDocumentSeo,
  homeDocumentSeo,
  pulseDocumentSeo,
  robotsTxt,
  siteOriginFrom,
  sitemapXml,
} from "./src/seo.ts";

const root = dirname(fileURLToPath(import.meta.url));
const origin = siteOriginFrom(process.env.VITE_SITE_ORIGIN);
const dist = join(root, "dist");

// Regenerate the marked SEO block so the shipped HTML always matches seo.ts,
// even when VITE_SITE_ORIGIN points at another origin.
const indexPath = join(dist, "index.html");
const html = await readFile(indexPath, "utf8");
await writeFile(indexPath, applyDocumentSeo(html, homeDocumentSeo(origin)));

const pulsePath = join(dist, "pulse/index.html");
const pulseHtml = await readFile(pulsePath, "utf8");
await writeFile(pulsePath, applyDocumentSeo(pulseHtml, pulseDocumentSeo(origin)));

await writeFile(join(dist, "robots.txt"), robotsTxt(origin));
await writeFile(join(dist, "sitemap.xml"), sitemapXml(origin, ["/", "/pulse/"]));
console.log(`Wrote homepage and Web Pulse SEO files for ${origin}.`);
