import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { injectSiteChrome } from "./src/site-chrome";

function siteChrome(): Plugin {
  const partials = resolve(__dirname, "partials");
  return {
    name: "atlas-site-chrome",
    transformIndexHtml(html) {
      return injectSiteChrome(
        html,
        readFileSync(resolve(partials, "site-header.html"), "utf8"),
        readFileSync(resolve(partials, "site-footer.html"), "utf8"),
      );
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  base: "/",
  plugins: [siteChrome()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
