import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://tikvite.org",
  output: "server",
  adapter: cloudflare()
});