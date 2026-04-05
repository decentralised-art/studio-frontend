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

type ConnectorRowPreview = {
  dimension: number;
  transformations: string[];
};

export type StudioDependencyNodeData = {
  label: string;
  kind: "particle" | "feature" | "connector" | "dimension" | "condition";
  particleId?: string;
  sourceId?: string;
  dimensions?: number;
  connectorRows?: ConnectorRowPreview[];
  conditionLabel?: string | null;
  boundKind?: "static" | "forwarded" | null;
  boundSlotLabel?: string | null;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: StudioDependencyTransformationInstance[];
  networkId?: string;
  fromNetwork?: boolean;
  riStart?: number;
  riShift?: number;
  riLocked?: boolean;
  placeholder?: boolean;
  placeholderDetail?: string;
  placeholderState?: "loading" | "warning";
};

export type StudioDependencyNode = Node<StudioDependencyNodeData>;

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

const formatTransformationPreviewLabel = (name: string, args: number[] = []) => {
  const trimmed = name.trim() || "Transformation";
  if (!args.length) return trimmed;
  return `${trimmed} (${args.join(", ")})`;
};

type IncomingBindingDescriptor = {
  targetName: string;
  kind: "static" | "forwarded";
  fromSlot: number;
  forwarded: Map<number, IncomingBindingDescriptor>;
};

const getSortedCanonicalBindingEntries = (bindings: Record<string, string> = {}) =>
  Object.entries(bindings)
    .map(([slotRaw, targetRaw]) => {
      const slot = String(slotRaw).trim();
      if (!/^\d+$/.test(slot)) return null;
      const slotId = Number.parseInt(slot, 10);
      if (!Number.isInteger(slotId) || slotId < 0) return null;
      if (String(slotId) !== slot) return null;
      const targetName = String(targetRaw ?? "").trim();
      if (!targetName) return null;
      return { slotId, targetName };
    })
    .filter((value): value is { slotId: number; targetName: string } => Boolean(value))
    .sort((lhs, rhs) => lhs.slotId - rhs.slotId);

const cloneIncomingBindingMap = (bindings: Map<number, IncomingBindingDescriptor> | null) => {
  const cloned = new Map<number, IncomingBindingDescriptor>();
  if (!(bindings instanceof Map)) return cloned;
  for (const [slotId, binding] of bindings.entries()) {
    if (!Number.isInteger(slotId) || slotId < 0) continue;
    const targetName = String(binding.targetName ?? "").trim();
    if (!targetName) continue;
    const fromSlot = Number.isInteger(binding.fromSlot) ? binding.fromSlot : slotId;
    cloned.set(slotId, {
      targetName,
      kind: binding.kind === "static" ? "static" : "forwarded",
      fromSlot,
      forwarded: cloneIncomingBindingMap(binding.forwarded),
    });
  }
  return cloned;
};

const cloneIncomingBindingDescriptor = (
  binding: IncomingBindingDescriptor | null | undefined,
  fallbackSlot = 0,
): IncomingBindingDescriptor | null => {
  if (!binding) return null;
  const targetName = String(binding.targetName ?? "").trim();
  if (!targetName) return null;
  return {
    targetName,
    kind: binding.kind === "static" ? "static" : "forwarded",
    fromSlot: Number.isInteger(binding.fromSlot) ? binding.fromSlot : fallbackSlot,
    forwarded: cloneIncomingBindingMap(binding.forwarded),
  };
};

const cloneIncomingBindingAsForwarded = (
  binding: IncomingBindingDescriptor | null | undefined,
  fallbackSlot = 0,
): IncomingBindingDescriptor | null => {
  const cloned = cloneIncomingBindingDescriptor(binding, fallbackSlot);
  if (!cloned) return null;
  cloned.kind = "forwarded";
  return cloned;
};

const getSortedIncomingBindingEntries = (bindings: Map<number, IncomingBindingDescriptor>) =>
  Array.from(bindings.entries())
    .filter(([slotId, binding]) => Number.isInteger(slotId) && slotId >= 0 && Boolean(binding))
    .sort((lhs, rhs) => lhs[0] - rhs[0]);

