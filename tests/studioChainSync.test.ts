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
        connectorRecordCount: 3,
        connectorCount: 4,
        transformationCount: 5,
        conditionCount: 6,
      }),
    ).toBe(
      "Synced 2 sources · 3 connector records · 4 connectors · 5 transformations · 6 conditions.",
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

  it("hydrates saved runtime payloads into registry and library state", () => {
    const owner = "0xfa71ff2394596f824d69961293d095a50d322e4e";
    const withTransformation = mergeToolboxRuntimePayloadsIntoStudioState(
      emptyState(),
      "transformation",
      [["fallbackAdd", { name: "add", owner, sol_src: "return x + args[0];" }]],
      "fallback-author",
    );
    const withCondition = mergeToolboxRuntimePayloadsIntoStudioState(
      withTransformation,
      "condition",
      [["fallbackGate", { owner: "", sol_src: "return args[0] > 0;" }]],
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
});
