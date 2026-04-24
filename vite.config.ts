import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const toBuildPath = (id: string) => id.replaceAll("\\", "/");
const isExpectedDependencyWarning = (code: unknown, message = "") =>
  ((code === "UNUSED_EXTERNAL_IMPORT" ||
    (message.includes("never used") && message.includes("@xyflow/system"))) &&
    message.includes("@xyflow/system")) ||
  (code === "CIRCULAR_DEPENDENCY" && message.includes("node_modules/d3-"));

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
      onLog(level, log, handler) {
        if (level === "warn" && isExpectedDependencyWarning(log.code, log.message ?? "")) {
          return;
        }

        handler(level, log);
      },
      onwarn(warning, warn) {
        const message = warning.message ?? "";
        if (isExpectedDependencyWarning(warning.code, message)) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks(id) {
          const buildPath = toBuildPath(id);
          if (buildPath.includes("node_modules/@xyflow/")) return "xyflow";
          if (buildPath.includes("node_modules/d3-")) return "d3";
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
