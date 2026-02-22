import { mockExploreParticles, mockParticleViews } from "$lib/data/exploreParticles";
import { mockUsersById } from "$lib/data/users";
import {
  buildMockNetworkGraph,
  type NetworkGraphData,
  type NetworkGraphEdge,
  type NetworkGraphNode,
  type NetworkNodeKind,
} from "$lib/network/mockNetworkGraph";
import { mockRegistrySnapshot } from "$lib/particles/mockPtNetwork";

export type SocialEvent = {
  id: string;
  authorId: string;
  createdAt: number;
  createdLabel: string;
  particleId: string;
  particleLabel: string;
  formatLabel?: string;
  createdNodeIds: string[];
  reusedNodeIds: string[];
  focusNodeIds: string[];
};

export type SocialEventKindCounts = Partial<
  Record<
    Extract<NetworkNodeKind, "particle" | "feature" | "transformation" | "condition" | "plugin">,
    number
  >
>;

export const mockSocialNetworkGraph = buildMockNetworkGraph();

const byId = mockSocialNetworkGraph.nodeById;
const registryParticleByName = new Map(
  mockRegistrySnapshot.particles.map((particle) => [particle.name, particle] as const),
);
const registryFeatureByName = new Map(
  mockRegistrySnapshot.features.map((feature) => [feature.name, feature] as const),
);

const ensureExistingIds = (ids: string[]) => ids.filter((id) => byId.has(id));

const particleViewLabelById = new Map(
  mockParticleViews.map((view) => [view.id, view.label] as const),
);

export const mockSocialEvents: SocialEvent[] = mockExploreParticles
  .map((particle) => {
    const particleNodeId = `particle:${particle.id}`;
    const registryParticle = registryParticleByName.get(particle.id);
    const featureNodeId = registryParticle ? `feature:${registryParticle.featureName}` : null;
    const dependencyNodeIds = (registryParticle?.composites ?? [])
      .filter((name): name is string => Boolean(name))
      .map((name) => `particle:${name}`);
    return {
      id: `event-particle-created-${particle.id}`,
      authorId: particle.authorId,
      createdAt: particle.createdAt,
      createdLabel: particle.createdLabel,
      particleId: particle.id,
      particleLabel: particle.name,
      formatLabel: particleViewLabelById.get(particle.viewId),
      createdNodeIds: ensureExistingIds([particleNodeId]),
      reusedNodeIds: ensureExistingIds([
        ...(featureNodeId ? [featureNodeId] : []),
        ...dependencyNodeIds,
      ]),
      focusNodeIds: ensureExistingIds([particleNodeId, ...(featureNodeId ? [featureNodeId] : [])]),
    } satisfies SocialEvent;
  })
  .sort((a, b) => b.createdAt - a.createdAt);

export const countEventCreatedKinds = (
  event: SocialEvent,
  graph: NetworkGraphData = mockSocialNetworkGraph,
): SocialEventKindCounts => {
  const counts: SocialEventKindCounts = {};
  event.createdNodeIds.forEach((id) => {
    const node = graph.nodeById.get(id);
    if (!node) return;
    if (node.kind === "creator") return;
    counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  });
  return counts;
};

export const formatEventSummary = (event: SocialEvent): string => {
  const author = mockUsersById[event.authorId]?.nickname ?? "Unknown";
  const target = event.formatLabel ? ` for ${event.formatLabel}` : "";
  return `${author} created a new particle${target}: ${event.particleLabel}.`;
};

export const getEventNodesByKind = (
  event: SocialEvent,
  graph: NetworkGraphData = mockSocialNetworkGraph,
): Partial<Record<NetworkNodeKind, NetworkGraphNode[]>> => {
  const grouped: Partial<Record<NetworkNodeKind, NetworkGraphNode[]>> = {};
  [...event.createdNodeIds, ...event.reusedNodeIds].forEach((id) => {
    const node = graph.nodeById.get(id);
    if (!node) return;
    grouped[node.kind] ??= [];
    grouped[node.kind]!.push(node);
  });
  return grouped;
};

