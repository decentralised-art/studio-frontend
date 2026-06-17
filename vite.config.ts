import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const toBuildPath = (id: string) => id.replaceAll("\\", "/");
const toMonacoChunkName = (buildPath: string) => {
  const monacoPrefix = "node_modules/monaco-editor/esm/vs/";
  const monacoIndex = buildPath.indexOf(monacoPrefix);
  if (monacoIndex === -1) return null;

  const monacoPath = buildPath.slice(monacoIndex + monacoPrefix.length);
  if (monacoPath.startsWith("base/browser/")) return "monaco-base-browser";
  if (monacoPath.startsWith("base/common/")) return "monaco-base-common";
  if (monacoPath.startsWith("base/")) return "monaco-base";
  if (monacoPath.startsWith("platform/")) return "monaco-platform";
  if (monacoPath.startsWith("editor/contrib/")) return "monaco-editor-contrib";
  if (monacoPath.startsWith("editor/browser/widget/")) return "monaco-editor-widgets";
  if (monacoPath.startsWith("editor/browser/gpu/")) return "monaco-editor-gpu";
  if (monacoPath.startsWith("editor/browser/config/")) return "monaco-editor-browser-config";
  if (monacoPath.startsWith("editor/browser/")) return "monaco-editor-browser";
  if (monacoPath.startsWith("editor/common/config/")) return "monaco-editor-config";
  if (monacoPath.startsWith("editor/common/model/")) return "monaco-editor-model";
  if (monacoPath.startsWith("editor/common/viewModel/")) return "monaco-editor-view-model";
  if (monacoPath.startsWith("editor/common/cursor/")) return "monaco-editor-cursor";
  if (monacoPath.startsWith("editor/common/languages/")) return "monaco-editor-common";
  if (monacoPath.startsWith("editor/common/services/")) return "monaco-editor-model";
  if (monacoPath.startsWith("editor/common/diff/")) return "monaco-editor-diff";
  if (monacoPath.startsWith("editor/common/core/")) return "monaco-editor-common-core";
  if (monacoPath.startsWith("editor/common/tokens/")) return "monaco-editor-common";
  if (monacoPath.startsWith("editor/common/viewLayout/")) return "monaco-editor-view-layout";
  if (monacoPath.startsWith("editor/common/standalone/")) return "monaco-editor-common-standalone";
  if (monacoPath.startsWith("editor/common/")) return "monaco-editor-common";
  if (monacoPath.startsWith("editor/standalone/")) return "monaco-editor-standalone";
  if (monacoPath.startsWith("editor/")) return "monaco-editor-core";
  if (monacoPath.startsWith("language/")) return "monaco-language";
  if (monacoPath.startsWith("basic-languages/")) return "monaco-basic-languages";

  return "monaco";
};
const isExpectedDependencyWarning = (code: unknown, message = "") =>
  ((code === "UNUSED_EXTERNAL_IMPORT" ||
    (message.includes("never used") && message.includes("@xyflow/system"))) &&
    message.includes("@xyflow/system")) ||
  (code === "CIRCULAR_DEPENDENCY" && message.includes("node_modules/d3-"));

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), sveltekit()],

  // --- Dev / deps ---
  optimizeDeps: {
    include: ["monaco-editor", "tone"],
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
      "^/api(?:/|$)": {
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
          if (!isSsrBuild) {
            const monacoChunkName = toMonacoChunkName(buildPath);
            if (monacoChunkName) return monacoChunkName;
          }
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
}));
