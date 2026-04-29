import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStudioSource = (): string =>
  readFileSync(resolve(process.cwd(), "src/routes/studio/+page.svelte"), "utf8");

describe("Studio duplicate connector insertion", () => {
  it("uses a fresh connector-tree id scope for every flow insertion", () => {
    const source = readStudioSource();

    expect(source).toContain("idFactoryScope?: string;");
    expect(source).toContain('const baseIdPrefix = slugify(rootConnectorName) || "connector";');
    expect(source).toContain(
      "options.idFactoryScope\n      ? `${baseIdPrefix}-${options.idFactoryScope}`",
    );
    expect(source).toContain("idFactoryScope: `flow-${crypto.randomUUID()}`,");
    expect(source).toContain("idFactory: () => `${idPrefix}-${idIndex++}`");
  });
});
