import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const connectorPageRoutes = [
  "src/routes/c/[id]/+page.svelte",
  "src/routes/p/[id]/+page.svelte",
] as const;

describe("connector page layout", () => {
  it("keeps long connector titles from colliding with header actions", () => {
    const missing = connectorPageRoutes.flatMap((route) => {
      const source = readSource(route);
      const requiredChecks = [
        {
          label: ".connector-head-main keeps min-width constrained",
          passes: source.includes(".connector-head-main {\n    @apply min-w-0 flex-1;"),
        },
        {
          label: ".connector-title allows long names to wrap",
          passes: /\.connector-title\s*{[^}]*overflow-wrap:\s*anywhere;[^}]*}/s.test(source),
        },
        {
          label: ".connector-head-actions can wrap instead of overlapping",
          passes: source.includes(
            ".connector-head-actions {\n    @apply flex max-w-full shrink-0 flex-wrap gap-2 md:justify-end;",
          ),
        },
      ];

      return requiredChecks
        .filter((check) => !check.passes)
        .map((check) => `${route} -> ${check.label}`);
    });

    expect(missing).toEqual([]);
  });
});
