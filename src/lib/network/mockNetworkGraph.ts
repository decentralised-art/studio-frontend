import { mockExploreParticles } from "$lib/data/exploreParticles";
import {
  mockConditions,
  mockFeatures,
  mockPlugins,
  mockTransformations,
  type LibraryItem,
} from "$lib/data/studioLibrary";
import { mockUsers } from "$lib/data/users";
import { mockRegistrySnapshot } from "$lib/particles/mockPtNetwork";

export type NetworkNodeKind =
  | "creator"
  | "particle"
  | "feature"
  | "transformation"
  | "condition"
  | "plugin";

export type NetworkEdgeKind =
  | "authored_by"
  | "uses_feature"
  | "depends_on"
  | "uses_transformation"
  | "guarded_by"
  | "renders_with";

export type NetworkGraphNode = {
  id: string;
  entityId: string;
  kind: NetworkNodeKind;
  label: string;
  summary: string;
  creatorId?: string;
  x: number;
  y: number;
  size: number;
};

export type NetworkGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: NetworkEdgeKind;
};

export type NetworkGraphData = {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  nodeById: Map<string, NetworkGraphNode>;
  edgeById: Map<string, NetworkGraphEdge>;
};

export const networkNodePalette: Record<NetworkNodeKind, { color: string; label: string }> = {
  creator: { color: "#71a7ff", label: "Creator" },
  particle: { color: "#37d39d", label: "Connector" },
  feature: { color: "#f4b247", label: "Connector Schema" },
  transformation: { color: "#f07cbc", label: "Transformation" },
  condition: { color: "#f47a7a", label: "Condition" },
  plugin: { color: "#a993ff", label: "Plugin" },
};

export const networkEdgePalette: Record<NetworkEdgeKind, { color: string; label: string }> = {
  authored_by: { color: "#71a7ff", label: "authored by" },
  uses_feature: { color: "#40d69c", label: "uses connector schema" },
  depends_on: { color: "#ffd166", label: "depends on" },
  uses_transformation: { color: "#f28bc6", label: "uses transformation" },
  guarded_by: { color: "#ff8f8f", label: "guarded by" },
  renders_with: { color: "#b5a1ff", label: "renders with" },
};

const featureByName = new Map(
  mockFeatures.map((feature) => [feature.id.replace(/^feature-/, ""), feature] as const),
);
const transformationByName = new Map(
  mockTransformations.map((item) => [item.id.replace(/^transform-/, ""), item] as const),
);
const conditionByName = new Map(
  mockConditions.map((item) => [item.id.replace(/^condition-/, ""), item] as const),
);
const particleByName = new Map(
  mockExploreParticles.map((particle) => [particle.id, particle] as const),
);
const pluginByView = new Map(
  mockPlugins
    .filter((plugin) => plugin.viewId)
    .map((plugin) => [plugin.viewId!, plugin.id] as const),
);

const slotByKindTemplate: Record<NetworkNodeKind, number> = {
  creator: 0,
  particle: 0,
  feature: 0,
  transformation: 0,
  condition: 0,
  plugin: 0,
};

const columnByKind: Record<NetworkNodeKind, number> = {
  creator: 0,
  particle: 1,
  feature: 2,
  transformation: 3,
  condition: 4,
  plugin: 5,
};

const columnGap = 300;
const rowGap = 96;
const startX = 140;
const startY = 110;

const positionFor = (slotByKind: Record<NetworkNodeKind, number>, kind: NetworkNodeKind) => {
  const slot = slotByKind[kind];
  slotByKind[kind] += 1;
  return {
    x: startX + columnByKind[kind] * columnGap,
    y: startY + slot * rowGap,
  };
};

const addNodeFactory = (
  nodes: NetworkGraphNode[],
  nodeById: Map<string, NetworkGraphNode>,
  slotByKind: Record<NetworkNodeKind, number>,
) => {
  return (
    node: Omit<NetworkGraphNode, "x" | "y" | "size"> &
      Partial<Pick<NetworkGraphNode, "x" | "y" | "size">>,
  ) => {
    if (nodeById.has(node.id)) return;
    const pos = positionFor(slotByKind, node.kind);
    const resolved: NetworkGraphNode = {
      ...node,
      x: node.x ?? pos.x,
      y: node.y ?? pos.y,
      size:
        node.size ??
        (node.kind === "creator"
          ? 8.5
          : node.kind === "particle"
            ? 7.8
            : node.kind === "plugin"
              ? 7.4
              : 6.9),
    };
    nodeById.set(resolved.id, resolved);
    nodes.push(resolved);
  };
};

const addEdgeFactory = (
  edges: NetworkGraphEdge[],
  edgeById: Map<string, NetworkGraphEdge>,
  nodeById: Map<string, NetworkGraphNode>,
) => {
  return (edge: Omit<NetworkGraphEdge, "id">) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    const id = `${edge.kind}:${edge.source}->${edge.target}`;
    if (edgeById.has(id)) return;
    const resolved = { id, ...edge };
    edgeById.set(id, resolved);
    edges.push(resolved);
  };
};

