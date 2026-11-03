import { describe, expect, it } from "vitest";
import { runConnectorTreeTask, type ConnectorTreeTask } from "../src/lib/studio/connectorTreeTask";

const task: Omit<ConnectorTreeTask, "idPrefix"> = {
  connectorRegistry: {
    phrase: {
      name: "phrase",
      dimensions: [{ composite: "pitch", transformations: [], bindings: {} }],
    },
    pitch: {
      name: "pitch",
      dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
    },
  },
  rootConnectorName: "phrase",
  origin: { x: 0, y: 0 },
  labels: {},
  hideReadOnlyLeafOutlets: false,
  markRootAsTabRoot: false,
};

describe("Studio duplicate connector insertion", () => {
  it("keeps separately inserted instances and their edges independent", () => {
    const first = runConnectorTreeTask({ ...task, idPrefix: `phrase-flow-${crypto.randomUUID()}` });
    const second = runConnectorTreeTask({
      ...task,
      idPrefix: `phrase-flow-${crypto.randomUUID()}`,
    });
    const nodes = [...first.nodes, ...second.nodes],
      edges = [...first.edges, ...second.edges];
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
    expect(first.edges.length).toBeGreaterThan(0);
    for (const graph of [first, second]) {
      const ids = new Set(graph.nodes.map((node) => node.id));
      expect(graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
      expect(
        graph.nodes
          .filter((node) => node.data.kind === "connector")
          .map((node) => node.data.networkId),
      ).toEqual(["phrase", "pitch"]);
    }
  });
});
