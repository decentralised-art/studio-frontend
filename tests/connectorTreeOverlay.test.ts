import type { Edge } from "@xyflow/svelte";
import { describe, expect, it } from "vitest";

import {
  mergeConnectorTreeProjectionWithOverlay,
  type ConnectorTreeOverlayNode,
} from "../src/lib/studio/connectorTreeOverlay";

const connectorNode = (
  id: string,
  data: Partial<ConnectorTreeOverlayNode["data"]> = {},
): ConnectorTreeOverlayNode => ({
  id,
  position: { x: 0, y: 0 },
  data: {
    label: id,
    kind: "connector",
    ...data,
  },
});

const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: "out",
  targetHandle: "in",
});

describe("connector tree overlay merging", () => {
  it("preserves RI overrides without re-adding stale projected connector trees", () => {
    const projected = {
      nodes: [
        connectorNode("connector-root", {
          networkId: "root",
          riPosition: 0,
          riStart: 0,
          riShift: 0,
          riLocked: false,
        }),
        connectorNode("connector-child"),
      ],
      edges: [edge("projected-edge", "connector-root", "connector-child")],
    };
    const overlay = {
      nodes: [
        connectorNode("connector-root", {
          networkId: "root",
          riPosition: 0,
          riStart: 12,
          riShift: 3,
          riLocked: true,
        }),
        connectorNode("old-connector-root"),
        connectorNode("old-connector-child"),
        connectorNode("plugin-midi", { kind: "plugin" }),
      ],
      edges: [
        edge("duplicate-projected-edge", "connector-root", "connector-child"),
        edge("stale-tree-edge", "old-connector-root", "old-connector-child"),
        edge("plugin-edge", "plugin-midi", "connector-root"),
      ],
    };

    const merged = mergeConnectorTreeProjectionWithOverlay(projected, overlay);

    expect(merged.nodes.map((node) => node.id)).toEqual([
      "connector-root",
      "connector-child",
      "plugin-midi",
    ]);
    expect(merged.nodes[0]?.data).toMatchObject({
      riStart: 12,
      riShift: 3,
      riLocked: true,
    });
    expect(merged.edges.map((item) => item.id)).toEqual(["projected-edge", "plugin-edge"]);
  });

  it("does not copy stale RI overrides onto a different projected connector", () => {
    const projected = {
      nodes: [
        connectorNode("connector-reused", {
          networkId: "major_scale_steps",
          riPosition: 5,
          riStart: 0,
          riShift: 0,
          riLocked: false,
        }),
      ],
      edges: [],
    };
    const overlay = {
      nodes: [
        connectorNode("connector-reused", {
          networkId: "constant_value",
          riPosition: 3,
          riStart: 2520,
          riShift: 0,
          riLocked: true,
        }),
      ],
      edges: [],
    };

    const merged = mergeConnectorTreeProjectionWithOverlay(projected, overlay);

    expect(merged.nodes[0]?.data).toMatchObject({
      networkId: "major_scale_steps",
      riPosition: 5,
      riStart: 0,
      riShift: 0,
      riLocked: false,
    });
  });
});
