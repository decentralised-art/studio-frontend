import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const connectorDeepLinkRoutes = [
  "src/routes/network/+page.svelte",
  "src/routes/account/+page.svelte",
  "src/routes/u/[id]/+page.svelte",
  "src/routes/f/[slug]/+page.svelte",
  "src/routes/p/[id]/+page.svelte",
  "src/routes/c/[id]/+page.svelte",
] as const;

describe("studio deep-link network kind", () => {
  it("uses connector kind in active connector open handlers", () => {
    const missing = connectorDeepLinkRoutes.filter((relativePath) => {
      const source = readSource(relativePath);
      return !source.includes('searchParams.set("network_kind", "connector")');
    });

    expect(missing).toEqual([]);
  });

  it("does not use legacy feature deep-link kind in active routes", () => {
    const violations = connectorDeepLinkRoutes.filter((relativePath) => {
      const source = readSource(relativePath);
      return source.includes('networkNodeStudioKind("feature")');
    });

    expect(violations).toEqual([]);
  });

  it("uses connector-native feed aliases in active routes", () => {
    const legacyFeedNames = connectorDeepLinkRoutes.filter((relativePath) => {
      const source = readSource(relativePath);
      return source.includes("ParticlePostFeed") || source.includes("chain-backed particle posts");
    });

    expect(legacyFeedNames).toEqual([]);
  });
});
