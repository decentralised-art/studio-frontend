import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const isProdBuild = process.env.NODE_ENV === "production";
const rawBase =
  process.env.PUBLIC_BASE_PATH?.trim() ??
  process.env.BASE_PATH?.trim() ??
  (isProdBuild ? "/app" : "");
const normalizedBase =
  rawBase && rawBase !== "/" ? `/${rawBase}`.replace(/\/+/g, "/").replace(/\/$/, "") : "";

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
