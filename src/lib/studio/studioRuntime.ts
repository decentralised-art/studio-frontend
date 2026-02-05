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

export type StudioNodeKind =
  | "particle"
  | "feature"
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
  features: Record<string, MockFeatureDef>;
  particles: Record<string, MockParticleDef>;
  transformations: TransformationRegistry;
  conditions: ConditionRegistry;
};

export type StudioRuntimeSnapshot = {
  registry: RuntimeRegistry;
  rootParticle: string;
  warnings: string[];
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s-_]+/g, "");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
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

  const particles = Object.fromEntries(
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

  return {
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

const buildFeatureFromGraph = (
  featureNode: StudioNode,
  graph: StudioGraph,
  nameMap: Map<string, string>,
): MockFeatureDef => {
  const featureName = resolveNodeName(featureNode);
  const dimensionNodes = getDimensionNodesForFeature(featureNode.id, graph);
  const dimensionCount = Math.max(featureNode.data.dimensions ?? 1, dimensionNodes.length, 1);

  const dimensions: MockFeatureDef["dimensions"] = Array.from(
    { length: dimensionCount },
    (_, i) => ({
      label: `dim-${i + 1}`,
      transformations: [],
    }),
  );

  dimensionNodes.forEach((dimension) => {
    const index = getDimensionIndex(dimension, graph);
    const targetIndex = index ?? dimensions.findIndex((dim) => dim.transformations.length === 0);
    if (targetIndex < 0 || targetIndex >= dimensions.length) return;
    const labels = dimension.data.transformations ?? [];
    dimensions[targetIndex] = {
      label: `dim-${targetIndex + 1}`,
      transformations: labels.map((item) => {
        if (typeof item === "string") {
          return parseTransformationLabel(item, nameMap);
        }
        const label = item.args.length ? `${item.name}(${item.args.join(", ")})` : item.name;
        return parseTransformationLabel(label, nameMap);
      }),
    };
  });

  return { name: featureName, dimensions };
};

const resolveCompositeName = (dimensionId: string, graph: StudioGraph) => {
  const edge = graph.edges.find(
    (item) => item.source === dimensionId && (item.sourceHandle ?? "") === "out",
  );
  if (!edge) return null;
  const target = graph.nodes.find((node) => node.id === edge.target);
  if (!target || target.data.kind !== "particle") return null;
  return resolveNodeName(target);
};

const findRootFeature = (graph: StudioGraph) => {
  const features = graph.nodes.filter((node) => node.data.kind === "feature");
  if (features.length <= 1) return features[0] ?? null;
  return (
    features
      .map((feature) => {
        const outCount = graph.edges.filter((edge) => edge.source === feature.id).length;
        return { feature, outCount };
      })
      .sort((a, b) => b.outCount - a.outCount)[0]?.feature ?? null
  );
};

const buildRootParticle = (
  featureNode: StudioNode,
  graph: StudioGraph,
  registry: RuntimeRegistry,
  rootName: string,
) => {
  const featureName = resolveNodeName(featureNode);
  const feature = registry.features[featureName];
  const dimensionCount = feature?.dimensions.length ?? featureNode.data.dimensions ?? 1;
  const composites: Array<string | null> = Array.from({ length: dimensionCount }, () => null);

  const dimensionNodes = getDimensionNodesForFeature(featureNode.id, graph);
  dimensionNodes.forEach((dimension) => {
    const index = getDimensionIndex(dimension, graph);
    if (index === null || index < 0 || index >= composites.length) return;
    const compositeName = resolveCompositeName(dimension.id, graph);
    if (compositeName && registry.particles[compositeName]) {
      composites[index] = compositeName;
    }
  });

  return {
    name: rootName,
    featureName,
    composites,
  } satisfies MockParticleDef;
};

export const buildStudioRuntime = (
  graph: StudioGraph,
  options: { rootLabel: string; rootParticleId?: string },
  overrides: Partial<RuntimeRegistry> = {},
): StudioRuntimeSnapshot => {
  const baseRegistry = buildBaseRegistry();
  const registry: RuntimeRegistry = {
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

  const featureNodes = graph.nodes.filter((node) => node.data.kind === "feature");
  featureNodes.forEach((featureNode) => {
    const def = buildFeatureFromGraph(featureNode, graph, transformationNameMap);
    const exists = registry.features[def.name];
    if (exists) {
      if (featureNode.data.fromNetwork) {
        warnings.push(`Using local override for network feature: ${def.name}.`);
        registry.features[def.name] = def;
      } else {
        warnings.push(`Feature already exists in registry: ${def.name}`);
      }
      return;
    }
    registry.features[def.name] = def;
  });

  const rootFeature = findRootFeature(graph);
  const sluggedRoot = slugify(options.rootLabel);
  const rootName = options.rootParticleId ?? (sluggedRoot || options.rootLabel);
  if (!rootFeature) {
    warnings.push("No feature node found; cannot build particle.");
    return { registry, rootParticle: rootName, warnings };
  }

  registry.particles[rootName] = buildRootParticle(rootFeature, graph, registry, rootName);

  return { registry, rootParticle: rootName, warnings };
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

const genSpace = (
  registry: RuntimeRegistry,
  feature: MockFeatureDef,
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
    const transformations = feature.dimensions[dimId]?.transformations ?? [];
    if (!transformations.length) continue;
    const def = transformations[(opId + transformShift) % transformations.length];
    x = runTransform(registry, def.name, x, def.args);
  }
  return space;
};

const sampleSpace = (
  registry: RuntimeRegistry,
  feature: MockFeatureDef,
  dimId: number,
  runningInstance: MockRunningInstance,
  samplesIndexes: number[],
) => {
  const maxIndex = samplesIndexes.reduce((max, value) => Math.max(max, value), 0);
  const space = genSpace(registry, feature, dimId, runningInstance, maxIndex + 1);
  return samplesIndexes.map((index) => space[index] ?? 0);
};

const getScalarsCount = (
  registry: RuntimeRegistry,
  particleName: string,
  visited: Set<string> = new Set(),
): number => {
  if (visited.has(particleName)) throw new Error(`Particle cycle detected: ${particleName}`);
  visited.add(particleName);
  const particle = registry.particles[particleName];
  if (!particle) throw new Error(`Missing particle: ${particleName}`);

  let count = 0;
  particle.composites.forEach((composite) => {
    if (!composite) {
      count += 1;
      return;
    }
    count += getScalarsCount(registry, composite, visited);
  });
  visited.delete(particleName);
  return count;
};

const decompose = (
  registry: RuntimeRegistry,
  path: string,
  particle: MockParticleDef,
  runningInstances: MockRunningInstance[],
  runningInstanceId: number,
  indexes: number[],
  dest: number,
  outputs: PtOutputFeature[],
): number => {
  const feature = registry.features[particle.featureName];
  if (!feature) throw new Error(`Missing feature: ${particle.featureName}`);

  if (particle.conditionName) {
    const condition = registry.conditions[particle.conditionName];
    if (!condition) throw new Error(`Missing condition: ${particle.conditionName}`);
    const args = particle.conditionArgs ?? [];
    if (args.length !== condition.argc) {
      throw new Error(`ConditionArgumentsMismatch: ${particle.conditionName}`);
    }
    if (!condition.check(args)) {
      throw new Error(`ConditionNotMet: ${particle.name}`);
    }
  }

  const currentPath = `${path}/${particle.name}`;
  let currentDest = dest;
  let currentInstanceId = runningInstanceId;

  for (let dimId = 0; dimId < feature.dimensions.length; dimId += 1) {
    const override =
      currentInstanceId < runningInstances.length ? runningInstances[currentInstanceId] : undefined;
    const runningInstance = resolveRunningInstance(override);
    currentInstanceId += 1;

    const compositeIndexes = sampleSpace(registry, feature, dimId, runningInstance, indexes);
    const compositeName = particle.composites[dimId] ?? null;

    if (!compositeName) {
      outputs[currentDest] = { feature_path: currentPath, data: compositeIndexes };
      currentDest += 1;
      continue;
    }

    const compositeParticle = registry.particles[compositeName];
    if (!compositeParticle) {
      outputs[currentDest] = { feature_path: currentPath, data: compositeIndexes };
      currentDest += 1;
      continue;
    }

    currentDest = decompose(
      registry,
      currentPath,
      compositeParticle,
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
  particleName: string,
  config: MockRunConfig = {},
): PtOutputFeature[] => {
  const samplesCount = Math.max(1, config.samplesCount ?? 12);
  const particle = registry.particles[particleName];
  if (!particle) return [];
  const scalarsCount = getScalarsCount(registry, particleName);
  if (scalarsCount <= 0) return [];

  const outputs: PtOutputFeature[] = Array.from({ length: scalarsCount }, () => ({
    feature_path: "",
    data: new Array(samplesCount).fill(0),
  }));

  const runningInstances = config.runningInstances ?? [];
  const start = runningInstances[0]?.startPoint ?? 0;
  const indexes = Array.from({ length: samplesCount }, (_, i) => i + start);

  decompose(registry, "", particle, runningInstances, 1, indexes, 0, outputs);
  return outputs;
};

export const runStudioGraph = (
  graph: StudioGraph,
  options: { rootLabel: string; rootParticleId?: string },
  config: MockRunConfig = {},
  overrides: Partial<RuntimeRegistry> = {},
): PtOutputFeature[] => {
  const runtime = buildStudioRuntime(graph, options, overrides);
  return runStudioParticle(runtime.registry, runtime.rootParticle, config);
};
