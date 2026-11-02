import { describe, expect, it } from "vitest";

import type { ExploreParticle } from "../src/lib/data/exploreParticles";
import {
  buildStudioChainSyncSources,
  buildStudioChainSyncSummary,
  mergeChainSyncSnapshotIntoStudioState,
  mergeFetchedChainParticleIntoStudioState,
  mergeToolboxRuntimePayloadsIntoStudioState,
  resolveToolboxRuntimeAuthorId,
} from "../src/lib/studio/studioChainSync";
import {
  createEmptyDeployedLibrary,
  createEmptyDeployedRegistry,
} from "../src/lib/studio/studioRegistryState";

const emptyState = () => ({
  registry: createEmptyDeployedRegistry(),
  library: createEmptyDeployedLibrary(),
  particles: [] as ExploreParticle[],
});

const particleMeta = (id: string): ExploreParticle => ({
  id,
  name: id,
  summary: "test",
  authorId: "0xb584a15f38c2014cff54fdb1b417428b51999276",
  viewId: "midi",
  createdAt: 1,
  createdLabel: "",
  ingredients: [],
  complexity: 1,
  transactionName: `${id} PT`,
  dependencies: [],
});

describe("Studio chain sync helpers", () => {
  it("builds source labels and sync summaries", () => {
    const sources = buildStudioChainSyncSources({
      currentUserChainSourceAddresses: ["b584a15f38c2014cff54fdb1b417428b51999276"],
      followedUserAddresses: [
        "0xfa71ff2394596f824d69961293d095a50d322e4e",
        "0xb584a15f38c2014cff54fdb1b417428b51999276",
      ],
    });

    expect(sources).toEqual([
      {
        address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        authorId: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        label: "0xb584a1...9276",
      },
      {
        address: "0xfa71ff2394596f824d69961293d095a50d322e4e",
        authorId: "0xfa71ff2394596f824d69961293d095a50d322e4e",
        label: "0xfa71ff...2e4e",
      },
    ]);
    expect(
      buildStudioChainSyncSummary({
        sourceCount: 2,
        connectorEntryCount: 3,
        connectorCount: 4,
        transformationCount: 5,
        conditionCount: 6,
      }),
    ).toBe(
      "Synced 2 sources · 3 connector entries · 4 connectors · 5 transformations · 6 conditions.",
    );
  });

  it("merges account snapshots with runtime placeholders and de-duplicated lists", () => {
    const existingParticle = particleMeta("existing");
    const nextParticle = particleMeta("pitch");
    const merged = mergeChainSyncSnapshotIntoStudioState(
      {
        ...emptyState(),
        library: {
          features: [{ id: "feature-existing", name: "existing", kind: "feature", authorId: "a" }],
          transformations: [],
          conditions: [],
        },
        particles: [existingParticle],
      },
      {
        registry: {
          connectors: {
            pitch: {
              name: "pitch",
              dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
            },
          },
          features: { pitch: { name: "pitch", dimensions: [] } },
          particles: { pitch: { name: "pitch", featureName: "pitch", composites: [] } },
          transformations: { add: { argc: 1 } },
          conditions: { gate: { argc: 2 } },
        },
        library: {
          features: [
            { id: "feature-existing", name: "existing", kind: "feature", authorId: "b" },
            { id: "feature-pitch", name: "pitch", kind: "feature", authorId: "b" },
          ],
          transformations: [
            { id: "transform-add", name: "add", kind: "transformation", authorId: "b" },
          ],
          conditions: [{ id: "condition-gate", name: "gate", kind: "condition", authorId: "b" }],
        },
        particles: [existingParticle, nextParticle],
      },
    );

    expect(merged.registry.connectors.pitch.name).toBe("pitch");
    expect(merged.registry.transformations.add.run(12, [1])).toBe(12);
    expect(merged.registry.conditions.gate.check([])).toBe(true);
    expect(merged.library.features.map((item) => item.id)).toEqual([
      "feature-existing",
      "feature-pitch",
    ]);
    expect(merged.particles.map((item) => item.id)).toEqual(["existing", "pitch"]);
  });

  it("merges fetched connector details into deployed registry state", () => {
    const connector = {
      name: "pitch",
      chainAddress: `0x${"ab".repeat(20)}`,
      dimensions: [
        {
          transformations: [
            { name: "add", args: [1] },
            { name: "add", args: [2] },
          ],
          bindings: {},
        },
      ],
      conditionName: "gate",
      conditionArgs: [1, 2],
    };
    const merged = mergeFetchedChainParticleIntoStudioState(
      emptyState(),
      {
        registry: {
          connector,
          feature: { name: "pitch", dimensions: [] },
          particle: { name: "pitch", featureName: "pitch", composites: [] },
        },
        particleMeta: particleMeta("pitch"),
      },
      "fallback-author",
    );

    expect(merged.merged).toBe(true);
    expect(merged.state.registry.transformations.add.argc).toBe(1);
    expect(merged.state.registry.conditions.gate.argc).toBe(2);
    expect(merged.state.library.features[0]).toMatchObject({
      id: "feature-pitch",
      summary: "Fetched from chain on demand.",
    });
    expect(merged.state.particles[0].id).toBe("pitch");
  });

  it("fills missing dependency placeholders without replacing authoritative runtime metadata", () => {
    const state = emptyState();
    const transformation = { argc: 0, run: (x: number) => x + 100 };
    const condition = { argc: 0, check: () => false };
    state.registry.transformations.add = transformation;
    state.registry.conditions.gate = condition;
    const result = mergeFetchedChainParticleIntoStudioState(
      state,
      {
        registry: {
          connector: {
            name: "score",
            chainAddress: `0x${"ab".repeat(20)}`,
            dimensions: [
              {
                transformations: [
                  { name: "add", args: [1, 2, 3] },
                  { name: "missing", args: [1, 2] },
                ],
                bindings: {},
              },
            ],
            conditionName: "gate",
            conditionArgs: [1, 2],
          },
        },
      },
      "owner",
    );
    expect(result.state.registry.transformations.add).toBe(transformation);
    expect(result.state.registry.conditions.gate).toBe(condition);
    expect(result.state.registry.transformations.add.argc).toBe(0);
    expect(result.state.registry.transformations.add.run(1, [])).toBe(101);
    expect(result.state.registry.conditions.gate.check([])).toBe(false);
    expect(result.state.registry.transformations.missing.argc).toBe(2);
  });

  it("refreshes local connector catalog provenance after the same definition is published", () => {
    const owner = `0x${"12".repeat(20)}`;
    const address = `0x${"ab".repeat(20)}`;
    const connector = {
      name: "score_study_v2",
      ownerAddress: owner,
      chainAddress: "0x0",
      dimensions: [{ transformations: [], bindings: {} }],
    };
    const local = mergeFetchedChainParticleIntoStudioState(
      emptyState(),
      { registry: { connector } },
      owner,
    );
    const published = mergeFetchedChainParticleIntoStudioState(
      local.state,
      {
        registry: { connector: { ...connector, chainAddress: address } },
        particleMeta: { ...particleMeta(connector.name), authorId: owner },
      },
      owner,
    );
    expect(published.state.library.features).toEqual([
      expect.objectContaining({
        name: connector.name,
        chainAddress: address,
        ownerAddress: owner,
        summary: "Fetched from chain on demand.",
      }),
    ]);
    expect(local.state.library.features[0].chainAddress).toBe("0x0");
    expect(published.state.registry.connectors[connector.name].chainAddress).toBe(address);
    expect(published.state.particles.map((item) => item.id)).toEqual([connector.name]);
  });

  it.each(["transformation", "condition"] as const)(
    "refreshes %s library provenance and argument metadata after publication",
    (kind) => {
      const owner = `0x${"12".repeat(20)}`;
      const address = `0x${"ab".repeat(20)}`;
      const local = mergeToolboxRuntimePayloadsIntoStudioState(
        emptyState(),
        kind,
        [["step", { name: "step", address: "0x0", owner, args_count: 2, sol_src: "return true;" }]],
        owner,
      );
      const published = mergeToolboxRuntimePayloadsIntoStudioState(
        local,
        kind,
        [["step", { name: "step", address, owner, args_count: 0 }]],
        owner,
      );
      const key = kind === "transformation" ? "transformations" : "conditions";
      expect(published.library[key]).toEqual([
        expect.objectContaining({
          name: "step",
          chainAddress: address,
          ownerAddress: owner,
          summary: "Published on chain.",
          runtimeSnippet: undefined,
        }),
      ]);
      expect(published.registry[key].step.argc).toBe(0);
      expect(local.library[key][0].chainAddress).toBe("0x0");
    },
  );

  it("uses authoritative args_count without source and over legacy source inference", () => {
    const state = mergeToolboxRuntimePayloadsIntoStudioState(
      emptyState(),
      "transformation",
      [["add", { args_count: 3, address: `0x${"ab".repeat(20)}` }]],
      "owner",
    );
    const next = mergeToolboxRuntimePayloadsIntoStudioState(
      state,
      "condition",
      [["gate", { args_count: 2, sol_src: "return true;", address: `0x${"ab".repeat(20)}` }]],
      "owner",
    );
    expect(next.registry.transformations.add.argc).toBe(3);
    expect(next.registry.conditions.gate.argc).toBe(2);
    expect(next.library.transformations[0].runtimeSnippet).toBeUndefined();
  });

  it("hydrates saved runtime payloads into registry and library state", () => {
    const owner = "0xfa71ff2394596f824d69961293d095a50d322e4e";
    const withTransformation = mergeToolboxRuntimePayloadsIntoStudioState(
      emptyState(),
      "transformation",
      [
        [
          "fallbackAdd",
          { name: "add", owner, sol_src: "return x + args[0];", address: `0x${"ab".repeat(20)}` },
        ],
      ],
      "fallback-author",
    );
    const withCondition = mergeToolboxRuntimePayloadsIntoStudioState(
      withTransformation,
      "condition",
      [
        [
          "fallbackGate",
          { owner: "", sol_src: "return args[0] > 0;", address: `0x${"ab".repeat(20)}` },
        ],
      ],
      "fallback-author",
    );

    expect(resolveToolboxRuntimeAuthorId(owner, "fallback-author")).toBe(owner);
    expect(resolveToolboxRuntimeAuthorId("", "fallback-author")).toBe("fallback-author");
    expect(withCondition.registry.transformations.add.argc).toBe(1);
    expect(withCondition.registry.conditions.fallbackGate.argc).toBe(1);
    expect(withCondition.library.transformations[0]).toMatchObject({
      id: "transform-add",
      authorId: owner,
      runtimeSnippet: "return x + args[0];",
    });
    expect(withCondition.library.conditions[0]).toMatchObject({
      id: "condition-fallbackGate",
      authorId: "fallback-author",
    });
  });

  it("keeps foreign and unclassified local runtime payloads out of the toolbox", () => {
    const owner = `0x${"12".repeat(20)}`;
    const state = mergeToolboxRuntimePayloadsIntoStudioState(
      emptyState(),
      "transformation",
      [
        ["Mine", { name: "Mine", address: "0x0", owner, args_count: 1 }],
        [
          "Foreign",
          { name: "Foreign", address: "0x0", owner: `0x${"34".repeat(20)}`, args_count: 1 },
        ],
        ["Unknown", { name: "Unknown", args_count: 1 }],
      ],
      owner,
    );
    expect(Object.keys(state.registry.transformations)).toEqual(["Mine"]);
    expect(state.library.transformations).toHaveLength(1);
    expect(state.library.transformations[0]).toMatchObject({
      name: "Mine",
      chainAddress: "0x0",
      ownerAddress: owner,
    });
  });

  it("keeps an owned local connector out of Explore and does not invent dependency provenance", () => {
    const owner = `0x${"12".repeat(20)}`;
    const fetched = {
      registry: {
        connector: {
          name: "Local",
          chainAddress: "0x0",
          ownerAddress: owner,
          dimensions: [{ transformations: [{ name: "Dependency", args: [1] }], bindings: {} }],
        },
      },
      particleMeta: particleMeta("Local"),
    };
    expect(
      mergeFetchedChainParticleIntoStudioState(emptyState(), fetched, `0x${"34".repeat(20)}`)
        .merged,
    ).toBe(false);
    const result = mergeFetchedChainParticleIntoStudioState(emptyState(), fetched, owner);
    expect(result.merged).toBe(true);
    expect(result.state.particles).toEqual([]);
    expect(result.state.library.features[0].chainAddress).toBe("0x0");
    expect(result.state.library.transformations).toEqual([]);
    expect(result.state.registry.transformations.Dependency.argc).toBe(1);
  });
});
