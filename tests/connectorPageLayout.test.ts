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
      return [
        ".connector-head-main {\n    @apply min-w-0 flex-1;",
        ".connector-title {\n    @apply mt-1 text-2xl md:text-[1.8rem] font-semibold text-white leading-tight;\n    overflow-wrap: anywhere;",
        ".connector-head-actions {\n    @apply flex max-w-full shrink-0 flex-wrap gap-2 md:justify-end;",
      ]
        .filter((phrase) => !source.includes(phrase))
        .map((phrase) => `${route} -> '${phrase}'`);
    });

    expect(missing).toEqual([]);
  });
});
