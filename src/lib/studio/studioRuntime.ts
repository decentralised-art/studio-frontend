import {
  mockConditionRegistry,
  mockRegistrySnapshot,
  mockTransformationRegistry,
  type MockFeatureDef,
  type MockParticleDef,
  type MockRunConfig,
  type MockRunningInstance,
  type MockTransformationDef,
} from "$lib/particles/mockPtNetwork";
import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import type {
  StudioConnectorDef,
  StudioRunningInstanceRef,
} from "$lib/studio/domain/connectorModel";
import { normalizeBindingsMap } from "$lib/studio/domain/slotProjection";

export type StudioNodeKind =
  | "particle"
  | "feature"
  | "connector"
  | "dimension"
  | "transformation"
  | "condition"
  | "plugin"
  | "agent";

export type StudioNodeData = {
  label: string;
  kind: StudioNodeKind;
  particleId?: string;
  sourceId?: string;
  viewId?: string;
  dimensions?: number;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: Array<
    | string
    | {
        id?: string;
        name: string;
        args: number[];
        status?: "draft" | "network";
      }
  >;
  networkId?: string;
  fromNetwork?: boolean;
  riStart?: number;
  riShift?: number;
  riTargetPosition?: number;
  staticRi?: Record<string, StudioRunningInstanceRef>;
};

export type StudioNode = {
  id: string;
  data: StudioNodeData;
  draggable?: boolean;
};

export type StudioEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: unknown;
  data?: unknown;
};

export type StudioGraph = {
  nodes: StudioNode[];
  edges: StudioEdge[];
};

type TransformationRegistry = Record<
  string,
  {
    argc: number;
    run: (x: number, args: number[]) => number;
  }
>;
type ConditionRegistry = Record<
  string,
  {
    argc: number;
    check: (args: number[]) => boolean;
  }
>;

type RuntimeRegistry = {
  connectors: Record<string, StudioConnectorDef>;
  features: Record<string, MockFeatureDef>;
  particles: Record<string, MockParticleDef>;
  transformations: TransformationRegistry;
  conditions: ConditionRegistry;
};

type StudioConditionEdgeData = {
  conditionArgs?: unknown;
  condition_args?: unknown;
};

export type StudioRuntimeSnapshot = {
  registry: RuntimeRegistry;
  rootConnector: string;
  // Compatibility alias for still-legacy call sites.
  rootParticle: string;
  warnings: string[];
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s-_]+/g, "");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildNameMap = (names: string[]) => {
  const map = new Map<string, string>();
  names.forEach((name) => {
    map.set(normalizeKey(name), name);
  });
  return map;
};

const parseTransformationLabel = (
  label: string,
  nameMap: Map<string, string>,
): MockTransformationDef => {
  const match = label.match(/^\s*([^()]+?)(?:\(([^)]*)\))?\s*$/);
  const rawName = (match?.[1] ?? label).trim();
  const normalized = normalizeKey(rawName);
  const canonical = nameMap.get(normalized) ?? rawName;
  const argsRaw = match?.[2]?.trim() ?? "";
  const args = argsRaw
    .split(",")
    .map((value) => Math.trunc(Number(value.trim())))
    .filter((value) => Number.isFinite(value));
  return { name: canonical as MockTransformationDef["name"], args };
};

const connectorToFeature = (connector: StudioConnectorDef): MockFeatureDef => ({
  name: connector.name,
  dimensions: connector.dimensions.map((dimension, index) => ({
    label: `dim-${index + 1}`,
    transformations: dimension.transformations.map((tx) => ({
      name: tx.name as MockTransformationDef["name"],
      args: [...tx.args],
    })),
  })),
});

const connectorToParticle = (connector: StudioConnectorDef): MockParticleDef => ({
  name: connector.name,
  featureName: connector.name,
  composites: connector.dimensions.map((dimension) => dimension.composite ?? null),
  conditionName: connector.conditionName,
  conditionArgs: connector.conditionName ? [...(connector.conditionArgs ?? [])] : undefined,
});

