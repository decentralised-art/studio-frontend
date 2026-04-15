import type { RiConnectorNodePosition } from "$lib/studio/riPositioning";

export type RiProjectionGraphNode = {
  id: string;
  connectorName: string;
  tabRoot?: boolean;
};

export type RiProjectionGraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  relation: "composite" | "binding" | "unknown";
  bindingSlot?: number | null;
};

export type RiProjectionResult = {
  positionByNodeId: Record<string, number>;
  mappedNodeIdByPlanKey: Record<string, string>;
  warnings: string[];
};

const normalize = (value: string) => value.trim().toLowerCase();

const toSlot = (value: number | null | undefined): number | null =>
  Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;

const scoreProjectionCandidate = (input: {
  entry: RiConnectorNodePosition;
  targetName: string;
  edgeRelation: RiProjectionGraphEdge["relation"];
  edgeBindingSlot: number | null;
}): number => {
  const { entry, targetName, edgeRelation } = input;
  if (normalize(targetName) !== normalize(entry.connectorName)) return -1;

  const expectedSlot = toSlot(entry.parentSlot);
  const candidateSlot = toSlot(input.edgeBindingSlot);

  // Name match baseline.
  let score = 10;

  if (entry.relation === "composite") {
    // Composites should never map through explicit binding edges.
    if (edgeRelation === "binding") return -1;
    if (edgeRelation === "composite") score += 5;
    if (edgeRelation === "unknown") score += 2;
    return score;
  }

  if (entry.relation === "binding") {
    // Bindings should not map through explicit composite edges.
    if (edgeRelation === "composite") return -1;
    if (edgeRelation === "binding") score += 5;
    if (edgeRelation === "unknown") score += 2;

    if (expectedSlot !== null) {
      if (candidateSlot === expectedSlot) {
        score += 8;
      } else if (candidateSlot !== null) {
        return -1;
      } else {
        // Unknown slot metadata: still a weak candidate when relation/structure matches.
        score += 1;
      }
    } else if (candidateSlot === null) {
      score += 1;
    }

    return score;
  }

  return -1;
};

export const projectRiPositionsToConnectorNodes = (input: {
  rootConnectorName: string;
  planNodes: RiConnectorNodePosition[];
  graphNodes: RiProjectionGraphNode[];
  graphEdges: RiProjectionGraphEdge[];
}): RiProjectionResult => {
  const positionByNodeId: Record<string, number> = {};
  const mappedNodeIdByPlanKey: Record<string, string> = {};
  const warnings: string[] = [];

  if (!input.rootConnectorName.trim()) {
    return { positionByNodeId, mappedNodeIdByPlanKey, warnings };
  }

  const connectorNodes = input.graphNodes.filter((node) => node.id.trim().length > 0);
  if (!connectorNodes.length) {
    return { positionByNodeId, mappedNodeIdByPlanKey, warnings };
  }

  const nodeById = new Map(connectorNodes.map((node) => [node.id, node]));
  const normalizedRootName = normalize(input.rootConnectorName);
  const rootNode =
    connectorNodes.find(
      (node) => Boolean(node.tabRoot) && normalize(node.connectorName) === normalizedRootName,
    ) ??
    connectorNodes.find((node) => normalize(node.connectorName) === normalizedRootName) ??
    null;

  if (!rootNode) {
    warnings.push(
      `Unable to project RI positions: root '${input.rootConnectorName}' is not present in graph.`,
    );
    return { positionByNodeId, mappedNodeIdByPlanKey, warnings };
  }

  const usedNodeIds = new Set<string>();
  const mappedNodeIdByKey = new Map<string, string>();

  input.planNodes.forEach((entry) => {
    let mappedNodeId: string | null = null;

    if (entry.relation === "root") {
      if (normalize(rootNode.connectorName) === normalize(entry.connectorName)) {
        mappedNodeId = rootNode.id;
      }
    } else {
      const parentNodeId = entry.parentKey
        ? (mappedNodeIdByKey.get(entry.parentKey) ?? null)
        : null;
      const parentNode = parentNodeId ? (nodeById.get(parentNodeId) ?? null) : null;
      const dimensionIndex = entry.parentDimensionIndex;
      if (
        parentNode &&
        Number.isInteger(dimensionIndex) &&
        dimensionIndex !== null &&
        dimensionIndex >= 0
      ) {
        const sourceHandle = `dim-${dimensionIndex}`;
        const candidateEdges = input.graphEdges.filter((edge) => {
          if (edge.source !== parentNode.id) return false;
          if ((edge.sourceHandle ?? "") !== sourceHandle) return false;
          if ((edge.targetHandle ?? "") !== "in") return false;
          const targetNode = edge.target ? (nodeById.get(edge.target) ?? null) : null;
          return Boolean(targetNode);
        });

        const rankedTargets = candidateEdges
          .map((edge) => {
            const targetNode = edge.target ? (nodeById.get(edge.target) ?? null) : null;
            if (!targetNode || usedNodeIds.has(targetNode.id)) return null;
            const score = scoreProjectionCandidate({
              entry,
              targetName: targetNode.connectorName,
              edgeRelation: edge.relation,
              edgeBindingSlot: edge.bindingSlot ?? null,
            });
            if (score < 0) return null;
            return { score, targetNodeId: targetNode.id };
          })
          .filter((entry): entry is { score: number; targetNodeId: string } => Boolean(entry))
          .sort((left, right) => right.score - left.score);

        if (rankedTargets.length) {
          mappedNodeId = rankedTargets[0].targetNodeId;
        }
      }
    }

    if (!mappedNodeId) {
      if (entry.relation === "root") {
        warnings.push(
          `Unable to project RI position ${entry.position} for root '${entry.connectorName}' to a flow node.`,
        );
      } else if (entry.relation === "binding") {
        const slotInfo =
          Number.isInteger(entry.parentSlot) && entry.parentSlot !== null
            ? `slot ${entry.parentSlot}`
            : "unknown slot";
        warnings.push(
          `Unable to project RI position ${entry.position} for binding '${entry.connectorName}' (${slotInfo}) to a flow node.`,
        );
      } else {
        warnings.push(
          `Unable to project RI position ${entry.position} for composite '${entry.connectorName}' to a flow node.`,
        );
      }
      return;
    }

    mappedNodeIdByKey.set(entry.key, mappedNodeId);
    mappedNodeIdByPlanKey[entry.key] = mappedNodeId;
    usedNodeIds.add(mappedNodeId);
    positionByNodeId[mappedNodeId] = entry.position;
  });

  return { positionByNodeId, mappedNodeIdByPlanKey, warnings };
};
