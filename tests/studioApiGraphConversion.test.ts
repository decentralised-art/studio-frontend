import type { Edge } from "@xyflow/svelte";
import { describe, expect, it } from "vitest";

import {
  buildApiConnectorRequestBodyPreview,
  buildApiGraphFromPreviewJson,
  buildApiResolvedConnectorTreePreview,
  convertResolvedTreePreviewToDraft,
  type ApiGraphInputNode,
} from "../src/lib/studio/apiGraphConversion";
import type { StudioConnectorDef } from "../src/lib/studio/domain/connectorModel";

const connectorNode = (
  id: string,
  name: string,
  overrides: Partial<ApiGraphInputNode["data"]> = {},
): ApiGraphInputNode => ({
  id,
  type: "connector",
  position: { x: 0, y: 0 },
  data: {
    label: name,
    kind: "connector",
    networkId: name,
    dimensions: 1,
    connectorRows: [{ dimension: 1, transformations: ["shift (2)"] }],
    ...overrides,
  },
});

const edge = (partial: Partial<Edge>): Edge =>
  ({
    id: "edge-1",
    source: "source",
    target: "target",
    ...partial,
  }) as Edge;

const nextIds = () => {
  let index = 0;
  return () => {
    index += 1;
    return `id-${index}`;
  };
};