const buildBaseRegistry = (): RuntimeRegistry => {
  const features = Object.fromEntries(
    mockRegistrySnapshot.features.map((feature) => [
      feature.name,
      {
        name: feature.name,
        dimensions: feature.dimensions.map((dimension) => ({
          label: dimension.label,
          transformations: dimension.transformations.map((tx) => ({
            name: tx.name,
            args: [...tx.args],
          })),
        })),
      } satisfies MockFeatureDef,
    ]),
  );

  const particles: Record<string, MockParticleDef> = Object.fromEntries(
    mockRegistrySnapshot.particles.map((particle) => [
      particle.name,
      {
        name: particle.name,
        featureName: particle.featureName,
        composites: [...particle.composites],
        conditionName: particle.conditionName,
        conditionArgs: particle.conditionArgs ? [...particle.conditionArgs] : undefined,
      } satisfies MockParticleDef,
    ]),
  );

  const connectors: Record<string, StudioConnectorDef> = {};
  Object.values(particles).forEach((particle) => {
    const feature = features[particle.featureName];
    if (!feature) return;
    connectors[particle.name] = {
      name: particle.name,
      dimensions: feature.dimensions.map((dimension, index) => ({
        transformations: dimension.transformations.map((tx) => ({
          name: tx.name as string,
          args: [...tx.args],
        })),
        composite: particle.composites[index] ?? undefined,
        bindings: {},
      })),
      conditionName: particle.conditionName,
      conditionArgs: particle.conditionName ? [...(particle.conditionArgs ?? [])] : undefined,
    };
  });

  return {
    connectors,
    features,
    particles,
    transformations: { ...mockTransformationRegistry },
    conditions: { ...mockConditionRegistry },
  };
};

const parseDimensionHandle = (handle?: string | null) => {
  if (!handle || !handle.startsWith("dim-")) return null;
  const value = Number(handle.replace("dim-", ""));
  return Number.isFinite(value) ? value : null;
};

const resolveNodeName = (node: StudioNode) => {
  if (node.data.networkId) return node.data.networkId;
  if (node.data.particleId) return node.data.particleId;
  return slugify(node.data.label) || node.data.label;
};

const isConnectorKind = (kind: StudioNodeKind) => kind === "feature" || kind === "connector";

const isCompositeTargetNode = (node: StudioNode | null | undefined): node is StudioNode =>
  Boolean(node && (isConnectorKind(node.data.kind) || node.data.kind === "particle"));

const getDimensionNodesForFeature = (featureId: string, graph: StudioGraph) => {
  const dimensionIds = new Set(
    graph.edges.filter((edge) => edge.source === featureId).map((edge) => edge.target),
  );
  return graph.nodes.filter((node) => node.data.kind === "dimension" && dimensionIds.has(node.id));
};

const getDimensionIndex = (dimension: StudioNode, graph: StudioGraph) => {
  if (typeof dimension.data.dimensionIndex === "number") return dimension.data.dimensionIndex;
  const edge = graph.edges.find((item) => item.target === dimension.id);
  if (!edge) return null;
  return parseDimensionHandle(edge.sourceHandle);
};

