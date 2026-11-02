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

describe("workspace root identity in creation plans", () => {
  it("creates the replacement connector under its name instead of the project's title", () => {
    const nodes = [connectorNode("replacement", "my_notes", { tabRoot: true })];
    const before = JSON.stringify(nodes);
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Untitled Connector 5" },
      nodes,
      edges: [],
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBe("my_notes");
    expect(plan.steps.map((step) => step.body.name)).toEqual(["my_notes"]);
    expect(plan.runtime?.registry.connectors["Untitled Connector 5"]).toBeUndefined();
    expect(JSON.stringify(nodes)).toBe(before);
  });

  it("uses a selected root's own structure among unrelated roots of different outgoing degrees", () => {
    const nodes = [
      connectorNode("unrelated", "unrelated"),
      connectorNode("unrelated-child", "unrelated_child"),
      connectorNode("selected", "selected_notes", { tabRoot: true, dimensions: 2 }),
    ];
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Composition workspace" },
      nodes,
      edges: [edge("unrelated", "unrelated-child")],
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBe("selected_notes");
    expect(plan.runtime?.registry.connectors.selected_notes.dimensions).toHaveLength(2);
    expect(plan.runtime?.registry.connectors.unrelated).toBeUndefined();
    expect(plan.steps.map((step) => step.name)).toEqual(["selected_notes"]);
    expect(
      plan.steps.find((step) => step.kind === "connector" && step.name === "selected_notes")?.body,
    ).toMatchObject({ name: "selected_notes", dimensions: [{}, {}] });
  });

  it("creates the connector attached to a World without using the World tab's label", () => {
    const nodes: StudioNode[] = [
      { id: "world", data: { kind: "plugin", label: "Score" } },
      connectorNode("notes", "piano_notes"),
    ];
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Score" },
      nodes,
      edges: [{ source: "world", target: "notes" }],
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBe("piano_notes");
    expect(plan.steps.map((step) => step.name)).toEqual(["piano_notes"]);
  });

  it("ignores an obsolete tab particle identity after the browser root is replaced", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Old title", particleId: "removed_connector" },
      nodes: [connectorNode("new-root", "replacement", { tabRoot: true })],
      edges: [],
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBe("replacement");
    expect(plan.runtime?.registry.connectors.removed_connector).toBeUndefined();
  });

  it("reports a name collision against the actual root identity", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Unrelated title" },
      nodes: [connectorNode("new-root", "taken", { tabRoot: true })],
      edges: [],
      networkConnectorNames: ["taken"],
    });
    expect(plan.warnings).toContain("Connector already exists in network: taken.");
  });

  it("requires a root selection when unrelated connectors are ambiguous", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Project" },
      nodes: [connectorNode("one", "one"), connectorNode("two", "two")],
      edges: [],
    });
    expect(plan.ok).toBe(false);
    expect(plan.rootConnectorName).toBeNull();
    expect(plan.errors).toContain("Select a top-level connector before creating this workspace.");
  });
});

describe("selected connector creation scope", () => {
  it("ignores unrelated invalid drafts, attached conditions and unused transformation sources", () => {
    const nodes: StudioNode[] = [
      connectorNode("selected", "valid_notes", { tabRoot: true }),
      connectorNode("unfinished", "Unfinished draft!"),
      {
        id: "bad-condition",
        data: { kind: "condition", label: "unfinished_condition", fromNetwork: false },
      },
      {
        id: "bad-dimension",
        data: {
          kind: "dimension",
          label: "#1",
          parentFeatureId: "unfinished",
          dimensionIndex: 0,
          transformations: [{ name: "missing_tx", args: [], status: "draft" }],
        },
      },
    ];
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Workspace" },
      nodes,
      edges: [
        edge("unfinished", "bad-dimension"),
        { source: "bad-condition", target: "unfinished", targetHandle: "condition" },
      ],
      compiledTransformations: { unused_tx: {} },
      draftTransformationSources: { unused_tx: { code: "unfinished code" } },
      conditionSourcesByNodeId: { "bad-condition": "unfinished condition code" },
      runtimeOverrides: {
        connectors: {
          unrelated_registry_definition: {
            name: "unrelated_registry_definition",
            dimensions: [
              { transformations: [{ name: "missing_runtime", args: [] }], bindings: {} },
            ],
          },
        },
      },
    });
    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([
      ["connector", "valid_notes"],
    ]);
    expect(plan.runtime?.registry.connectors["Unfinished draft!"]).toBeUndefined();
    expect(plan.runtime?.registry.connectors.unrelated_registry_definition).toBeUndefined();
  });

  it("honors the persisted explicit root selection before a different tabRoot marker", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Workspace", runRootId: "selected" },
      nodes: [
        connectorNode("other", "other", { tabRoot: true }),
        connectorNode("selected", "selected"),
      ],
      edges: [],
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBe("selected");
    expect(plan.steps.map((step) => step.name)).toEqual(["selected"]);
  });

  it("retains only referenced compiled transformations and condition sources in dependency order", () => {
    const nodes: StudioNode[] = [
      connectorNode("root", "root", { tabRoot: true }),
      connectorNode("child", "child"),
      {
        id: "dimension",
        data: {
          kind: "dimension",
          label: "#1",
          parentFeatureId: "child",
          dimensionIndex: 0,
          transformations: [{ name: "used_tx", args: [], status: "draft" }],
        },
      },
      { id: "condition", data: { kind: "condition", label: "used_condition" } },
      { id: "unused-condition", data: { kind: "condition", label: "unused_condition" } },
    ];
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Workspace" },
      nodes,
      edges: [
        edge("root", "child"),
        edge("child", "dimension"),
        { source: "condition", target: "child", targetHandle: "condition" },
      ],
      compiledTransformations: { used_tx: {}, unused_tx: {} },
      draftTransformationSources: {
        used_tx: { code: "used source" },
        unused_tx: { code: "unused source" },
      },
      conditionSourcesByNodeId: {
        condition: "used condition",
        "unused-condition": "unused condition",
      },
      runtimeOverrides: {
        transformations: { used_tx: { argc: 0, run: (value) => value } },
        conditions: { used_condition: { argc: 0, check: () => true } },
      },
    });
    expect(plan.ok).toBe(true);
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([
      ["condition", "used_condition"],
      ["transformation", "used_tx"],
      ["connector", "child"],
      ["connector", "root"],
    ]);
  });

  it("retains standalone condition and transformation creation without a connector workspace", () => {
    const plan = buildStudioDeployPlan({
      activeTab: { label: "Condition editor" },
      nodes: [{ id: "condition", data: { kind: "condition", label: "standalone_condition" } }],
      edges: [],
      compiledTransformations: { standalone_tx: {} },
      draftTransformationSources: { standalone_tx: { code: "standalone source" } },
      conditionSourcesByNodeId: { condition: "standalone condition" },
    });
    expect(plan.ok).toBe(true);
    expect(plan.rootConnectorName).toBeNull();
    expect(plan.steps.map((step) => [step.kind, step.name])).toEqual([
      ["condition", "standalone_condition"],
      ["transformation", "standalone_tx"],
    ]);
  });
});
