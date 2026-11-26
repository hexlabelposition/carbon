import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// The landing page of Carbon, a static site on GitHub Pages: served from
// https://hexlabelposition.github.io/carbon/, hence the base.
export default defineConfig({
  site: "https://hexlabelposition.github.io",
  base: "/carbon",
  // Compressed HTML drops the spaces at line breaks before inline links.
  compressHTML: false,
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