const parseBindingSlotFromLabel = (label: unknown): number | null => {
  if (typeof label !== "string") return null;
  const match = label.match(/slot\s+(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const getConnectorEdgeRelation = (edge: StudioEdge): "composite" | "binding" | "unknown" => {
  if (edge.data && typeof edge.data === "object") {
    const relation = (edge.data as { relation?: unknown; kind?: unknown }).relation;
    if (relation === "composite" || relation === "binding") return relation;
    const kind = (edge.data as { relation?: unknown; kind?: unknown }).kind;
    if (kind === "composite" || kind === "binding") return kind;
  }
  const label = typeof edge.label === "string" ? edge.label.trim().toLowerCase() : "";
  if (label.startsWith("composite")) return "composite";
  if (label.startsWith("binding")) return "binding";
  return "unknown";
};

const getBindingSlotFromEdge = (edge: StudioEdge): number | null => {
  if (edge.data && typeof edge.data === "object") {
    const slot = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
      .bindingSlot;
    if (Number.isInteger(slot) && Number(slot) >= 0) return Number(slot);
    const altSlot = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
      .binding_slot;
    if (Number.isInteger(altSlot) && Number(altSlot) >= 0) return Number(altSlot);
    const legacy = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
      .slot;
    if (Number.isInteger(legacy) && Number(legacy) >= 0) return Number(legacy);
  }
  return parseBindingSlotFromLabel(edge.label);
};

const isConditionTargetHandle = (handle: string | null | undefined) => {
  const normalized = handle ?? "in";
  return normalized === "condition" || normalized === "in";
};

const parseConditionArgsFromEdge = (edge: StudioEdge): number[] | undefined => {
  if (!edge.data || typeof edge.data !== "object" || Array.isArray(edge.data)) return undefined;
  const data = edge.data as StudioConditionEdgeData;
  const rawArgs = data.conditionArgs ?? data.condition_args;
  if (!Array.isArray(rawArgs)) return undefined;
  return rawArgs
    .map((arg) => Number(arg))
    .filter((arg) => Number.isFinite(arg))
    .map((arg) => Math.trunc(arg));
};

const resolveConnectorDimensionLinks = (
  connectorId: string,
  dimensionIndex: number,
  graph: StudioGraph,
  fallbackDimensionId?: string,
) => {
  const sourceHandle = `dim-${dimensionIndex}`;
  const connectorEdges = graph.edges
    .filter(
      (edge) =>
        edge.source === connectorId &&
        (edge.sourceHandle ?? "") === sourceHandle &&
        (edge.targetHandle ?? "") === "in" &&
        Boolean(edge.target),
    )
    .flatMap((edge) => {
      const target = graph.nodes.find((node) => node.id === edge.target) ?? null;
      if (!isCompositeTargetNode(target)) return [];
      return [{ edge, target }];
    });

  if (connectorEdges.length) {
    const compositeEntry =
      connectorEdges.find((entry) => getConnectorEdgeRelation(entry.edge) === "composite") ??
      connectorEdges[0];
    const compositeNode = compositeEntry?.target ?? null;
    const composite = compositeNode ? resolveNodeName(compositeNode) : null;
    const bindings: Record<string, string> = {};

    if (compositeNode && isConnectorKind(compositeNode.data.kind)) {
      const usedSlots = new Set<number>();
      let nextSlot = 0;
      connectorEdges.forEach((item) => {
        if (item === compositeEntry) return;
        if (!item.target || !isConnectorKind(item.target.data.kind)) return;
        let slot = getBindingSlotFromEdge(item.edge);
        if (slot === null || usedSlots.has(slot)) {
          while (usedSlots.has(nextSlot)) nextSlot += 1;
          slot = nextSlot;
          nextSlot += 1;
        }
        usedSlots.add(slot);
        bindings[String(slot)] = resolveNodeName(item.target);
      });
    }

    return { composite, bindings };
  }

  if (fallbackDimensionId) {
    const edge = graph.edges.find(
      (item) => item.source === fallbackDimensionId && (item.sourceHandle ?? "") === "out",
    );
    if (edge?.target) {
      const target = graph.nodes.find((node) => node.id === edge.target) ?? null;
      if (isCompositeTargetNode(target)) {
        return { composite: resolveNodeName(target), bindings: {} };
      }
    }
  }

  return { composite: null, bindings: {} as Record<string, string> };
};

const buildConnectorFromGraph = (
  featureNode: StudioNode,
  graph: StudioGraph,
  nameMap: Map<string, string>,
): StudioConnectorDef => {
  const connectorName = resolveNodeName(featureNode);
  const dimensionNodes = getDimensionNodesForFeature(featureNode.id, graph);
  const dimensionCount = Math.max(featureNode.data.dimensions ?? 1, dimensionNodes.length, 1);

  const dimensions: StudioConnectorDef["dimensions"] = Array.from(
    { length: dimensionCount },
    () => ({
      transformations: [],
      composite: undefined,
      bindings: {},
    }),
  );

  dimensionNodes.forEach((dimension) => {
    const index = getDimensionIndex(dimension, graph);
    const targetIndex = index ?? dimensions.findIndex((dim) => dim.transformations.length === 0);
    if (targetIndex < 0 || targetIndex >= dimensions.length) return;
    const labels = dimension.data.transformations ?? [];
    const links = resolveConnectorDimensionLinks(featureNode.id, targetIndex, graph, dimension.id);
    dimensions[targetIndex] = {
      transformations: labels.map((item) => {
        if (typeof item === "string") {
          return parseTransformationLabel(item, nameMap);
        }
        const normalized = normalizeKey(item.name);
        const canonical = nameMap.get(normalized) ?? item.name;
        return {
          name: canonical as string,
          args: [...item.args],
        };
      }),
      composite: links.composite ?? undefined,
      bindings: links.bindings,
      riStart: dimension.data.riStart,
      riShift: dimension.data.riShift,
    };
  });

  for (let index = 0; index < dimensions.length; index += 1) {
    const links = resolveConnectorDimensionLinks(featureNode.id, index, graph);
    if (links.composite && !dimensions[index].composite) {
      dimensions[index].composite = links.composite;
    }
    if (Object.keys(links.bindings).length) {
      dimensions[index].bindings = links.bindings;
    }
  }

  const staticRiRaw = featureNode.data.staticRi;
  const staticRi =
    staticRiRaw && typeof staticRiRaw === "object"
      ? Object.fromEntries(
          Object.entries(staticRiRaw)
            .map(([key, value]) => {
              const slotId = Number.parseInt(key, 10);
              if (!Number.isInteger(slotId) || slotId < 0) return null;
              if (!value || typeof value !== "object") return null;
              const startPoint = Number((value as { startPoint?: unknown }).startPoint);
              const transformationShift = Number(
                (value as { transformationShift?: unknown }).transformationShift,
              );
              if (!Number.isFinite(startPoint) || !Number.isFinite(transformationShift)) {
                return null;
              }
              return [
                String(slotId),
                {
                  startPoint: Math.trunc(startPoint),
                  transformationShift: Math.trunc(transformationShift),
                } satisfies StudioRunningInstanceRef,
              ] as const;
            })
            .filter((entry): entry is readonly [string, StudioRunningInstanceRef] => Boolean(entry))
            .sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10)),
        )
      : undefined;

  const condition = resolveConditionForFeature(featureNode.id, graph);

  return {
    name: connectorName,
    dimensions,
    ...(condition?.name ? { conditionName: condition.name } : {}),
    ...(condition?.args ? { conditionArgs: condition.args } : {}),
    ...(staticRi && Object.keys(staticRi).length > 0 ? { staticRi } : {}),
  };
};

const resolveConditionForFeature = (featureId: string, graph: StudioGraph) => {
  const edge = graph.edges.find((item) => {
    if (item.target !== featureId || !isConditionTargetHandle(item.targetHandle)) return false;
    const source = graph.nodes.find((node) => node.id === item.source);
    return source?.data.kind === "condition";
  });
  if (!edge?.source) return null;
  const source = graph.nodes.find((node) => node.id === edge.source);
  if (!source || source.data.kind !== "condition") return null;
  return {
    name: resolveNodeName(source),
    args: parseConditionArgsFromEdge(edge),
  };
};

const preserveNetworkConditionMetadata = (
  localDef: StudioConnectorDef,
  networkDef: StudioConnectorDef,
): Pick<StudioConnectorDef, "conditionName" | "conditionArgs"> => {
  const conditionName = localDef.conditionName ?? networkDef.conditionName;
  if (!conditionName) return {};

  const conditionArgs =
    localDef.conditionArgs !== undefined
      ? localDef.conditionArgs
      : conditionName === networkDef.conditionName
        ? networkDef.conditionArgs
        : undefined;

  return {
    conditionName,
    ...(conditionArgs !== undefined ? { conditionArgs: [...conditionArgs] } : {}),
  };
};

const findRootFeature = (graph: StudioGraph) => {
  const features = graph.nodes.filter((node) => isConnectorKind(node.data.kind));
  if (features.length <= 1) return features[0] ?? null;

  const connectorIds = new Set(features.map((feature) => feature.id));
  const incomingCompositeTargets = new Set<string>();
  graph.edges.forEach((edge) => {
    if (!edge.source || !edge.target) return;
    if (!connectorIds.has(edge.source) || !connectorIds.has(edge.target)) return;
    if (parseDimensionHandle(edge.sourceHandle) === null) return;
    if ((edge.targetHandle ?? "") !== "in") return;
    incomingCompositeTargets.add(edge.target);
  });

  const roots = features.filter((feature) => !incomingCompositeTargets.has(feature.id));
  if (roots.length === 1) return roots[0];
  if (roots.length > 1) {
    return (
      roots
        .map((feature) => {
          const outCount = graph.edges.filter((edge) => edge.source === feature.id).length;
          return { feature, outCount };
        })
        .sort((a, b) => b.outCount - a.outCount)[0]?.feature ?? roots[0]
    );
  }

  return (
    features
      .map((feature) => {
        const outCount = graph.edges.filter((edge) => edge.source === feature.id).length;
        return { feature, outCount };
      })
      .sort((a, b) => b.outCount - a.outCount)[0]?.feature ?? null
  );
};

const buildRootConnector = (
  featureNode: StudioNode,
  graph: StudioGraph,
  rootName: string,
  nameMap: Map<string, string>,
): StudioConnectorDef => {
  const connector = buildConnectorFromGraph(featureNode, graph, nameMap);
  return { ...connector, name: rootName };
};

const computeConnectorOpenSlots = (
  registry: RuntimeRegistry,
  connectorName: string,
  cache = new Map<string, number>(),
  visiting = new Set<string>(),
): number => {
  if (cache.has(connectorName)) return cache.get(connectorName) ?? 0;
  if (visiting.has(connectorName)) {
    throw new Error(`Connector cycle detected at '${connectorName}'.`);
  }

  const connector = registry.connectors[connectorName];
  if (!connector) {
    throw new Error(`Missing connector '${connectorName}'.`);
  }

  visiting.add(connectorName);
  try {
    let openSlots = 0;

    connector.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.composite) {
        openSlots += 1;
        return;
      }

      const childOpenSlots = computeConnectorOpenSlots(
        registry,
        dimension.composite,
        cache,
        visiting,
      );
      openSlots += childOpenSlots;

      const normalizedBindings = normalizeBindingsMap(dimension.bindings ?? {});
      normalizedBindings.forEach((binding) => {
        if (binding.slotId >= childOpenSlots) {
          throw new Error(
            `Connector '${connector.name}' dimension ${dimIndex + 1} has out-of-range binding slot ${binding.slotId} (child '${dimension.composite}' exports ${childOpenSlots} slots).`,
          );
        }
      });

      normalizedBindings.forEach((binding) => {
        openSlots += computeConnectorOpenSlots(registry, binding.targetConnector, cache, visiting);
      });
      openSlots -= normalizedBindings.length;
    });

    cache.set(connectorName, openSlots);
    return openSlots;
  } finally {
    visiting.delete(connectorName);
  }
};

