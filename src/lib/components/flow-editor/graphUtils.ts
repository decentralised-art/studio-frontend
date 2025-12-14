import type { DimensionEdgeType, FlowEdge, FlowNode } from "./flowEditorTypes";

/**
 * Build adjacency list: nodeId -> [neighbourId, ...]
 */
function buildAdjacency(edges: FlowEdge[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const edge of edges) {
    const { source, target } = edge;
    if (!source || !target) continue;

    if (!graph[source]) graph[source] = [];
    graph[source].push(target);
  }

  return graph;
}

/**
 * Returns true if there is at least one directed cycle in the graph.
 */
export function hasCycle(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  const graph = buildAdjacency(edges);
  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (stack.has(nodeId)) return true; // back-edge → cycle
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const neighbours = graph[nodeId] ?? [];
    for (const nextId of neighbours) {
      if (dfs(nextId)) return true;
    }

    stack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Check if adding a new Dimension edge (connection) would create a cycle.
 */
export function addingConnectionCreatesCycle(
  nodes: FlowNode[],
  edges: FlowEdge[],
  connection: import("@xyflow/svelte").Connection,
): boolean {
  const tempEdge: DimensionEdgeType = {
    id: "__temp__",
    type: "dimension",
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    data: { defs: [], pathFn: () => ["", 0, 0, 0, 0] },
  };

  const simulatedEdges: FlowEdge[] = [...edges, tempEdge];

  return hasCycle(nodes, simulatedEdges);
}
