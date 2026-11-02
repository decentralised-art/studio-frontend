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

  it("removes stale browser-local records after authoritative publication in another session", () => {
    const records = [
      record(connector("score")),
      record(transformation("step"), "pending"),
      record({ kind: "condition", name: "gate", body: { name: "gate", sol_src: "return true;" } }),
      record(connector("still-local")),
    ];
    const address = `0x${"ab".repeat(20)}`;
    const verified = {
      features: [
        {
          id: "feature-score",
          name: "score",
          kind: "feature" as const,
          authorId: "owner-a",
          chainAddress: address,
        },
      ],
      transformations: [
        {
          id: "transform-step",
          name: "step",
          kind: "transformation" as const,
          authorId: "owner-a",
          chainAddress: address,
        },
      ],
      conditions: [
        {
          id: "condition-gate",
          name: "gate",
          kind: "condition" as const,
          authorId: "owner-a",
          chainAddress: address,
        },
      ],
    };
    const library = buildStudioLocalLibrary(records, "owner-a", verified);
    expect(library.features.map((item) => item.name)).toEqual(["still-local"]);
    expect(library.transformations).toEqual([]);
    expect(library.conditions).toEqual([]);
    expect(records.map((item) => item.stage)).toEqual(["draft", "pending", "draft", "draft"]);
  });

  it("keeps local and unverified entries and distinguishes equal names of different kinds", () => {
    const records = [
      record(connector("same")),
      record(transformation("same")),
      record(connector("local")),
    ];
    const library = buildStudioLocalLibrary(records, "owner-a", {
      features: [
        {
          id: "feature-same",
          name: "same",
          kind: "feature",
          authorId: "owner-a",
          chainAddress: `0x${"ab".repeat(20)}`,
        },
        {
          id: "feature-local",
          name: "local",
          kind: "feature",
          authorId: "owner-a",
          chainAddress: "0x0",
        },
      ],
      transformations: [
        { id: "transform-same", name: "same", kind: "transformation", authorId: "owner-a" },
      ],
      conditions: [],
    });
    expect(library.features.map((item) => item.name)).toEqual(["local"]);
    expect(library.transformations.map((item) => item.name)).toEqual(["same"]);
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