const validateBindingsForDimension = (
  registry: RuntimeRegistry,
  connector: StudioConnectorDef,
  dimensionIndex: number,
  warnings: string[],
  openSlotsCache: Map<string, number>,
) => {
  const dimension = connector.dimensions[dimensionIndex];
  const bindingKeys = Object.keys(dimension.bindings ?? {});

  if (!dimension.composite) {
    if (!bindingKeys.length) return;
    warnings.push(
      `Connector ${connector.name} dimension ${dimensionIndex + 1} has bindings without composite.`,
    );
    return;
  }

  const child = registry.connectors[dimension.composite];
  if (!child) {
    warnings.push(
      `Connector ${connector.name} dimension ${dimensionIndex + 1} references missing composite ${dimension.composite}.`,
    );
    return;
  }

  if (!bindingKeys.length) return;

  let childOpenSlots = 0;
  try {
    childOpenSlots = computeConnectorOpenSlots(
      registry,
      child.name,
      openSlotsCache,
      new Set<string>(),
    );
  } catch (error) {
    warnings.push(
      `Failed to resolve open slots for ${connector.name} dimension ${dimensionIndex + 1}: ${String(error)}`,
    );
    return;
  }

  let normalized;
  try {
    normalized = normalizeBindingsMap(dimension.bindings);
  } catch (error) {
    warnings.push(
      `Invalid bindings on ${connector.name} dimension ${dimensionIndex + 1}: ${String(error)}`,
    );
    return;
  }

  normalized.forEach((binding) => {
    if (!registry.connectors[binding.targetConnector]) {
      warnings.push(
        `Binding target ${binding.targetConnector} not found for ${connector.name} dimension ${dimensionIndex + 1}.`,
      );
    }
    if (binding.slotId >= childOpenSlots) {
      warnings.push(
        `Binding slot ${binding.slotId} out of range for ${connector.name} dimension ${dimensionIndex + 1}. Child connector ${child.name} exposes ${childOpenSlots} open slots.`,
      );
    }
  });
};

