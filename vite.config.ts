import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],

  // --- SSR ---
  ssr: {
    noExternal: ["monaco-editor"],
  },

  // --- Dev / deps ---
  optimizeDeps: {
    include: ["monaco-editor"],
  },

  server: {
    proxy: {
      "/chain": {
        target: "https://api.decentralised.art",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/chain(\/|$)/, "/chain/"),
      },
      "/services": {
        target: "https://api.decentralised.art",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/services(\/|$)/, "/services/"),
      },
      "/api/auth": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/users": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/social": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "https://api.decentralised.art",
        changeOrigin: true,
        secure: true,
      },
    },
  },

  // --- Build ---
  build: {
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/d3-")) return "d3";
        },
      },
    },
  },

  // --- Vitest ---
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{js,ts}"],
  },

  // Tell Vitest to use the `browser` entry points in `package.json` files, even though it's running in Node
  resolve: process.env.VITEST
    ? {
        conditions: ["browser"],
      }
    : undefined,
});
