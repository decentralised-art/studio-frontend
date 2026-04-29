import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStudioSource = (): string =>
  readFileSync(resolve(process.cwd(), "src/routes/studio/+page.svelte"), "utf8");

describe("Studio tab bar layout", () => {
  it("keeps connector tabs horizontally scrollable while the add button remains visible", () => {
    const source = readStudioSource();

    expect(source).toContain('role="group"\n      aria-label="Connector tab strip"');
    expect(source).toContain(
      '<div class="tab-scroll" role="tablist" aria-label="Connector tabs" tabindex="0">',
    );
    expect(source).toContain('<button\n        type="button"\n        class="tab tab-add"');
    expect(source).toContain(".tab-bar {\n    @apply flex min-w-0 items-center gap-2 px-3 py-2;");
    expect(source).toContain(
      ".tab-scroll {\n    @apply flex min-w-0 flex-1 items-center gap-2 overflow-x-auto;",
    );
    expect(source).toContain("scrollbar-width: none;");
    expect(source).toContain(".tab-scroll::-webkit-scrollbar {\n    display: none;");
    expect(source).toContain("@apply inline-flex shrink-0 items-center gap-2;");
    expect(source).not.toContain(".tab-add {\n    @apply ml-auto");
  });
});