const validateConnectorRegistry = (registry: RuntimeRegistry, warnings: string[]) => {
  const openSlotsCache = new Map<string, number>();
  Object.values(registry.connectors).forEach((connector) => {
    connector.dimensions.forEach((dimension, index) => {
      dimension.transformations.forEach((tx) => {
        const txDef = registry.transformations[tx.name];
        if (!txDef) {
          warnings.push(`Missing transformation: ${tx.name} (connector ${connector.name}).`);
          return;
        }
        if (txDef.argc !== tx.args.length) {
          warnings.push(
            `TransformationArgumentsMismatch: ${tx.name} (connector ${connector.name}).`,
          );
        }
      });
      validateBindingsForDimension(registry, connector, index, warnings, openSlotsCache);
    });

    if (connector.conditionName) {
      const condition = registry.conditions[connector.conditionName];
      if (!condition) {
        warnings.push(
          `Missing condition: ${connector.conditionName} (connector ${connector.name}).`,
        );
      } else if ((connector.conditionArgs ?? []).length !== condition.argc) {
        warnings.push(
          `ConditionArgumentsMismatch: ${connector.conditionName} (connector ${connector.name}).`,
        );
      }
    }
  });
};

export const buildStudioRuntime = (
  graph: StudioGraph,
  options: { rootLabel: string; rootParticleId?: string; rootConnectorId?: string },
  overrides: Partial<RuntimeRegistry> = {},
): StudioRuntimeSnapshot => {
  const baseRegistry = buildBaseRegistry();
  const registry: RuntimeRegistry = {
    connectors: { ...baseRegistry.connectors, ...(overrides.connectors ?? {}) },
    features: { ...baseRegistry.features, ...(overrides.features ?? {}) },
    particles: { ...baseRegistry.particles, ...(overrides.particles ?? {}) },
    transformations: {
      ...baseRegistry.transformations,
      ...(overrides.transformations ?? {}),
    },
    conditions: { ...baseRegistry.conditions, ...(overrides.conditions ?? {}) },
  };
  const warnings: string[] = [];
  const transformationNameMap = buildNameMap(Object.keys(registry.transformations));

  const featureNodes = graph.nodes.filter((node) => isConnectorKind(node.data.kind));
  featureNodes.forEach((featureNode) => {
    const def = buildConnectorFromGraph(featureNode, graph, transformationNameMap);
    const exists = registry.connectors[def.name];
    if (exists) {
      if (featureNode.data.fromNetwork) {
        warnings.push(`Using local override for network connector: ${def.name}.`);
        registry.connectors[def.name] = {
          ...def,
          ...preserveNetworkConditionMetadata(def, exists),
          staticRi: exists.staticRi ?? def.staticRi,
          formatHash: exists.formatHash,
          localAddress: exists.localAddress,
          ownerAddress: exists.ownerAddress,
        };
      } else {
        warnings.push(`Connector already exists in registry: ${def.name}`);
      }
      return;
    }
    registry.connectors[def.name] = def;
  });

  const rootFeature = findRootFeature(graph);
  const sluggedRoot = slugify(options.rootLabel);
  const rootName =
    options.rootConnectorId ?? options.rootParticleId ?? (sluggedRoot || options.rootLabel);
  if (!rootFeature) {
    warnings.push("No connector node found; cannot build connector.");
    Object.values(registry.connectors).forEach((connector) => {
      registry.features[connector.name] = connectorToFeature(connector);
      registry.particles[connector.name] = connectorToParticle(connector);
    });
    validateConnectorRegistry(registry, warnings);
    return { registry, rootConnector: rootName, rootParticle: rootName, warnings };
  }

  const builtRoot = buildRootConnector(rootFeature, graph, rootName, transformationNameMap);
  const existingRoot = registry.connectors[rootName];
  registry.connectors[rootName] =
    rootFeature.data.fromNetwork && existingRoot
      ? {
          ...builtRoot,
          ...preserveNetworkConditionMetadata(builtRoot, existingRoot),
          staticRi: existingRoot.staticRi ?? builtRoot.staticRi,
          formatHash: existingRoot.formatHash,
          localAddress: existingRoot.localAddress,
          ownerAddress: existingRoot.ownerAddress,
        }
      : builtRoot;

  Object.values(registry.connectors).forEach((connector) => {
    registry.features[connector.name] = connectorToFeature(connector);
    registry.particles[connector.name] = connectorToParticle(connector);
  });
  validateConnectorRegistry(registry, warnings);

  return { registry, rootConnector: rootName, rootParticle: rootName, warnings };
};

