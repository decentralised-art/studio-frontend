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
        connectorNode("connector-root", { riStart: 0, riShift: 0, riLocked: false }),
        connectorNode("connector-child"),
      ],
      edges: [edge("projected-edge", "connector-root", "connector-child")],
    };
    const overlay = {
      nodes: [
        connectorNode("connector-root", { riStart: 12, riShift: 3, riLocked: true }),
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
});
