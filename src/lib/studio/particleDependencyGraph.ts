import type { Edge, Node } from "@xyflow/svelte";

import {
  getParticleDependencyRegistrySnapshot,
  getParticleRecordById,
} from "$lib/feed/particlePostData";
import {
  buildConnectorTreeGraph,
  type ConnectorTreeNodeData,
  type ConnectorTreeTransformationInstance,
} from "$lib/studio/connectorTreeGraph";

type LegacyFeatureNodeData = {
  label: string;
  kind: "feature";
  particleId?: string;
  sourceId?: string;
  dimensions?: number;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: ConnectorTreeTransformationInstance[];
  networkId?: string;
  fromNetwork?: boolean;
  placeholder?: boolean;
  placeholderDetail?: string;
  placeholderState?: "loading" | "warning";
};

export type StudioDependencyNodeData = ConnectorTreeNodeData | LegacyFeatureNodeData;

export type StudioDependencyNode = Node<StudioDependencyNodeData>;

const createStableIdFactory = (scope: string) => {
  let index = 0;
  const prefix =
    scope
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "connector";
  return () => `${prefix}-${index++}`;
};

const createTransformationInstance = (
  key: string,
  name: string,
  args: number[] = [],
): ConnectorTreeTransformationInstance => ({
  id: `tx-${key}`,
  name,
  args,
  status: "network",
});

const buildFallbackGraph = (
  particleName: string,
  label: string,
  dependencies: string[],
): { nodes: StudioDependencyNode[]; edges: Edge[] } => {
  const rootId = `feature-${particleName}-fallback`;
  const nodes: StudioDependencyNode[] = [
    {
      id: rootId,
      type: "feature",
      draggable: false,
      position: { x: 360, y: 56 },
      data: {
        label,
        kind: "feature",
        dimensions: Math.max(1, dependencies.length),
        sourceId: particleName,
        networkId: particleName,
        fromNetwork: true,
      },
    },
  ];
  const edges: Edge[] = [];
  const spacingX = 220;
  const startX = 360 - ((Math.max(1, dependencies.length) - 1) * spacingX) / 2;

  dependencies.forEach((dependencyId, index) => {
    const depNodeId = `particle-${particleName}-fallback-${dependencyId}-${index}`;
    nodes.push({
      id: depNodeId,
      type: "particle",
      draggable: false,
      position: {
        x: startX + index * spacingX,
        y: 252,
      },
      data: {
        label: getParticleRecordById(dependencyId)?.name ?? dependencyId,
        kind: "particle",
        particleId: dependencyId,
        networkId: dependencyId,
        fromNetwork: true,
      },
    });
    edges.push({
      id: `edge-${rootId}-${depNodeId}`,
      source: rootId,
      sourceHandle: `dim-${index}`,
      target: depNodeId,
      targetHandle: "in",
    });
  });

  return { nodes, edges };
};

const buildLegacyFeatureParticleGraph = (
  particleName: string,
): { nodes: StudioDependencyNode[]; edges: Edge[] } | null => {
  const { particles: particleRegistry, features: featureRegistry } =
    getParticleDependencyRegistrySnapshot();
  const particle = particleRegistry[particleName];
  const particleRecord = getParticleRecordById(particleName);

  if (!particle) {
    if (!particleRecord) return null;
    return buildFallbackGraph(
      particleName,
      particleRecord.name,
      particleRecord.dependencies.filter((id) => id.trim().length > 0),
    );
  }

  const feature = featureRegistry[particle.featureName];
  if (!feature) {
    const fallbackDependencies = particle.composites.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const dependencies = fallbackDependencies.length
      ? fallbackDependencies
      : (particleRecord?.dependencies ?? []);
    return buildFallbackGraph(
      particleName,
      particleRecord?.name ?? particle.name,
      dependencies.filter((id) => id.trim().length > 0),
    );
  }

  const nodes: StudioDependencyNode[] = [];
  const edges: Edge[] = [];
  const featureId = `feature-${particleName}-${feature.name}`;
  const featureX = 360;
  const featureY = 56;

  nodes.push({
    id: featureId,
    type: "feature",
    draggable: false,
    position: { x: featureX, y: featureY },
    data: {
      label: feature.name,
      kind: "feature",
      dimensions: feature.dimensions.length,
      sourceId: feature.name,
      networkId: feature.name,
      fromNetwork: true,
    },
  });

  const dimensionSpacingX = 220;
  const dimensionRowY = featureY + 160;
  const dimensionStartX = featureX - ((feature.dimensions.length - 1) * dimensionSpacingX) / 2;
  const compositeRowY = dimensionRowY + 186;

  feature.dimensions.forEach((dimension, dimIndex) => {
    const dimensionId = `dimension-${particleName}-${feature.name}-${dimIndex}`;
    const columnX = dimensionStartX + dimIndex * dimensionSpacingX;

    nodes.push({
      id: dimensionId,
      type: "dimension",
      draggable: false,
      position: { x: columnX, y: dimensionRowY },
      data: {
        label: `#${dimIndex + 1}`,
        kind: "dimension",
        parentFeatureId: featureId,
        dimensionIndex: dimIndex,
        transformations: dimension.transformations.map((transformation, txIndex) =>
          createTransformationInstance(
            `${particleName}-${feature.name}-${dimIndex}-${txIndex}-${transformation.name}`,
            transformation.name,
            transformation.args,
          ),
        ),
        fromNetwork: true,
        riStart: 0,
        riShift: 0,
        riLocked: true,
      },
    });

    edges.push({
      id: `edge-${featureId}-${dimensionId}`,
      source: featureId,
      sourceHandle: `dim-${dimIndex}`,
      target: dimensionId,
      targetHandle: "in",
    });

    const compositeName = particle.composites[dimIndex];
    if (!compositeName) return;
    const compositeId = `particle-${particleName}-${dimIndex}-${compositeName}`;
    nodes.push({
      id: compositeId,
      type: "particle",
      draggable: false,
      position: { x: columnX, y: compositeRowY },
      data: {
        label: getParticleRecordById(compositeName)?.name ?? compositeName,
        kind: "particle",
        particleId: compositeName,
        networkId: compositeName,
        fromNetwork: true,
      },
    });
    edges.push({
      id: `edge-${dimensionId}-${compositeId}`,
      source: dimensionId,
      target: compositeId,
      sourceHandle: "out",
      targetHandle: "in",
    });
  });

  return { nodes, edges };
};

export const buildParticleDependencyGraph = (
  particleName: string,
): { nodes: StudioDependencyNode[]; edges: Edge[] } => {
  const connectorRegistry = getParticleDependencyRegistrySnapshot().connectors;
  const rootConnector = connectorRegistry[particleName];

  if (rootConnector) {
    const connectorTreeGraph = buildConnectorTreeGraph({
      connectorRegistry,
      rootConnectorName: rootConnector.name,
      origin: { x: 360, y: 56 },
      options: {
        idFactory: createStableIdFactory(rootConnector.name),
        labelForConnector: (connectorName) =>
          getParticleRecordById(connectorName)?.name ?? connectorName,
      },
    });
    if (connectorTreeGraph.nodes.length > 0) {
      return {
        nodes: connectorTreeGraph.nodes as StudioDependencyNode[],
        edges: connectorTreeGraph.edges,
      };
    }
  }

  return buildLegacyFeatureParticleGraph(particleName) ?? { nodes: [], edges: [] };
};
