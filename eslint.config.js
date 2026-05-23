import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));

export default defineConfig(
  // ---------------------------------------------
  // Ignore files from .gitignore
  // ---------------------------------------------
  includeIgnoreFile(gitignorePath),
  {
    ignores: ["static/worlds/tone-world/hydra-synth.js"],
  },

  // ---------------------------------------------
  // Base JS + TS recommended
  // ---------------------------------------------
  js.configs.recommended,
  ...ts.configs.recommended,

  // ---------------------------------------------
  // Svelte recommended (flat config)
  // ---------------------------------------------
  ...svelte.configs.recommended,

  // ---------------------------------------------
  // Global language options
  // ---------------------------------------------
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      // typescript-eslint strongly recommends disabling this
      // in TS projects
      "no-undef": "off",

      // -------------------------
      // Svelte 5 / modern rules
      // -------------------------
      "svelte/no-at-html-tags": "error",
      "svelte/no-target-blank": "error",
      "svelte/valid-compile": "error",

      // -------------------------
      // TS safety (recommended)
      // -------------------------
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },

  // ---------------------------------------------
  // Svelte + TypeScript parsing
  // ---------------------------------------------
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },

  // ---------------------------------------------
  // Prettier — disables formatting rules
  // ---------------------------------------------
  prettier,
);
