import { describe, expect, it } from "vitest";
import type { ExploreParticle } from "../src/lib/data/exploreParticles";
import type { LibraryItem } from "../src/lib/data/studioLibrary";
import { upsertLibraryItem, upsertParticleItem } from "../src/lib/studio/studioRegistryState";

const owner = `0x${"12".repeat(20)}`;
const address = `0x${"ab".repeat(20)}`;
const local: LibraryItem = {
  id: "feature-score",
  name: "score",
  kind: "feature",
  authorId: owner,
  chainAddress: "0x0",
  ownerAddress: owner,
  summary: "Created locally.",
};

describe("Studio registry catalog updates", () => {
  it("updates verified provenance for an existing ID without duplication, reordering or mutation", () => {
    const other: LibraryItem = { ...local, id: "feature-other", name: "other" };
    const items = [other, local];
    const next = upsertLibraryItem(items, {
      ...local,
      chainAddress: address,
      summary: "Published on chain.",
    });
    expect(next.map((item) => item.id)).toEqual([other.id, local.id]);
    expect(next[0]).toBe(other);
    expect(next[1]).toMatchObject({ chainAddress: address, summary: "Published on chain." });
    expect(items[1].chainAddress).toBe("0x0");
  });

  it("preserves omitted metadata while allowing authoritative fields to be cleared", () => {
    const published = { ...local, chainAddress: address, runtimeSnippet: "return x;" };
    const items = upsertLibraryItem([published], {
      id: local.id,
      name: local.name,
      kind: local.kind,
      authorId: owner,
      summary: "Refreshed.",
      runtimeSnippet: undefined,
    });
    expect(items[0]).toMatchObject({
      chainAddress: address,
      ownerAddress: owner,
      summary: "Refreshed.",
    });
    expect(items[0].runtimeSnippet).toBeUndefined();
  });

  it("refreshes published Explore metadata for the existing particle ID", () => {
    const particle: ExploreParticle = {
      id: "score",
      name: "score",
      summary: "Published score",
      authorId: owner,
      viewId: "midi",
      createdAt: 1,
      createdLabel: "",
      ingredients: [],
      complexity: 1,
      transactionName: "score PT",
      dependencies: [],
    };
    const next = upsertParticleItem([particle], {
      ...particle,
      dependencies: ["pitch"],
      createdAt: 2,
    });
    expect(next).toEqual([{ ...particle, dependencies: ["pitch"], createdAt: 2 }]);
    expect(particle.dependencies).toEqual([]);
    expect(upsertParticleItem(next, { ...particle, id: "another" })).toHaveLength(2);
  });
});