export const buildMockNetworkGraph = (): NetworkGraphData => {
  const nodes: NetworkGraphNode[] = [];
  const edges: NetworkGraphEdge[] = [];
  const nodeById = new Map<string, NetworkGraphNode>();
  const edgeById = new Map<string, NetworkGraphEdge>();
  const slotByKind = { ...slotByKindTemplate };

  const addNode = addNodeFactory(nodes, nodeById, slotByKind);
  const addEdge = addEdgeFactory(edges, edgeById, nodeById);

  mockUsers.forEach((user) => {
    addNode({
      id: `creator:${user.id}`,
      entityId: user.id,
      kind: "creator",
      label: user.nickname,
      summary: user.bio ?? "Network contributor",
      creatorId: user.id,
    });
  });

  mockRegistrySnapshot.transformations.forEach((transformation) => {
    const meta = transformationByName.get(transformation.name);
    addNode({
      id: `transformation:${transformation.name}`,
      entityId: transformation.name,
      kind: "transformation",
      label: meta?.name ?? transformation.name,
      summary: meta?.summary ?? `Transformation with ${transformation.argc} argument(s).`,
      creatorId: meta?.authorId,
    });
  });

  mockRegistrySnapshot.conditions.forEach((condition) => {
    const meta = conditionByName.get(condition.name);
    addNode({
      id: `condition:${condition.name}`,
      entityId: condition.name,
      kind: "condition",
      label: meta?.name ?? condition.name,
      summary: meta?.summary ?? `Condition with ${condition.argc} argument(s).`,
      creatorId: meta?.authorId,
    });
  });

  mockRegistrySnapshot.features.forEach((feature) => {
    const meta = featureByName.get(feature.name);
    addNode({
      id: `feature:${feature.name}`,
      entityId: feature.name,
      kind: "feature",
      label: meta?.name ?? feature.name,
      summary: meta?.summary ?? `${feature.dimensions.length} dimension schema.`,
      creatorId: meta?.authorId,
    });
  });

  mockPlugins.forEach((plugin) => {
    addNode({
      id: `plugin:${plugin.id}`,
      entityId: plugin.id,
      kind: "plugin",
      label: plugin.name,
      summary: plugin.summary ?? "Output renderer",
      creatorId: plugin.authorId,
    });
  });

  mockRegistrySnapshot.particles.forEach((particle) => {
    const meta = particleByName.get(particle.name);
    addNode({
      id: `particle:${particle.name}`,
      entityId: particle.name,
      kind: "particle",
      label: meta?.name ?? particle.name,
      summary: meta?.summary ?? "Composable runnable connector.",
      creatorId: meta?.authorId,
    });

    addEdge({
      kind: "uses_feature",
      source: `particle:${particle.name}`,
      target: `feature:${particle.featureName}`,
    });

    particle.composites
      .filter((name): name is string => Boolean(name))
      .forEach((dependency) => {
        addEdge({
          kind: "depends_on",
          source: `particle:${particle.name}`,
          target: `particle:${dependency}`,
        });
      });

    if (particle.conditionName) {
      addEdge({
        kind: "guarded_by",
        source: `particle:${particle.name}`,
        target: `condition:${particle.conditionName}`,
      });
    }

    const pluginId = pluginByView.get(meta?.viewId ?? "midi");
    if (pluginId) {
      addEdge({
        kind: "renders_with",
        source: `particle:${particle.name}`,
        target: `plugin:${pluginId}`,
      });
    }
  });

  mockRegistrySnapshot.features.forEach((feature) => {
    const seen = new Set<string>();
    feature.dimensions.forEach((dimension) => {
      dimension.transformations.forEach((transformation) => {
        if (seen.has(transformation.name)) return;
        seen.add(transformation.name);
        addEdge({
          kind: "uses_transformation",
          source: `feature:${feature.name}`,
          target: `transformation:${transformation.name}`,
        });
      });
    });
  });

  nodes.forEach((node) => {
    if (!node.creatorId) return;
    addEdge({
      kind: "authored_by",
      source: `creator:${node.creatorId}`,
      target: node.id,
    });
  });

  return { nodes, edges, nodeById, edgeById };
};

export const getNetworkLibraryRegistryName = (item: LibraryItem) => {
  if (item.kind === "feature") return item.id.replace(/^feature-/, "");
  if (item.kind === "transformation") return item.id.replace(/^transform-/, "");
  if (item.kind === "condition") return item.id.replace(/^condition-/, "");
  return item.id;
};

export const sliceNetworkGraphAround = (
  graph: NetworkGraphData,
  seedNodeIds: string[],
  maxHops = 1,
): Pick<NetworkGraphData, "nodes" | "edges"> => {
  const frontier = [...new Set(seedNodeIds)].filter((id) => graph.nodeById.has(id));
  const keep = new Set<string>(frontier);
  const adjacency = new Map<string, Set<string>>();

  graph.edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  });

  let current = frontier;
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = new Set<string>();
    current.forEach((id) => {
      (adjacency.get(id) ?? new Set()).forEach((neighbor) => {
        if (keep.has(neighbor)) return;
        keep.add(neighbor);
        next.add(neighbor);
      });
    });
    current = [...next];
    if (current.length === 0) break;
  }

  const nodes = graph.nodes.filter((node) => keep.has(node.id));
  const edges = graph.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
  return { nodes, edges };
};

export const networkNodeStudioKind = (kind: NetworkNodeKind): string => {
  if (kind === "plugin") return "plugin";
  if (kind === "feature" || kind === "particle") return "connector";
  return kind;
};
