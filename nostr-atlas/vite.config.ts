import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { injectSiteChrome, sitePageFromPath } from "./src/site-chrome";

function siteChrome(): Plugin {
  const partials = resolve(__dirname, "partials");
  return {
    name: "atlas-site-chrome",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        return injectSiteChrome(
          html,
          readFileSync(resolve(partials, "site-header.html"), "utf8"),
          readFileSync(resolve(partials, "site-footer.html"), "utf8"),
          sitePageFromPath(`${ctx.filename} ${ctx.path}`),
        );
      },
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        pulse: resolve(__dirname, "pulse/index.html"),
      },
    },
  },
});
