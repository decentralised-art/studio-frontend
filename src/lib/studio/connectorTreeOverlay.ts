import type { Edge } from "@xyflow/svelte";

import {
  mergeRuntimeRiOverridesIntoProjectedNode,
  type RuntimeRiOverrideData,
  type RuntimeRiOverrideNode,
} from "$lib/studio/runtimeRiOverrides";

export type ConnectorTreeOverlayNodeData = RuntimeRiOverrideData & {
  label?: unknown;
  kind?: unknown;
};

export type ConnectorTreeOverlayNode = RuntimeRiOverrideNode<ConnectorTreeOverlayNodeData> & {
  id: string;
  position?: { x: number; y: number };
  data: ConnectorTreeOverlayNodeData;
};

export type ConnectorTreeOverlayGraph<
  TNode extends ConnectorTreeOverlayNode,
  TEdge extends Edge = Edge,
> = {
  nodes: TNode[];
  edges: TEdge[];
};

export const shouldRetainConnectorTreeOverlayNode = (node: ConnectorTreeOverlayNode) =>
  node.data.kind === "plugin";

export const mergeConnectorTreeProjectionWithOverlay = <
  TNode extends ConnectorTreeOverlayNode,
  TEdge extends Edge = Edge,
>(
  projected: ConnectorTreeOverlayGraph<TNode, TEdge>,
  overlay?: ConnectorTreeOverlayGraph<TNode, TEdge> | null,
): ConnectorTreeOverlayGraph<TNode, TEdge> => {
  const overlayNodes = overlay?.nodes ?? [];
  const overlayNodeIds = new Set(overlayNodes.map((node) => node.id));
  const overlayEdges = (overlay?.edges ?? []).filter(
    (edge) => overlayNodeIds.has(edge.source) && overlayNodeIds.has(edge.target),
  );
  const overlayNodeById = new Map(overlayNodes.map((node) => [node.id, node]));

  const mergedNodes = projected.nodes.map((node) => {
    const overlayNode = overlayNodeById.get(node.id);
    return overlayNode ? mergeRuntimeRiOverridesIntoProjectedNode(node, overlayNode) : node;
  });

  const mergedNodeIdSet = new Set(mergedNodes.map((node) => node.id));
  overlayNodes.forEach((node) => {
    if (mergedNodeIdSet.has(node.id)) return;
    if (!shouldRetainConnectorTreeOverlayNode(node)) return;
    mergedNodes.push({
      ...node,
      ...(node.position ? { position: { ...node.position } } : {}),
      data: { ...node.data },
    });
    mergedNodeIdSet.add(node.id);
  });

  const mergedEdges = [...projected.edges];
  overlayEdges.forEach((edge) => {
    if (!mergedNodeIdSet.has(edge.source) || !mergedNodeIdSet.has(edge.target)) return;
    if (
      mergedEdges.some(
        (existing) =>
          existing.source === edge.source &&
          existing.target === edge.target &&
          (existing.sourceHandle ?? "") === (edge.sourceHandle ?? "") &&
          (existing.targetHandle ?? "") === (edge.targetHandle ?? ""),
      )
    ) {
      return;
    }
    mergedEdges.push({ ...edge });
  });

  return { nodes: mergedNodes, edges: mergedEdges };
};