const resolveRunningInstance = (instance?: MockRunningInstance): MockRunningInstance => ({
  startPoint: instance?.startPoint ?? 0,
  transformShift: instance?.transformShift ?? 0,
});

const runTransform = (registry: RuntimeRegistry, name: string, value: number, args: number[]) => {
  const transformation = registry.transformations[name];
  if (!transformation) return value;
  if (transformation.argc !== args.length) {
    throw new Error(`TransformationArgumentsMismatch: ${name}`);
  }
  return transformation.run(value, args);
};

const hydrateLegacyConnector = (
  registry: RuntimeRegistry,
  connectorName: string,
): StudioConnectorDef | null => {
  const particle = registry.particles[connectorName];
  if (!particle) return null;
  const feature = registry.features[particle.featureName];
  if (!feature) return null;

  const connector: StudioConnectorDef = {
    name: particle.name,
    dimensions: feature.dimensions.map((dimension, index) => ({
      transformations: dimension.transformations.map((tx) => ({
        name: tx.name as string,
        args: [...tx.args],
      })),
      composite: particle.composites[index] ?? undefined,
      bindings: {},
    })),
    conditionName: particle.conditionName,
    conditionArgs: particle.conditionName ? [...(particle.conditionArgs ?? [])] : undefined,
  };
  registry.connectors[connector.name] = connector;
  return connector;
};