const computeConnectorOpenSlots = (
  connectorName: string,
  connectors: Record<
    string,
    { dimensions: Array<{ composite?: string; bindings?: Record<string, string> }> }
  >,
  cache = new Map<string, number>(),
  visiting = new Set<string>(),
): number => {
  if (cache.has(connectorName)) return cache.get(connectorName) ?? 0;
  if (visiting.has(connectorName)) {
    throw new Error(`Connector cycle detected at '${connectorName}'.`);
  }
  const connector = connectors[connectorName];
  if (!connector) return 0;

  visiting.add(connectorName);
  try {
    let openSlots = 0;
    connector.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.composite) {
        openSlots += 1;
        return;
      }

      const childOpenSlots = computeConnectorOpenSlots(
        dimension.composite,
        connectors,
        cache,
        visiting,
      );
      openSlots += childOpenSlots;

      const staticTargetsByChildSlot = new Map<number, string>();
      getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
        ({ slotId, targetName }) => {
          if (slotId >= childOpenSlots) {
            throw new Error(
              `Connector '${connectorName}' has out-of-range binding slot ${slotId} at dimension ${dimIndex} (child '${dimension.composite}' exports ${childOpenSlots} slots).`,
            );
          }
          if (staticTargetsByChildSlot.has(slotId)) return;
          staticTargetsByChildSlot.set(slotId, targetName);
        },
      );

      for (const targetName of staticTargetsByChildSlot.values()) {
        openSlots += computeConnectorOpenSlots(targetName, connectors, cache, visiting);
      }
      openSlots -= staticTargetsByChildSlot.size;
    });

    cache.set(connectorName, openSlots);
    return openSlots;
  } finally {
    visiting.delete(connectorName);
  }
};

