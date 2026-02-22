/** @type {import("prettier").Config} */
module.exports = {
  plugins: ["prettier-plugin-svelte", "prettier-plugin-organize-imports"],

  // Core formatting
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // Svelte-specific
  svelteSortOrder: "options-scripts-markup-styles",
  svelteStrictMode: true,
  svelteIndentScriptAndStyle: true,

  // TypeScript
  overrides: [
    {
      files: "*.ts",
      options: {
        parser: "typescript",
      },
    },
    {
      files: "*.svelte",
      options: {
        parser: "svelte",
      },
    },
  ],
};
