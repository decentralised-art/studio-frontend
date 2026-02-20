import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const rawBase = process.env.PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "";
const normalizedBase =
  rawBase && rawBase !== "/"
    ? `/${rawBase}`.replace(/\/+/g, "/").replace(/\/$/, "")
    : "";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    paths: {
      base: normalizedBase,
    },
  },
};

export default config;
