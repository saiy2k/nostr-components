import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { robotsTxt, siteOriginFrom, sitemapXml } from "./src/seo.ts";

const root = dirname(fileURLToPath(import.meta.url));
const origin = siteOriginFrom(process.env.VITE_SITE_ORIGIN);
const dist = join(root, "dist");

await writeFile(join(dist, "robots.txt"), robotsTxt(origin));
await writeFile(join(dist, "sitemap.xml"), sitemapXml(origin, ["/"]));
console.log(`Wrote homepage SEO files for ${origin}.`);
