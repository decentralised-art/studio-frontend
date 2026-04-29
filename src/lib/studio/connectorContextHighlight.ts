import type { Edge } from "@xyflow/svelte";

import { parseConnectorEdgeRelation } from "$lib/studio/connectorGraph";
import { isConnectorKind } from "$lib/studio/studioNaming";

export type ConnectorContextHighlightRole = "selected" | "member";

export type ConnectorContextHighlightNode = {
  id: string;
  data: {
    kind: string | null | undefined;
  };
};

export const isConnectorContextEdge = (edge: Edge): boolean => {
  const relation = parseConnectorEdgeRelation(edge);
  return relation === "composite" || relation === "binding";
};

export const computeSelectedConnectorContextHighlightRoles = <
  TNode extends ConnectorContextHighlightNode,
>(
  nodes: readonly TNode[],
  edges: readonly Edge[],
  selectedNodeId: string | null | undefined,
): Map<string, ConnectorContextHighlightRole> => {
  const roles = new Map<string, ConnectorContextHighlightRole>();
  if (!selectedNodeId) return roles;

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const selectedNode = nodeById.get(selectedNodeId);
  if (!selectedNode || !isConnectorKind(selectedNode.data.kind)) return roles;

  roles.set(selectedNode.id, "selected");

  const queuedConnectorIds = [selectedNode.id];
  const visitedConnectorIds = new Set(queuedConnectorIds);

  for (let index = 0; index < queuedConnectorIds.length; index += 1) {
    const sourceId = queuedConnectorIds[index];
    for (const edge of edges) {
      if (edge.source !== sourceId || !isConnectorContextEdge(edge)) continue;
      const targetId = edge.target;
      if (!targetId || visitedConnectorIds.has(targetId)) continue;

      const targetNode = nodeById.get(targetId);
      if (!targetNode || !isConnectorKind(targetNode.data.kind)) continue;

      visitedConnectorIds.add(targetId);
      roles.set(targetId, "member");
      queuedConnectorIds.push(targetId);
    }
  }

  return roles;
};

const parseDimensionHandle = (handle?: string | null): number | null => {
  if (!handle || !handle.startsWith("dim-")) return null;
  const parsed = Number(handle.replace("dim-", ""));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const connectorPathSegment = (name: string, index: number | "*") =>
  index === "*" ? `${name}:*` : `${name}:${Math.max(0, index)}`;

const appendPathSegment = (path: string, segment: string) => `${path}/${segment}`;

type ConnectorPathOccurrence = {
  nodeId: string;
  ancestorIds: ReadonlySet<string>;
  contextPath: string;
};

export const computeConnectorContextPathPrefixes = <TNode extends ConnectorContextHighlightNode>(
  nodes: readonly TNode[],
  edges: readonly Edge[],
  rootNodeId: string | null | undefined,
  contextNodeIds: ReadonlySet<string>,
  resolveNodeName: (node: TNode) => string,
): string[] => {
  if (!rootNodeId || !contextNodeIds.size) return [];

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const rootNode = nodeById.get(rootNodeId);
  if (!rootNode || !isConnectorKind(rootNode.data.kind)) return [];

  const prefixes = new Map<string, Set<string>>();
  const addPrefix = (nodeId: string, prefix: string) => {
    const current = prefixes.get(nodeId) ?? new Set<string>();
    current.add(prefix);
    prefixes.set(nodeId, current);
  };

  addPrefix(rootNode.id, `/${connectorPathSegment(resolveNodeName(rootNode), "*")}`);

  const queuedOccurrences: ConnectorPathOccurrence[] = [
    {
      nodeId: rootNode.id,
      ancestorIds: new Set([rootNode.id]),
      contextPath: "",
    },
  ];

  for (let index = 0; index < queuedOccurrences.length; index += 1) {
    const occurrence = queuedOccurrences[index];
    const sourceNode = nodeById.get(occurrence.nodeId);
    if (!sourceNode || !isConnectorKind(sourceNode.data.kind)) continue;

    for (const edge of edges) {
      if (edge.source !== occurrence.nodeId || !isConnectorContextEdge(edge)) continue;
      const targetNode = nodeById.get(edge.target);
      if (!targetNode || !isConnectorKind(targetNode.data.kind)) continue;
      if (occurrence.ancestorIds.has(targetNode.id)) continue;

      const sourceDimensionIndex = parseDimensionHandle(edge.sourceHandle) ?? 0;
      const targetContextPath = appendPathSegment(
        occurrence.contextPath,
        connectorPathSegment(resolveNodeName(sourceNode), sourceDimensionIndex),
      );
      const targetPrefix = appendPathSegment(
        targetContextPath,
        connectorPathSegment(resolveNodeName(targetNode), "*"),
      );
      addPrefix(targetNode.id, targetPrefix);

      queuedOccurrences.push({
        nodeId: targetNode.id,
        ancestorIds: new Set([...occurrence.ancestorIds, targetNode.id]),
        contextPath: targetContextPath,
      });
    }
  }

  return [...new Set([...contextNodeIds].flatMap((nodeId) => [...(prefixes.get(nodeId) ?? [])]))];
};
