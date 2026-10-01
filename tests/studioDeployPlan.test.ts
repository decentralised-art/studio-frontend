import { describe, expect, it } from "vitest";

import { buildStudioDeployPlan } from "../src/lib/studio/studioDeployPlan";
import type { StudioEdge, StudioNode } from "../src/lib/studio/studioRuntime";

const connectorNode = (
  id: string,
  name: string,
  options: Partial<StudioNode["data"]> = {},
): StudioNode => ({
  id,
  data: {
    label: name,
    kind: "connector",
    dimensions: 1,
    fromNetwork: false,
    ...options,
  },
});

const edge = (source: string, target: string): StudioEdge => ({
  source,
  sourceHandle: "dim-0",
  target,
  targetHandle: "in",
  data: { relation: "composite" },
});

describe("studio deploy plan", () => {
  it("allows a local connector named time when the server registry is empty", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "time" },
      nodes: [connectorNode("time-node", "time")],
      edges: [],
    });

    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([["connector", "time"]]);
  });

  it("rejects a local connector whose name is in the deployed registry", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "time" },
      nodes: [connectorNode("time-node", "time")],
      edges: [],
      runtimeOverrides: {
        connectors: {
          time: { name: "time", dimensions: [{ transformations: [], bindings: {} }] },
        },
      },
    });

    expect(plan.ok).toBe(false);
    expect(plan.errors).toContain("Connector already exists in registry: time");
  });

  it("orders local connector deploy requests from leaves to root", () => {
    const nodes = [
      connectorNode("root-node", "root", { tabRoot: true } as Partial<StudioNode["data"]>),
      connectorNode("child-node", "child"),
      connectorNode("leaf-node", "leaf"),
    ];
    const edges = [edge("root-node", "child-node"), edge("child-node", "leaf-node")];

    const plan = buildStudioDeployPlan({
      activeTab: { label: "root" },
      nodes,
      edges,
    });

    expect(plan.ok).toBe(true);
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([
      ["connector", "leaf"],
      ["connector", "child"],
      ["connector", "root"],
    ]);
    expect(plan.preview.deploy_requests.map((request) => request.name)).toEqual([
      "leaf",
      "child",
      "root",
    ]);
    expect(plan.preview.summary).toEqual({
      total_requests: 3,
      conditions: 0,
      transformations: 0,
      connectors: 3,
    });
  });

  it("preserves local connector names exactly as they appear in the graph", () => {
    const nodes = [
      connectorNode("root-node", "UnTitlEd_cpoesea-2", {
        tabRoot: true,
      } as Partial<StudioNode["data"]>),
      connectorNode("child-node", "Child-Connector_A"),
    ];
    const edges = [edge("root-node", "child-node")];

    const plan = buildStudioDeployPlan({
      activeTab: { label: "UnTitlEd_cpoesea-2" },
      nodes,
      edges,
    });

    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.rootConnectorName).toBe("UnTitlEd_cpoesea-2");
    expect(plan.steps.map((step) => step.name)).toEqual([
      "Child-Connector_A",
      "UnTitlEd_cpoesea-2",
    ]);
    expect(plan.preview.deploy_requests.map((request) => request.body.name)).toEqual([
      "Child-Connector_A",
      "UnTitlEd_cpoesea-2",
    ]);
  });

  it("keeps on-chain connector dependencies as references instead of deploy requests", () => {
    const nodes = [
      connectorNode("root-node", "root", { tabRoot: true } as Partial<StudioNode["data"]>),
      connectorNode("network-node", "pitch", {
        fromNetwork: true,
        networkId: "pitch",
      }),
    ];
    const edges = [edge("root-node", "network-node")];

    const plan = buildStudioDeployPlan({
      activeTab: { label: "root" },
      nodes,
      edges,
      runtimeOverrides: {
        connectors: {
          pitch: { name: "pitch", dimensions: [{ transformations: [], bindings: {} }] },
        },
      },
    });

    expect(plan.ok).toBe(true);
    expect(plan.steps.map((step) => step.name)).toEqual(["root"]);
    expect(plan.preview.dependencies.network_connectors).toEqual(["pitch"]);
  });

  it("places local condition and transformation requests before connector requests", () => {
    const nodes: StudioNode[] = [
      connectorNode("root-node", "root", { tabRoot: true } as Partial<StudioNode["data"]>),
      {
        id: "condition-node",
        data: { label: "is_ready", kind: "condition", fromNetwork: false },
      },
      {
        id: "dimension-root-0",
        data: {
          label: "#1",
          kind: "dimension",
          parentFeatureId: "root-node",
          dimensionIndex: 0,
          transformations: [{ id: "tx-1", name: "shift_up", args: [2], status: "draft" }],
        },
      },
    ];
    const edges: StudioEdge[] = [
      {
        source: "root-node",
        sourceHandle: "dim-0",
        target: "dimension-root-0",
        targetHandle: "in",
      },
      {
        source: "condition-node",
        sourceHandle: "out",
        target: "root-node",
        targetHandle: "condition",
      },
    ];

    const plan = buildStudioDeployPlan({
      activeTab: { label: "root" },
      nodes,
      edges,
      runtimeOverrides: {
        transformations: {
          shift_up: { argc: 1, run: (value: number) => value },
        },
        conditions: {
          is_ready: { argc: 0, check: () => true },
        },
      },
      compiledTransformations: {
        shift_up: { argc: 1, run: (value: number) => value },
      },
      draftTransformationSources: new Map([["shift_up", { code: "contract ShiftUp {}" }]]),
      conditionSourcesByNodeId: new Map([["condition-node", "contract IsReady {}"]]),
    });

    expect(plan.ok).toBe(true);
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([
      ["condition", "is_ready"],
      ["transformation", "shift_up"],
      ["connector", "root"],
    ]);
    expect(plan.preview.summary).toEqual({
      total_requests: 3,
      conditions: 1,
      transformations: 1,
      connectors: 1,
    });
  });
});