const outgoingEdges = (graph: NetworkGraphData, nodeId: string, kind?: NetworkGraphEdge["kind"]) =>
  graph.edges.filter((edge) => edge.source === nodeId && (!kind || edge.kind === kind));

export const buildSocialEventGraphSlice = (
  event: SocialEvent,
  graph: NetworkGraphData = mockSocialNetworkGraph,
): { nodes: NetworkGraphNode[]; edges: NetworkGraphEdge[] } => {
  const rootParticleId = `particle:${event.particleId}`;
  const rootParticleNode = graph.nodeById.get(rootParticleId);
  if (!rootParticleNode) return { nodes: [], edges: [] };

  const registryParticle = registryParticleByName.get(event.particleId);
  if (!registryParticle) {
    return {
      nodes: [rootParticleNode],
      edges: [],
    };
  }

  const keepNodeIds = new Set<string>([rootParticleId]);
  const keepEdges: NetworkGraphEdge[] = [];
  const syntheticEdges: NetworkGraphEdge[] = [];

  const pushRealEdge = (edge: NetworkGraphEdge | undefined) => {
    if (!edge) return;
    keepNodeIds.add(edge.source);
    keepNodeIds.add(edge.target);
    if (!keepEdges.some((candidate) => candidate.id === edge.id)) {
      keepEdges.push(edge);
    }
  };

  const visitedParticles = new Set<string>();

  const walkParticle = (particleName: string) => {
    if (visitedParticles.has(particleName)) return;
    visitedParticles.add(particleName);

    const particleNodeId = `particle:${particleName}`;
    if (!graph.nodeById.has(particleNodeId)) return;
    keepNodeIds.add(particleNodeId);

    const particleSnapshot = registryParticleByName.get(particleName);
    if (!particleSnapshot) return;

    const featureNodeId = `feature:${particleSnapshot.featureName}`;
    const featureNode = graph.nodeById.get(featureNodeId);
    if (featureNode) {
      keepNodeIds.add(featureNodeId);
      const particleFeatureEdge = outgoingEdges(graph, particleNodeId, "uses_feature").find(
        (edge) => edge.target === featureNodeId,
      );
      pushRealEdge(particleFeatureEdge);
    }

    (particleSnapshot.composites ?? [])
      .filter((name): name is string => Boolean(name))
      .forEach((dependencyName, index) => {
        const dependencyNodeId = `particle:${dependencyName}`;
        if (!graph.nodeById.has(dependencyNodeId)) return;
        keepNodeIds.add(dependencyNodeId);
        if (featureNode) {
          const syntheticEdgeId = `event:${event.id}:feature-dependency:${featureNodeId}->${dependencyNodeId}:${index}`;
          if (!syntheticEdges.some((edge) => edge.id === syntheticEdgeId)) {
            syntheticEdges.push({
              id: syntheticEdgeId,
              source: featureNodeId,
              target: dependencyNodeId,
              kind: "depends_on",
            });
          }
        }
        walkParticle(dependencyName);
      });
  };

  walkParticle(event.particleId);

  const rootFeatureNodeId = `feature:${registryParticle.featureName}`;
  const baseNodes = graph.nodes
    .filter(
      (node) => keepNodeIds.has(node.id) && (node.kind === "particle" || node.kind === "feature"),
    )
    .map((node) => {
      if (node.kind !== "feature") return node;
      const featureName = node.entityId;
      const featureMeta = registryFeatureByName.get(featureName);
      if (!featureMeta) return node;
      return { ...node, label: `${node.label} · ${featureMeta.dimensions.length}D` };
    });

  const edges = [...keepEdges, ...syntheticEdges].filter(
    (edge) =>
      keepNodeIds.has(edge.source) &&
      keepNodeIds.has(edge.target) &&
      graph.nodeById.get(edge.source)?.kind !== "condition" &&
      graph.nodeById.get(edge.source)?.kind !== "transformation" &&
      graph.nodeById.get(edge.target)?.kind !== "condition" &&
      graph.nodeById.get(edge.target)?.kind !== "transformation",
  );

  const depthById = new Map<string, number>([[rootParticleId, 0]]);
  const parentById = new Map<string, string>();
  const queue = [rootParticleId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthById.get(current) ?? 0;
    edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => {
        if (depthById.has(edge.target)) return;
        depthById.set(edge.target, currentDepth + 1);
        parentById.set(edge.target, current);
        queue.push(edge.target);
      });
  }

  const byDepth = new Map<number, NetworkGraphNode[]>();
  baseNodes.forEach((node) => {
    const depth = depthById.get(node.id) ?? 0;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)!.push(node);
  });

  const rowItemGap = 42;
  const laneGap = 64;
  const yGap = 138;
  const centerX = 470;
  const startY = 560;
  const maxLaneWidth = 860;
  const boostedSizeById = new Map(
    baseNodes.map((node) => {
      const isRoot = node.id === rootParticleId;
      const isRootFeature = node.id === rootFeatureNodeId;
      return [node.id, Math.max(node.size, isRoot ? 8.6 : isRootFeature ? 7.8 : 7.1)] as const;
    }),
  );
  const estimateRowWidth = (node: NetworkGraphNode) => {
    const boostedSize = boostedSizeById.get(node.id) ?? node.size;
    const nodeWidth = boostedSize * 11;
    const labelWidth = Math.max(120, node.label.length * 10.5);
    return nodeWidth + labelWidth + 52;
  };
  const maxDepth = Math.max(...Array.from(byDepth.keys()), 0);
  const rowXById = new Map<string, number>();
  const rowYById = new Map<string, number>();

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const row = [...(byDepth.get(depth) ?? [])];
    row.sort((a, b) => {
      const parentAX = rowXById.get(parentById.get(a.id) ?? "") ?? 0;
      const parentBX = rowXById.get(parentById.get(b.id) ?? "") ?? 0;
      if (parentAX !== parentBX) return parentAX - parentBX;
      if (a.kind !== b.kind) return a.kind === "feature" ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
    const lanes: Array<{ nodes: NetworkGraphNode[]; widths: number[]; widthUsed: number }> = [];
    row.forEach((node) => {
      const width = estimateRowWidth(node);
      let lane = lanes.find((candidate) => {
        if (candidate.nodes.length === 0) return true;
        return candidate.widthUsed + rowItemGap + width <= maxLaneWidth;
      });
      if (!lane) {
        lane = { nodes: [], widths: [], widthUsed: 0 };
        lanes.push(lane);
      }
      if (lane.nodes.length > 0) lane.widthUsed += rowItemGap;
      lane.nodes.push(node);
      lane.widths.push(width);
      lane.widthUsed += width;
    });

    const depthBaseY = startY - depth * yGap;
    lanes.forEach((lane, laneIndex) => {
      const laneCenterOffset = (laneIndex - (lanes.length - 1) / 2) * laneGap;
      let cursor = centerX - lane.widthUsed / 2;
      lane.nodes.forEach((node, index) => {
        const width = lane.widths[index] ?? 0;
        rowXById.set(node.id, cursor + width / 2);
        rowYById.set(node.id, depthBaseY - laneCenterOffset);
        cursor += width + rowItemGap;
      });
    });
  }

  const nodes = baseNodes.map((node) => {
    const depth = depthById.get(node.id) ?? 0;
    return {
      ...node,
      x: rowXById.get(node.id) ?? centerX,
      y: (rowYById.get(node.id) ?? startY - depth * yGap) - (node.kind === "feature" ? 4 : 0),
      size: boostedSizeById.get(node.id) ?? node.size,
    };
  });

  return { nodes, edges };
};
