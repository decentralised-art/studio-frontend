import { describe, expect, it } from "vitest";

import { buildStudioRuntime } from "../src/lib/studio/studioRuntime";

describe("studioRuntime static RI preservation", () => {
  it("keeps visible network-node static RI when the cached registry entry is stale", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: {
              kind: "connector",
              label: "test_score_root_05052026",
              fromNetwork: true,
              dimensions: 1,
              staticRi: {
                "4": { startPoint: 2520, transformationShift: 0 },
              },
            },
          },
        ],
        edges: [],
      },
      {
        rootLabel: "test_score_root_05052026",
        rootParticleId: "test_score_root_05052026",
      },
      {
        connectors: {
          test_score_root_05052026: {
            name: "test_score_root_05052026",
            dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
          },
        },
      },
    );

    expect(runtime.registry.connectors.test_score_root_05052026?.staticRi).toEqual({
      "4": { startPoint: 2520, transformationShift: 0 },
    });
  });

  it("keeps synced registry static RI when it is present", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: {
              kind: "connector",
              label: "test_score_root_05052026",
              fromNetwork: true,
              dimensions: 1,
              staticRi: {
                "4": { startPoint: 111, transformationShift: 0 },
              },
            },
          },
        ],
        edges: [],
      },
      {
        rootLabel: "test_score_root_05052026",
        rootParticleId: "test_score_root_05052026",
      },
      {
        connectors: {
          test_score_root_05052026: {
            name: "test_score_root_05052026",
            dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
            staticRi: {
              "4": { startPoint: 2520, transformationShift: 0 },
            },
          },
        },
      },
    );

    expect(runtime.registry.connectors.test_score_root_05052026?.staticRi).toEqual({
      "4": { startPoint: 2520, transformationShift: 0 },
    });
  });
});