describe("Studio API graph conversion", () => {
  it("builds resolved tree previews from connector graph nodes and edges", () => {
    const root = connectorNode("root-node", "root", {
      label: "Root Connector",
      tabRoot: true,
      staticRi: { "0": { startPoint: 4, transformationShift: 2 } },
    });
    const child = connectorNode("child-node", "child", {
      connectorRows: [{ dimension: 1, transformations: ["scale"] }],
    });
    const dimension: ApiGraphInputNode = {
      id: "dimension-root-0",
      type: "dimension",
      hidden: true,
      position: { x: 0, y: 160 },
      data: {
        label: "#1",
        kind: "dimension",
        parentFeatureId: root.id,
        dimensionIndex: 0,
      },
    };
    const particle: ApiGraphInputNode = {
      id: "particle-note",
      type: "particle",
      position: { x: 120, y: 320 },
      data: {
        label: "Note A",
        kind: "particle",
        particleId: "note_a",
      },
    };

    const preview = buildApiResolvedConnectorTreePreview({
      nodes: [root, child, dimension, particle],
      edges: [
        edge({
          source: root.id,
          sourceHandle: "dim-0",
          target: child.id,
          targetHandle: "in",
          label: "binding · slot 2",
          data: { relation: "binding", bindingSlot: 2 },
        }),
        edge({
          id: "edge-terminal",
          source: dimension.id,
          target: particle.id,
          targetHandle: "in",
        }),
      ],
      rootParticleId: "root",
    });

    expect(preview.root_connector).toBe("root");
    expect(preview.root_connector_label).toBe("Root Connector");
    expect(preview.connectors).toEqual([
      expect.objectContaining({
        node_id: "root-node",
        name: "root",
        static_ri: { "0": { start_point: 4, transformation_shift: 2 } },
      }),
      expect.objectContaining({ node_id: "child-node", name: "child" }),
    ]);
    expect(preview.links).toContainEqual(
      expect.objectContaining({
        owner_connector: "root",
        to_connector: "child",
        relation: "binding",
        dimension: 1,
        binding_slot: 2,
      }),
    );
    expect(preview.terminals).toEqual([
      { node_id: "particle-note", id: "note_a", label: "Note A" },
    ]);
  });

  it("builds editable Studio graph nodes from deploy request JSON", () => {
    const result = buildApiGraphFromPreviewJson({
      rawJson: JSON.stringify({
        root_connector: "root",
        deploy_requests: [
          {
            method: "POST",
            path: "/chain/condition",
            body: { name: "is_ready", sol_src: "return true;" },
          },
          {
            method: "POST",
            path: "/chain/transformation",
            body: { name: "shift", sol_src: "return x + args[0];" },
          },
          {
            method: "POST",
            path: "/chain/connector",
            body: {
              name: "root",
              condition_name: "is_ready",
              dimensions: [
                {
                  transformations: [{ name: "shift", args: [3] }],
                  composite: "child",
                  bindings: { "1": "note_a" },
                },
              ],
              static_ri: { "0": { start_point: 8, transformation_shift: 5 } },
            },
          },
          {
            method: "POST",
            path: "/chain/connector",
            body: {
              name: "child",
              dimensions: [{ transformations: [] }],
            },
          },
        ],
      }),
      currentResolved: { root_connector: null, connectors: [], links: [] },
      deployedConnectors: {},
      networkParticles: [{ id: "note_a", name: "Note A" }],
      idFactory: nextIds(),
    });

    expect(result.rootConnectorName).toBe("root");
    expect(result.rootConnectorLabel).toBe("root");
    expect(result.nodes.map((node) => [node.id, node.data.kind, node.data.label])).toEqual([
      ["feature-id-1", "connector", "root"],
      ["feature-id-2", "connector", "child"],
      ["condition-id-3", "condition", "is_ready"],
      ["dimension-feature-id-1-0-id-5", "dimension", "#1"],
      ["particle-id-9", "particle", "Note A"],
      ["dimension-feature-id-2-0-id-11", "dimension", "#1"],
    ]);
    expect(result.nodes[0]?.data.staticRi).toEqual({
      "0": { startPoint: 8, transformationShift: 5 },
    });
    expect(Array.from(result.conditionCodeByNodeId.values())).toEqual(["return true;"]);
    expect(Array.from(result.transformationCodeById.values())).toEqual(["return x + args[0];"]);
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        source: "feature-id-1",
        target: "feature-id-2",
        label: "composite · D1",
        data: { relation: "composite" },
      }),
    );
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        source: "feature-id-1",
        target: "particle-id-9",
        label: "binding · slot 1",
        data: {
          relation: "binding",
          bindingSlot: 1,
          bindingOwnerName: "root",
        },
      }),
    );
  });

  it("keeps read-only resolved-tree connectors pinned to deployed bodies", () => {
    const deployedRoot: StudioConnectorDef = {
      name: "network_root",
      dimensions: [
        {
          transformations: [{ name: "deployed_shift", args: [1] }],
          composite: "deployed_child",
          bindings: { "0": "deployed_bound" },
        },
      ],
      conditionName: "deployed_condition",
      conditionArgs: [],
    };

    const converted = convertResolvedTreePreviewToDraft({
      resolved: {
        root_connector: "network_root",
        connectors: [
          {
            name: "network_root",
            from_network: true,
            connector_rows: [{ dimension: 1, transformations: ["edited_should_not_win (9)"] }],
          },
        ],
        links: [
          {
            owner_connector: "network_root",
            relation: "composite",
            to_connector: "edited_child",
            dimension: 1,
          },
        ],
      },
      currentResolved: { root_connector: "network_root", connectors: [], links: [] },
      deployedConnectors: { network_root: deployedRoot },
    });

    expect(converted.readOnlyByName.get("network_root")).toBe(true);
    expect(converted.preview.deploy_requests?.[0]?.body).toEqual({
      name: "network_root",
      dimensions: [
        {
          transformations: [{ name: "deployed_shift", args: [1] }],
          composite: "deployed_child",
          bindings: { "0": "deployed_bound" },
        },
      ],
      condition_name: "deployed_condition",
      condition_args: [],
    });
  });

  it("uses deployed connector bodies for selected network protocol preview", () => {
    const selected = connectorNode("selected", "network_root", {
      fromNetwork: true,
    });
    const deployedRoot: StudioConnectorDef = {
      name: "network_root",
      dimensions: [{ transformations: [{ name: "scale", args: [2] }], bindings: {} }],
      staticRi: { "0": { startPoint: 1, transformationShift: 3 } },
    };

    expect(
      buildApiConnectorRequestBodyPreview({
        activeTab: { label: "Draft" },
        nodes: [selected],
        edges: [],
        selectedConnectorNode: selected,
        deployedConnectors: { network_root: deployedRoot },
      }),
    ).toEqual({
      name: "network_root",
      dimensions: [{ transformations: [{ name: "scale", args: [2] }] }],
      static_ri: { "0": { start_point: 1, transformation_shift: 3 } },
    });
  });
});
