import type { Edge, Node } from "@xyflow/svelte";

import {
  getParticleDependencyRegistrySnapshot,
  getParticleRecordById,
} from "$lib/feed/particlePostData";

export type StudioDependencyTransformationInstance = {
  id: string;
  name: string;
  args: number[];
  status: "draft" | "network";
};

export type StudioDependencyNodeData = {
  label: string;
  kind: "particle" | "feature" | "dimension";
  particleId?: string;
  sourceId?: string;
  dimensions?: number;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: StudioDependencyTransformationInstance[];
  networkId?: string;
  fromNetwork?: boolean;
  riStart?: number;
  riShift?: number;
  riLocked?: boolean;
};

export type StudioDependencyNode = Node<StudioDependencyNodeData>;

const titleize = (value: string) =>
  value
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const createTransformationInstance = (
  key: string,
  name: string,
  args: number[] = [],
): StudioDependencyTransformationInstance => ({
  id: `tx-${key}`,
  name,
  args,
  status: "network",
});

export const buildParticleDependencyGraph = (
  particleName: string,
): { nodes: StudioDependencyNode[]; edges: Edge[] } => {
  const { particles: particleRegistry, features: featureRegistry } =
    getParticleDependencyRegistrySnapshot();
  const particleByName = new Map(Object.entries(particleRegistry));
  const featureByName = new Map(Object.entries(featureRegistry));
  const particle = particleByName.get(particleName);
  if (!particle) return { nodes: [], edges: [] };

  const feature = featureByName.get(particle.featureName);
  if (!feature) return { nodes: [], edges: [] };

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
      label: titleize(feature.name),
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
            titleize(transformation.name),
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
        label: getParticleRecordById(compositeName)?.name ?? titleize(compositeName),
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
