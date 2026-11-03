import { parseConnectorEdgeRelation } from "$lib/studio/connectorGraph";
import { isConnectorKind } from "$lib/studio/studioNaming";
import type { WorldSourceOccurrence } from "$lib/worlds/interaction";
import type { Edge } from "@xyflow/svelte";

export type ConnectorContextHighlightRole = "selected" | "member";
export type ConnectorContextHighlightNode = {
  id: string;
  data: { kind: string | null | undefined; parentFeatureId?: string; dimensionIndex?: number };
};
export const isConnectorContextEdge = (edge: Edge): boolean => {
  const relation = parseConnectorEdgeRelation(edge);
  return relation === "composite" || relation === "binding";
};
const parseDimensionHandle = (handle?: string | null): number | null => {
  if (!handle?.startsWith("dim-")) return null;
  const value = Number(handle.slice(4));
  return Number.isInteger(value) && value >= 0 ? value : null;
};
type Dependency = { source: string; target: string; dimension: number; edgeIds: string[] };

/** Current direct connector edges and the existing dimension-out representation mean the same dependency. */
export function connectorDependencies(
  nodes: readonly ConnectorContextHighlightNode[],
  edges: readonly Edge[],
): Dependency[] {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const dimensions = new Map<string, { source: string; dimension: number; edgeId: string }>();
  for (const edge of edges) {
    if (
      isConnectorKind(lookup.get(edge.source)?.data.kind) &&
      lookup.get(edge.target)?.data.kind === "dimension"
    ) {
      dimensions.set(edge.target, {
        source: edge.source,
        dimension:
          parseDimensionHandle(edge.sourceHandle) ??
          lookup.get(edge.target)?.data.dimensionIndex ??
          0,
        edgeId: edge.id,
      });
    }
  }
  const result: Dependency[] = [];
  for (const edge of edges) {
    if (!isConnectorKind(lookup.get(edge.target)?.data.kind)) continue;
    const source = lookup.get(edge.source);
    if (
      isConnectorKind(source?.data.kind) &&
      (isConnectorContextEdge(edge) ||
        (parseDimensionHandle(edge.sourceHandle) !== null && (edge.targetHandle ?? "in") === "in"))
    ) {
      result.push({
        source: edge.source,
        target: edge.target,
        dimension: parseDimensionHandle(edge.sourceHandle) ?? 0,
        edgeIds: [edge.id],
      });
    } else if (source?.data.kind === "dimension" && edge.sourceHandle === "out") {
      const parent = dimensions.get(source.id);
      if (parent)
        result.push({
          source: parent.source,
          target: edge.target,
          dimension: parent.dimension,
          edgeIds: [parent.edgeId, edge.id],
        });
    }
  }
  return result;
}
const adjacencyFor = (dependencies: Dependency[]) => {
  const outgoing = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    const list = outgoing.get(dependency.source) ?? [];
    list.push(dependency);
    outgoing.set(dependency.source, list);
  }
  return outgoing;
};
export const computeSelectedConnectorContextHighlightRoles = <
  TNode extends ConnectorContextHighlightNode,
>(
  nodes: readonly TNode[],
  edges: readonly Edge[],
  selectedNodeId: string | readonly string[] | null | undefined,
): Map<string, ConnectorContextHighlightRole> => {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const roles = new Map<string, ConnectorContextHighlightRole>();
  for (const id of typeof selectedNodeId === "string" ? [selectedNodeId] : (selectedNodeId ?? [])) {
    if (isConnectorKind(lookup.get(id)?.data.kind)) roles.set(id, "selected");
  }
  const outgoing = adjacencyFor(connectorDependencies(nodes, edges));
  const queue = [...roles.keys()];
  for (let index = 0; index < queue.length; index++) {
    for (const dependency of outgoing.get(queue[index]) ?? []) {
      if (roles.has(dependency.target)) continue;
      roles.set(dependency.target, "member");
      queue.push(dependency.target);
    }
  }
  return roles;
};

/** A graph node can occur at several distinct output paths; a reused name is never its identity. */
export const computeConnectorSourceOccurrences = <TNode extends ConnectorContextHighlightNode>(
  nodes: readonly TNode[],
  edges: readonly Edge[],
  rootNodeId: string | null | undefined,
  resolveNodeName: (node: TNode) => string,
): WorldSourceOccurrence[] => {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const root = rootNodeId ? lookup.get(rootNodeId) : undefined;
  if (!root || !isConnectorKind(root.data.kind)) return [];
  const outgoing = adjacencyFor(connectorDependencies(nodes, edges));
  const queue = [{ nodeId: root.id, contextPath: "", ancestors: new Set([root.id]) }];
  const sources: WorldSourceOccurrence[] = [];
  for (let index = 0; index < queue.length; index++) {
    const occurrence = queue[index],
      node = lookup.get(occurrence.nodeId)!;
    const name = resolveNodeName(node);
    sources.push({
      occurrenceId: `source-${index}`,
      nodeId: node.id,
      connectorName: name,
      pathPrefix: `${occurrence.contextPath}/${name}:*`,
    });
    for (const dependency of outgoing.get(node.id) ?? []) {
      if (occurrence.ancestors.has(dependency.target)) continue;
      queue.push({
        nodeId: dependency.target,
        contextPath: `${occurrence.contextPath}/${name}:${dependency.dimension}`,
        ancestors: new Set([...occurrence.ancestors, dependency.target]),
      });
    }
  }
  return sources;
};
export const computeConnectorContextPathPrefixes = <TNode extends ConnectorContextHighlightNode>(
  nodes: readonly TNode[],
  edges: readonly Edge[],
  rootNodeId: string | null | undefined,
  contextNodeIds: ReadonlySet<string>,
  resolveNodeName: (node: TNode) => string,
): string[] => {
  const sources = computeConnectorSourceOccurrences(nodes, edges, rootNodeId, resolveNodeName);
  return [
    ...new Set(
      [...contextNodeIds].flatMap((id) =>
        sources.filter((source) => source.nodeId === id).map((source) => source.pathPrefix),
      ),
    ),
  ];
};
