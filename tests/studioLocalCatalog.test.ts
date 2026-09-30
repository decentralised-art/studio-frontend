import { describe, expect, it } from "vitest";
import {
  buildStudioLocalLibrary,
  listStudioLocalEntities,
  type StudioLocalPublicationStep,
} from "../src/lib/studio/studioLocalCatalog";
import {
  createPublicationDraft,
  createPublicationStore,
  type PublicationRecord,
} from "../src/lib/studio/studioPublication";

const record = (
  entity: StudioLocalPublicationStep,
  stage: PublicationRecord["stage"] = "draft",
): PublicationRecord => ({
  kind: entity.kind,
  name: entity.name,
  fingerprint: JSON.stringify(entity.body),
  stage,
});

const connector = (
  name: string,
  dimension: {
    composite?: string;
    bindings?: Record<string, string>;
    transformations?: Array<{ name: string; args: number[] }>;
  } = {},
  condition?: string,
): StudioLocalPublicationStep => ({
  kind: "connector",
  name,
  body: {
    name,
    dimensions: [{ transformations: [], ...dimension }],
    ...(condition ? { condition_name: condition } : {}),
  },
});

const transformation = (name: string): StudioLocalPublicationStep => ({
  kind: "transformation",
  name,
  body: { name, sol_src: "return x + 1;" },
});

describe("Studio Local catalog", () => {
  it("reuses API/owner-scoped created records after reload and preserves their definitions", async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    const scope = "https://server.test/chain:owner-a";
    const store = createPublicationStore(scope, storage);
    const created = connector("melody");
    await createPublicationDraft({
      ...created,
      store,
      createDraft: async () => ({ address: "0x0" }),
    });
    const reloaded = createPublicationStore(scope, storage);
    const [entity] = listStudioLocalEntities(reloaded.list());
    expect(entity).toEqual({ ...created, stage: "draft" });
    entity.body.name = "edited";
    expect(listStudioLocalEntities(reloaded.list())[0].name).toBe("melody");
    expect(listStudioLocalEntities(reloaded.list())[0].body.name).toBe("melody");
    expect(createPublicationStore("https://other.test/chain:owner-a", storage).list()).toEqual([]);
    expect(createPublicationStore("https://server.test/chain:owner-b", storage).list()).toEqual([]);
    await expect(
      createPublicationDraft({
        ...created,
        body: { ...created.body, changed: true },
        store: reloaded,
        createDraft: async () => undefined,
      }),
    ).rejects.toThrow(/different content/);
  });

  it("lists created and pending entities under the current owner, excluding mined records", () => {
    const records = [
      record(connector("melody")),
      record(transformation("step"), "pending"),
      record({
        kind: "condition",
        name: "allow",
        body: { name: "allow", sol_src: "return true;" },
      }),
      record(connector("published"), "mined"),
    ];
    const library = buildStudioLocalLibrary(records, "owner-a");
    expect(library.features.map((item) => item.name)).toEqual(["melody"]);
    expect(library.transformations[0]).toMatchObject({
      id: "transform-step",
      authorId: "owner-a",
      summary: "Publication pending.",
    });
    expect(library.conditions[0]).toMatchObject({ name: "allow", authorId: "owner-a" });
    expect(listStudioLocalEntities(records)).toHaveLength(4);
  });
});