const resolveConnector = (
  registry: RuntimeRegistry,
  connectorName: string,
): StudioConnectorDef | null => {
  return registry.connectors[connectorName] ?? hydrateLegacyConnector(registry, connectorName);
};

const genSpace = (
  registry: RuntimeRegistry,
  connector: StudioConnectorDef,
  dimId: number,
  runningInstance: MockRunningInstance,
  samplesCount: number,
) => {
  const transformShift = runningInstance.transformShift ?? 0;
  const startPoint = runningInstance.startPoint ?? 0;
  const space: number[] = new Array(samplesCount).fill(0);
  let x = startPoint;
  for (let opId = 0; opId < samplesCount; opId += 1) {
    space[opId] = x;
    const transformations = connector.dimensions[dimId]?.transformations ?? [];
    if (!transformations.length) continue;
    const def = transformations[(opId + transformShift) % transformations.length];
    x = runTransform(registry, def.name, x, def.args);
  }
  return space;
};

const sampleSpace = (
  registry: RuntimeRegistry,
  connector: StudioConnectorDef,
  dimId: number,
  runningInstance: MockRunningInstance,
  samplesIndexes: number[],
) => {
  const maxIndex = samplesIndexes.reduce((max, value) => Math.max(max, value), 0);
  const space = genSpace(registry, connector, dimId, runningInstance, maxIndex + 1);
  return samplesIndexes.map((index) => space[index] ?? 0);
};