const buildConnectorTreeFromRegistry = (
  rootConnectorName: string,
  connectors: Record<
    string,
    {
      name: string;
      dimensions: Array<{
        transformations: Array<{ name: string; args: number[] }>;
        composite?: string;
        bindings?: Record<string, string>;
      }>;
      conditionName?: string;
    }
  >,
  origin: { x: number; y: number },
): { nodes: StudioDependencyNode[]; edges: Edge[] } => {
  const root = connectors[rootConnectorName];
  if (!root) return { nodes: [], edges: [] };

  const graphNodes: StudioDependencyNode[] = [];
  const graphEdges: Edge[] = [];
  const edgeKeySet = new Set<string>();
  const openSlotCache = new Map<string, number>();
  const treeInfo = new Map<string, { depth: number; children: string[] }>();
  const conditionParentById = new Map<string, string>();
  const horizontalSpacing = 320;
  const verticalSpacing = 260;
  const minLevelGap = 330;
  let leafCursor = 0;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  const pushEdge = (
    sourceId: string,
    sourceHandle: string,
    targetId: string,
    targetHandle: string,
    options?: { label?: string; kind?: "composite" | "binding" },
  ) => {
    const key = `${sourceId}|${sourceHandle}|${targetId}|${targetHandle}|${options?.kind ?? ""}|${options?.label ?? ""}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    const isBinding = options?.kind === "binding";
    graphEdges.push({
      id: nextId("edge"),
      source: sourceId,
      sourceHandle,
      target: targetId,
      targetHandle,
      ...(options?.label ? { label: options.label } : {}),
      ...(isBinding
        ? {
            style: "stroke:#c97500;stroke-dasharray:8 5;",
          }
        : {}),
    });
  };

  const createMissingNode = (
    name: string,
    detail: string,
    depth: number,
    kind: "missing" | "cycle" = "missing",
  ) => {
    const id = nextId("missing");
    graphNodes.push({
      id,
      type: "particle",
      draggable: false,
      position: { x: origin.x, y: origin.y + depth * verticalSpacing },
      data: {
        label: kind === "cycle" ? "Connector cycle" : "Loading connector...",
        kind: "particle",
        fromNetwork: true,
        placeholder: true,
        placeholderDetail: kind === "cycle" ? detail : `waiting for chain sync: ${detail}`,
        placeholderState: kind === "cycle" ? "warning" : "loading",
      },
    });
    treeInfo.set(id, { depth, children: [] });
    return id;
  };

  const expandConnector = (
    input: {
      connectorName: string;
      incomingBindings: Map<number, IncomingBindingDescriptor>;
      depth: number;
      boundDescriptor?: { kind: "static" | "forwarded"; slotLabel: string } | null;
    },
    visiting = new Set<string>(),
  ): string => {
    const connectorName = input.connectorName.trim();
    if (!connectorName) return createMissingNode("Missing connector", "Unnamed", input.depth);
    if (visiting.has(connectorName)) {
      return createMissingNode(
        "Cycle",
        `connector cycle at ${connectorName}`,
        input.depth,
        "cycle",
      );
    }
    const def = connectors[connectorName];
    if (!def) return createMissingNode("Missing connector", connectorName, input.depth, "missing");

    const connectorId = nextId(`connector-${connectorName}`);
    graphNodes.push({
      id: connectorId,
      type: "connector",
      draggable: false,
      position: { x: origin.x, y: origin.y + input.depth * verticalSpacing },
      data: {
        label: connectorName,
        kind: "connector",
        dimensions: def.dimensions.length,
        connectorRows: def.dimensions.map((dimension, dimIndex) => ({
          dimension: dimIndex + 1,
          transformations: dimension.transformations.map((transformation) =>
            formatTransformationPreviewLabel(transformation.name, transformation.args),
          ),
        })),
        conditionLabel: def.conditionName ? def.conditionName : null,
        boundKind: input.boundDescriptor?.kind ?? null,
        boundSlotLabel: input.boundDescriptor?.slotLabel ?? null,
        sourceId: connectorName,
        networkId: connectorName,
        fromNetwork: true,
      },
    });
    treeInfo.set(connectorId, { depth: input.depth, children: [] });

    if (def.conditionName) {
      const conditionNodeId = nextId(`condition-${connectorName}`);
      graphNodes.push({
        id: conditionNodeId,
        type: "condition",
        draggable: false,
        position: { x: origin.x, y: origin.y + input.depth * verticalSpacing - 120 },
        data: {
          label: def.conditionName,
          kind: "condition",
          networkId: def.conditionName,
          fromNetwork: true,
        },
      });
      conditionParentById.set(conditionNodeId, connectorId);
      pushEdge(conditionNodeId, "out", connectorId, "in");
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(connectorName);
    let openSlotId = 0;

    for (let dimId = 0; dimId < def.dimensions.length; dimId += 1) {
      const dimension = def.dimensions[dimId];

      if (!dimension.composite) {
        const replacement = input.incomingBindings.get(openSlotId) ?? null;
        if (replacement) {
          const slotLabel =
            replacement.kind === "forwarded"
              ? `slot ${openSlotId} (forwarded from ${replacement.fromSlot})`
              : `slot ${openSlotId} (static)`;
          const childId = expandConnector(
            {
              connectorName: replacement.targetName,
              incomingBindings: cloneIncomingBindingMap(replacement.forwarded),
              depth: input.depth + 1,
              boundDescriptor: { kind: replacement.kind, slotLabel },
            },
            nextVisiting,
          );
          treeInfo.get(connectorId)?.children.push(childId);
          pushEdge(connectorId, `dim-${dimId}`, childId, "in", {
            kind: "binding",
            label: `binding · slot ${openSlotId}`,
          });
        }
        openSlotId += 1;
        continue;
      }

      const childOpenSlots = computeConnectorOpenSlots(
        dimension.composite,
        connectors,
        openSlotCache,
        new Set(nextVisiting),
      );
      const staticTargetsByChildSlot = new Map<number, string>();
      getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
        ({ slotId, targetName }) => {
          if (slotId >= childOpenSlots || staticTargetsByChildSlot.has(slotId)) return;
          staticTargetsByChildSlot.set(slotId, targetName);
        },
      );

      const slotProjectedStarts = new Array(childOpenSlots).fill(0);
      const slotProjectedWidths = new Array(childOpenSlots).fill(0);
      const slotStaticTargets = new Array<string>(childOpenSlots).fill("");
      const slotSelectedBindings = new Array<IncomingBindingDescriptor | null>(childOpenSlots).fill(
        null,
      );
      const slotForwardedInternalBindings = Array.from(
        { length: childOpenSlots },
        () => new Map<number, IncomingBindingDescriptor>(),
      );
      let childOpenSlotsInParent = 0;

      for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
        slotProjectedStarts[childSlotId] = childOpenSlotsInParent;
        const staticTarget = staticTargetsByChildSlot.get(childSlotId);
        if (staticTarget) {
          const staticTargetOpenSlots = computeConnectorOpenSlots(
            staticTarget,
            connectors,
            openSlotCache,
            new Set(nextVisiting),
          );
          slotStaticTargets[childSlotId] = staticTarget;
          slotSelectedBindings[childSlotId] = {
            targetName: staticTarget,
            kind: "static",
            fromSlot: childSlotId,
            forwarded: new Map<number, IncomingBindingDescriptor>(),
          };
          slotProjectedWidths[childSlotId] = staticTargetOpenSlots;
          childOpenSlotsInParent += staticTargetOpenSlots;
          continue;
        }
        slotProjectedWidths[childSlotId] = 1;
        childOpenSlotsInParent += 1;
      }

      for (const [parentSlotId, parentBinding] of getSortedIncomingBindingEntries(
        input.incomingBindings,
      )) {
        if (parentSlotId < openSlotId) continue;
        const localSlotId = parentSlotId - openSlotId;
        if (localSlotId >= childOpenSlotsInParent) continue;
        for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
          const rangeStart = slotProjectedStarts[childSlotId];
          const rangeWidth = slotProjectedWidths[childSlotId];
          if (rangeWidth <= 0) continue;
          const rangeEndExclusive = rangeStart + rangeWidth;
          if (localSlotId < rangeStart || localSlotId >= rangeEndExclusive) continue;
          const staticTarget = slotStaticTargets[childSlotId];
          if (!staticTarget) {
            const forwardedBinding = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
            if (forwardedBinding) slotSelectedBindings[childSlotId] = forwardedBinding;
            break;
          }
          const offset = localSlotId - rangeStart;
          const forwardedInternal = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
          if (forwardedInternal) {
            slotForwardedInternalBindings[childSlotId].set(offset, forwardedInternal);
          }
          break;
        }
      }

      const childBindings = new Map<number, IncomingBindingDescriptor>();
      for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
        const selectedBinding = slotSelectedBindings[childSlotId];
        if (!selectedBinding) continue;
        const finalized = cloneIncomingBindingDescriptor(selectedBinding, childSlotId);
        if (!finalized) continue;
        if (slotStaticTargets[childSlotId]) {
          finalized.forwarded = cloneIncomingBindingMap(slotForwardedInternalBindings[childSlotId]);
        }
        childBindings.set(childSlotId, finalized);
      }

      const compositeChildId = expandConnector(
        {
          connectorName: dimension.composite,
          incomingBindings: childBindings,
          depth: input.depth + 1,
          boundDescriptor: null,
        },
        nextVisiting,
      );
      treeInfo.get(connectorId)?.children.push(compositeChildId);
      pushEdge(connectorId, `dim-${dimId}`, compositeChildId, "in", {
        kind: "composite",
        label: `composite · D${dimId + 1}`,
      });
      openSlotId += childOpenSlotsInParent;
    }

    return connectorId;
  };

  const rootId = expandConnector({
    connectorName: rootConnectorName,
    incomingBindings: new Map<number, IncomingBindingDescriptor>(),
    depth: 0,
    boundDescriptor: null,
  });

  const xByNodeId = new Map<string, number>();
  const computeTreeX = (nodeId: string): number => {
    const existing = xByNodeId.get(nodeId);
    if (typeof existing === "number") return existing;
    const info = treeInfo.get(nodeId);
    if (!info || info.children.length === 0) {
      const x = origin.x + leafCursor * horizontalSpacing;
      leafCursor += 1;
      xByNodeId.set(nodeId, x);
      return x;
    }
    const childrenX = info.children.map((childId) => computeTreeX(childId));
    const x = childrenX.reduce((sum, item) => sum + item, 0) / childrenX.length;
    xByNodeId.set(nodeId, x);
    return x;
  };

  const rootX = computeTreeX(rootId);
  const xShift = origin.x - rootX;
  const levelSortedNodeIds = Array.from(treeInfo.entries())
    .map(([nodeId, info]) => ({ nodeId, depth: info.depth }))
    .sort(
      (a, b) =>
        a.depth - b.depth || (xByNodeId.get(a.nodeId) ?? 0) - (xByNodeId.get(b.nodeId) ?? 0),
    );
  let currentDepth: number | null = null;
  let previousX = 0;
  levelSortedNodeIds.forEach(({ nodeId, depth }) => {
    if (currentDepth !== depth) {
      currentDepth = depth;
      previousX = -Infinity;
    }
    const currentX = xByNodeId.get(nodeId) ?? 0;
    const nextX = Number.isFinite(previousX)
      ? Math.max(currentX, previousX + minLevelGap)
      : currentX;
    xByNodeId.set(nodeId, nextX);
    previousX = nextX;
  });

  graphNodes.forEach((node) => {
    const info = treeInfo.get(node.id);
    if (!info) return;
    node.position = {
      x: (xByNodeId.get(node.id) ?? origin.x) + xShift,
      y: origin.y + info.depth * verticalSpacing,
    };
  });

  const connectorPositionById = new Map<string, { x: number; y: number }>();
  graphNodes.forEach((node) => {
    if (node.data.kind !== "connector") return;
    connectorPositionById.set(node.id, { x: node.position.x, y: node.position.y });
  });
  conditionParentById.forEach((parentId, conditionId) => {
    const parentPos = connectorPositionById.get(parentId);
    const conditionNode = graphNodes.find((candidate) => candidate.id === conditionId);
    if (!parentPos || !conditionNode) return;
    conditionNode.position = {
      x: parentPos.x,
      y: parentPos.y - 120,
    };
  });

  return { nodes: graphNodes, edges: graphEdges };
};

export const buildParticleDependencyGraph = (
  particleName: string,
): { nodes: StudioDependencyNode[]; edges: Edge[] } => {
  const connectorRegistry = getParticleDependencyRegistrySnapshot().connectors;
  const rootConnector = connectorRegistry[particleName];
  if (rootConnector) {
    const connectorTreeGraph = buildConnectorTreeFromRegistry(
      rootConnector.name,
      connectorRegistry,
      { x: 360, y: 56 },
    );
    if (connectorTreeGraph.nodes.length > 0) {
      return connectorTreeGraph;
    }
  }

  const buildFallbackGraph = (
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

  const { particles: particleRegistry, features: featureRegistry } =
    getParticleDependencyRegistrySnapshot();
  const particleByName = new Map(Object.entries(particleRegistry));
  const featureByName = new Map(Object.entries(featureRegistry));
  const particle = particleByName.get(particleName);
  const particleRecord = getParticleRecordById(particleName);
  if (!particle) {
    if (!particleRecord) return { nodes: [], edges: [] };
    return buildFallbackGraph(
      particleRecord.name,
      particleRecord.dependencies.filter((id) => id.trim().length > 0),
    );
  }

  const feature = featureByName.get(particle.featureName);
  if (!feature) {
    const fallbackDependencies = particle.composites.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const dependencies = fallbackDependencies.length
      ? fallbackDependencies
      : (particleRecord?.dependencies ?? []);
    return buildFallbackGraph(
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