const getScalarsCount = (
  registry: RuntimeRegistry,
  connectorName: string,
  visited: Set<string> = new Set(),
): number => {
  if (visited.has(connectorName)) throw new Error(`Connector cycle detected: ${connectorName}`);
  visited.add(connectorName);
  const connector = resolveConnector(registry, connectorName);
  if (!connector) throw new Error(`Missing connector: ${connectorName}`);

  let count = 0;
  connector.dimensions.forEach((dimension) => {
    const composite = dimension.composite ?? null;
    if (!composite) {
      count += 1;
      return;
    }
    count += getScalarsCount(registry, composite, visited);
  });
  visited.delete(connectorName);
  return count;
};

const decompose = (
  registry: RuntimeRegistry,
  path: string,
  connector: StudioConnectorDef,
  runningInstances: MockRunningInstance[],
  runningInstanceId: number,
  indexes: number[],
  dest: number,
  outputs: PtOutputFeature[],
): number => {
  if (connector.conditionName) {
    const condition = registry.conditions[connector.conditionName];
    if (!condition) throw new Error(`Missing condition: ${connector.conditionName}`);
    const args = connector.conditionArgs ?? [];
    if (args.length !== condition.argc) {
      throw new Error(`ConditionArgumentsMismatch: ${connector.conditionName}`);
    }
    if (!condition.check(args)) {
      throw new Error(`ConditionNotMet: ${connector.name}`);
    }
  }

  const currentPath = `${path}/${connector.name}`;
  let currentDest = dest;
  let currentInstanceId = runningInstanceId;

  for (let dimId = 0; dimId < connector.dimensions.length; dimId += 1) {
    const override =
      currentInstanceId < runningInstances.length ? runningInstances[currentInstanceId] : undefined;
    const runningInstance = resolveRunningInstance(override);
    currentInstanceId += 1;

    const compositeIndexes = sampleSpace(registry, connector, dimId, runningInstance, indexes);
    const compositeName = connector.dimensions[dimId]?.composite ?? null;

    if (!compositeName) {
      outputs[currentDest] = { feature_path: currentPath, data: compositeIndexes };
      currentDest += 1;
      continue;
    }

    const compositeConnector = resolveConnector(registry, compositeName);
    if (!compositeConnector) {
      outputs[currentDest] = { feature_path: currentPath, data: compositeIndexes };
      currentDest += 1;
      continue;
    }

    currentDest = decompose(
      registry,
      currentPath,
      compositeConnector,
      runningInstances,
      currentInstanceId,
      compositeIndexes,
      currentDest,
      outputs,
    );
  }

  return currentDest;
};

export const runStudioParticle = (
  registry: RuntimeRegistry,
  rootName: string,
  config: MockRunConfig = {},
): PtOutputFeature[] => {
  const samplesCount = Math.max(1, config.samplesCount ?? 12);
  const rootConnector = resolveConnector(registry, rootName);
  if (!rootConnector) return [];

  const scalarsCount = getScalarsCount(registry, rootConnector.name);
  if (scalarsCount <= 0) return [];

  const outputs: PtOutputFeature[] = Array.from({ length: scalarsCount }, () => ({
    feature_path: "",
    data: new Array(samplesCount).fill(0),
  }));

  const runningInstances = config.runningInstances ?? [];
  const start = runningInstances[0]?.startPoint ?? 0;
  const indexes = Array.from({ length: samplesCount }, (_, i) => i + start);

  decompose(registry, "", rootConnector, runningInstances, 1, indexes, 0, outputs);
  return outputs;
};

export const runStudioGraph = (
  graph: StudioGraph,
  options: { rootLabel: string; rootParticleId?: string; rootConnectorId?: string },
  config: MockRunConfig = {},
  overrides: Partial<RuntimeRegistry> = {},
): PtOutputFeature[] => {
  const runtime = buildStudioRuntime(graph, options, overrides);
  return runStudioParticle(runtime.registry, runtime.rootConnector, config);
};
