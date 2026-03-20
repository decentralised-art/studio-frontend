import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";

export type MockRunningInstance = {
  startPoint?: number;
  transformShift?: number;
};

export type MockRunConfig = {
  samplesCount?: number;
  runningInstances?: MockRunningInstance[];
};

export type MockRunDescriptor = {
  id: string;
  label: string;
  particle: string;
  dimension: string;
  seed?: number;
};

export type RunInstanceInput = {
  startPoint: string;
  transformShift: string;
};

export type MockTransformationDef = {
  name: keyof typeof mockTransformations;
  args: number[];
};

export type MockFeatureDimension = {
  label: string;
  transformations: MockTransformationDef[];
};

export type MockFeatureDef = {
  name: string;
  dimensions: MockFeatureDimension[];
};

export type MockParticleDef = {
  name: string;
  featureName: string;
  composites: Array<string | null>;
  conditionName?: string;
  conditionArgs?: number[];
};

export type LineageNode = {
  id: string;
  type?: "lineage" | "default";
  position: { x: number; y: number };
  data: { label: string };
};

export type LineageEdge = {
  id: string;
  type?: "lineage";
  source: string;
  target: string;
  markerEnd?: { type: "arrowclosed" };
  data?: {
    label: string;
    transformations: string[];
  };
};

const clamp = (value: number, min = 0, max = Number.POSITIVE_INFINITY) =>
  Math.min(max, Math.max(min, value));

const mockTransformations = {
  add: {
    argc: 1,
    run: (x: number, args: number[]) => x + (args[0] ?? 0),
  },
  subtract: {
    argc: 1,
    run: (x: number, args: number[]) => {
      const delta = args[0] ?? 0;
      return x > delta ? x - delta : 0;
    },
  },
  addWrap: {
    argc: 2,
    run: (x: number, args: number[]) => {
      const delta = args[0] ?? 0;
      const mod = args[1] ?? 12;
      if (mod <= 0) return x + delta;
      const next = x + delta;
      return ((next % mod) + mod) % mod;
    },
  },
  mirror: {
    argc: 1,
    run: (x: number, args: number[]) => {
      const axis = args[0] ?? 0;
      return clamp(axis - x, 0);
    },
  },
} as const;

const mockConditions = {
  "always-true": {
    argc: 0,
    check: (_args: number[]) => true,
  },
  "always-false": {
    argc: 0,
    check: (_args: number[]) => false,
  },
  "min-arg": {
    argc: 1,
    check: (args: number[]) => (args[0] ?? 0) > 0,
  },
} as const;

const scaleMajorSteps = [2, 2, 1, 2, 2, 2, 1];
const scaleMinorSteps = [2, 1, 2, 2, 1, 2, 2];

const buildAddSequence = (steps: number[]): MockTransformationDef[] =>
  steps.map((step) => ({ name: "add", args: [step] }));

const rhythmPattern = buildAddSequence([1, 1, 2, 1, 1, 2, 2, 1]);

const melodyPitchIndexes = buildAddSequence([1, 2, 1, 3, 1, 2, 2]);
const melodyTimeIndexes = buildAddSequence([1, 1, 1, 2, 1, 1]);
const melodyDurationIndexes = buildAddSequence([0, 1, 0, 2, 1, 0]);
const melodyVelocityIndexes = buildAddSequence([1, 0, 1, 2, 1, 0]);

const altPitchIndexes = buildAddSequence([2, 1, 2, 3, 1]);
const altTimeIndexes = buildAddSequence([1, 2, 1, 1, 2]);
const altDurationIndexes = buildAddSequence([1, 0, 2, 0, 1]);
const altVelocityIndexes = buildAddSequence([0, 1, 0, 1, 2]);

const mockFeatures: Record<string, MockFeatureDef> = {
  "pitch-values": {
    name: "pitch-values",
    dimensions: [{ label: "pitch", transformations: buildAddSequence([1]) }],
  },
  "time-values": {
    name: "time-values",
    dimensions: [{ label: "time", transformations: buildAddSequence([1]) }],
  },
  "duration-values": {
    name: "duration-values",
    dimensions: [{ label: "duration", transformations: buildAddSequence([1]) }],
  },
  "velocity-values": {
    name: "velocity-values",
    dimensions: [{ label: "velocity", transformations: buildAddSequence([1]) }],
  },
  "major-scale-pattern": {
    name: "major-scale-pattern",
    dimensions: [{ label: "pitch-indexes", transformations: buildAddSequence(scaleMajorSteps) }],
  },
  "minor-scale-pattern": {
    name: "minor-scale-pattern",
    dimensions: [{ label: "pitch-indexes", transformations: buildAddSequence(scaleMinorSteps) }],
  },
  "rhythm-pattern": {
    name: "rhythm-pattern",
    dimensions: [{ label: "time-indexes", transformations: rhythmPattern }],
  },
  "duration-pattern": {
    name: "duration-pattern",
    dimensions: [
      { label: "duration-indexes", transformations: buildAddSequence([1, 0, 2, 1, 0, 1]) },
    ],
  },
  "velocity-pattern": {
    name: "velocity-pattern",
    dimensions: [
      { label: "velocity-indexes", transformations: buildAddSequence([1, 0, 2, 1, 0, 1]) },
    ],
  },
  "melody-indexes": {
    name: "melody-indexes",
    dimensions: [
      { label: "pitch-indexes", transformations: melodyPitchIndexes },
      { label: "time-indexes", transformations: melodyTimeIndexes },
      { label: "duration-indexes", transformations: melodyDurationIndexes },
      { label: "velocity-indexes", transformations: melodyVelocityIndexes },
    ],
  },
  "melody-variation": {
    name: "melody-variation",
    dimensions: [
      { label: "pitch-indexes", transformations: altPitchIndexes },
      { label: "time-indexes", transformations: altTimeIndexes },
      { label: "duration-indexes", transformations: altDurationIndexes },
      { label: "velocity-indexes", transformations: altVelocityIndexes },
    ],
  },
  "duo-index": {
    name: "duo-index",
    dimensions: [
      { label: "voice-a", transformations: buildAddSequence([1]) },
      { label: "voice-b", transformations: buildAddSequence([2]) },
    ],
  },
  "weave-index": {
    name: "weave-index",
    dimensions: [{ label: "sequence", transformations: buildAddSequence([1, 1, 2, 1]) }],
  },
};

const mockParticles: Record<string, MockParticleDef> = {
  pitch: {
    name: "pitch",
    featureName: "pitch-values",
    composites: [null],
  },
  time: {
    name: "time",
    featureName: "time-values",
    composites: [null],
  },
  duration: {
    name: "duration",
    featureName: "duration-values",
    composites: [null],
  },
  velocity: {
    name: "velocity",
    featureName: "velocity-values",
    composites: [null],
  },
  "pitch-map": {
    name: "pitch-map",
    featureName: "major-scale-pattern",
    composites: ["pitch"],
  },
  "pitch-map-minor": {
    name: "pitch-map-minor",
    featureName: "minor-scale-pattern",
    composites: ["pitch"],
  },
  "time-map": {
    name: "time-map",
    featureName: "rhythm-pattern",
    composites: ["time"],
  },
  "duration-map": {
    name: "duration-map",
    featureName: "duration-pattern",
    composites: ["duration"],
  },
  "velocity-map": {
    name: "velocity-map",
    featureName: "velocity-pattern",
    composites: ["velocity"],
  },
  melody: {
    name: "melody",
    featureName: "melody-indexes",
    composites: ["pitch-map", "time-map", "duration-map", "velocity-map"],
  },
  "melody-alt": {
    name: "melody-alt",
    featureName: "melody-variation",
    composites: ["pitch-map-minor", "time-map", "duration-map", "velocity-map"],
  },
  "melody-duo": {
    name: "melody-duo",
    featureName: "duo-index",
    composites: ["melody", "melody-alt"],
  },
  "score-weave": {
    name: "score-weave",
    featureName: "weave-index",
    composites: ["melody-duo"],
  },
};

const getFeature = (name: string) => {
  const feature = mockFeatures[name];
  if (!feature) throw new Error(`Missing feature: ${name}`);
  return feature;
};

const getCondition = (name: string) => {
  const condition = mockConditions[name as keyof typeof mockConditions];
  if (!condition) throw new Error(`Missing condition: ${name}`);
  return condition;
};

const validatedParticles = new Set<string>();

const getParticle = (name: string) => {
  const particle = mockParticles[name];
  if (!particle) throw new Error(`Missing particle: ${name}`);
  if (!validatedParticles.has(name)) {
    const feature = getFeature(particle.featureName);
    if (feature.dimensions.length !== particle.composites.length) {
      throw new Error(`ParticleDimensionsMismatch: ${name}`);
    }
    if (particle.conditionName) {
      const condition = getCondition(particle.conditionName);
      const args = particle.conditionArgs ?? [];
      if (args.length !== condition.argc) {
        throw new Error(`ConditionArgumentsMismatch: ${particle.conditionName}`);
      }
    }
    validatedParticles.add(name);
  }
  return particle;
};

const transformValue = (feature: MockFeatureDef, dimId: number, txId: number, value: number) => {
  const dimension = feature.dimensions[dimId];
  const transformations = dimension?.transformations ?? [];
  if (!transformations.length) return value;

  const def = transformations[txId % transformations.length];
  const fn = mockTransformations[def.name];
  if (!fn) return value;
  if (def.args.length !== fn.argc) {
    throw new Error(`TransformationArgumentsMismatch: ${def.name}`);
  }
  return fn.run(value, def.args);
};

const genSpace = (
  feature: MockFeatureDef,
  dimId: number,
  runningInstance: MockRunningInstance,
  samplesCount: number,
) => {
  const startPoint = runningInstance.startPoint ?? 0;

  const space: number[] = new Array(samplesCount).fill(0);
  let x = startPoint;
  for (let opId = 0; opId < samplesCount; opId += 1) {
    space[opId] = x;
    const transformShift = runningInstance.transformShift ?? 0;
    x = transformValue(feature, dimId, opId + transformShift, x);
  }

  return space;
};

const sampleSpace = (
  feature: MockFeatureDef,
  dimId: number,
  runningInstance: MockRunningInstance,
  samplesIndexes: number[],
) => {
  const maxIndex = samplesIndexes.reduce((max, value) => Math.max(max, value), 0);
  const space = genSpace(feature, dimId, runningInstance, maxIndex + 1);
  return samplesIndexes.map((index) => space[index] ?? 0);
};

const resolveRunningInstance = (instance?: MockRunningInstance): MockRunningInstance => {
  return {
    startPoint: instance?.startPoint ?? 0,
    transformShift: instance?.transformShift ?? 0,
  };
};

const decompose = (
  path: string,
  particle: MockParticleDef,
  runningInstances: MockRunningInstance[],
  runningInstanceId: number,
  indexes: number[],
  dest: number,
  outputs: PtOutputFeature[],
): void => {
  const feature = getFeature(particle.featureName);
  const currentPath = `${path}/${particle.name}`;
  const conditionName = particle.conditionName ?? "";

  if (conditionName.length > 0) {
    const condition = getCondition(conditionName);
    const args = particle.conditionArgs ?? [];
    if (args.length !== condition.argc) {
      throw new Error(`ConditionArgumentsMismatch: ${conditionName}`);
    }
    if (!condition.check(args)) {
      throw new Error(`ConditionNotMet: ${particle.name}`);
    }
  }

  let currentDest = dest;
  let currentRunningInstanceId = runningInstanceId;

  for (let dimId = 0; dimId < feature.dimensions.length; dimId += 1) {
    const runningInstanceOverride =
      currentRunningInstanceId < runningInstances.length
        ? runningInstances[currentRunningInstanceId]
        : undefined;
    const runningInstance = resolveRunningInstance(runningInstanceOverride);
    currentRunningInstanceId += 1;

    const compositeIndexes = sampleSpace(feature, dimId, runningInstance, indexes);
    const compositeName = particle.composites[dimId] ?? null;

    if (!compositeName) {
      outputs[currentDest] = {
        feature_path: currentPath,
        data: compositeIndexes,
      };
      currentDest += 1;
      continue;
    }

    const compositeParticle = getParticle(compositeName);
    decompose(
      currentPath,
      compositeParticle,
      runningInstances,
      currentRunningInstanceId,
      compositeIndexes,
      currentDest,
      outputs,
    );
  }
};

const scalarsCountCache = new Map<string, number>();

const getScalarsCount = (particleName: string, stack: Set<string> = new Set()) => {
  if (scalarsCountCache.has(particleName)) {
    return scalarsCountCache.get(particleName) ?? 0;
  }
  if (stack.has(particleName)) {
    throw new Error(`Particle cycle detected: ${particleName}`);
  }
  stack.add(particleName);

  const particle = getParticle(particleName);
  let count = 0;
  particle.composites.forEach((compositeName) => {
    if (!compositeName) {
      count += 1;
      return;
    }
    count += getScalarsCount(compositeName, stack);
  });

  stack.delete(particleName);
  scalarsCountCache.set(particleName, count);
  return count;
};

export const runMockParticle = (
  particleName: string,
  config: MockRunConfig = {},
): PtOutputFeature[] => {
  const rawSamplesCount = config.samplesCount ?? 12;
  if (rawSamplesCount <= 0) return [];
  const samplesCount = Math.max(1, rawSamplesCount);
  const particle = getParticle(particleName);
  const scalarsCount = getScalarsCount(particleName);
  if (scalarsCount <= 0) return [];

  const outputs: PtOutputFeature[] = Array.from({ length: scalarsCount }, () => ({
    feature_path: "",
    data: new Array(samplesCount).fill(0),
  }));

  const runningInstances = config.runningInstances ?? [];
  const start = runningInstances[0]?.startPoint ?? 0;
  const indexes = Array.from({ length: samplesCount }, (_, i) => i + start);

  decompose("", particle, runningInstances, 1, indexes, 0, outputs);
  return outputs;
};

const mockOutputCache = new Map<string, PtOutputFeature[]>();

const normalizeConfig = (config: MockRunConfig = {}) => {
  const rawSamplesCount = config.samplesCount ?? 12;
  const samplesCount = rawSamplesCount <= 0 ? 0 : Math.max(1, rawSamplesCount);
  return {
    samplesCount,
    runningInstances: config.runningInstances ?? [],
  };
};

export const getMockPtOutput = (particleName: string, config: MockRunConfig = {}) => {
  const normalized = normalizeConfig(config);
  const key = `${particleName}-${JSON.stringify(normalized)}`;
  const cached = mockOutputCache.get(key);
  if (cached) return cached;
  let output: PtOutputFeature[] = [];
  try {
    output = runMockParticle(particleName, normalized);
  } catch (error) {
    console.warn("Mock runner error", error);
  }
  mockOutputCache.set(key, output);
  return output;
};

export const getMockRunDescriptors = (particleName: string) => {
  const descriptors: MockRunDescriptor[] = [];

  const walk = (name: string, path: string) => {
    const particle = getParticle(name);
    const feature = getFeature(particle.featureName);
    const currentPath = `${path}/${particle.name}`;

    feature.dimensions.forEach((dimension, dimId) => {
      const label = `${particle.name} / ${dimension.label}`;
      descriptors.push({
        id: `${currentPath}:${dimension.label}`,
        label,
        particle: particle.name,
        dimension: dimension.label,
      });

      const compositeName = particle.composites[dimId];
      if (compositeName) walk(compositeName, currentPath);
    });
  };

  walk(particleName, "");
  return descriptors;
};

export const getMockLineageGraph = (particleName: string, maxDepth = 4) => {
  const nodes = new Map<string, { depth: number }>();
  const edges: LineageEdge[] = [];

  const formatTransform = (def: MockTransformationDef) => {
    const args = def.args.map((arg) => Number(arg).toString()).join(", ");
    return args.length > 0 ? `${def.name}(${args})` : def.name;
  };

  const walk = (name: string, depth: number) => {
    if (depth > maxDepth) return;
    if (!nodes.has(name)) nodes.set(name, { depth });

    const particle = getParticle(name);
    const feature = getFeature(particle.featureName);
    particle.composites.forEach((childName, dimId) => {
      if (!childName) return;
      const dimension = feature.dimensions[dimId];
      const label = dimension?.label ?? `dim-${dimId}`;
      const transformations = (dimension?.transformations ?? []).map(formatTransform);

      edges.push({
        id: `${name}->${childName}`,
        type: "lineage",
        source: name,
        target: childName,
        markerEnd: { type: "arrowclosed" },
        data: { label, transformations },
      });
      walk(childName, depth + 1);
    });
  };

  walk(particleName, 0);

  const depthBuckets = new Map<number, string[]>();
  nodes.forEach(({ depth }, name) => {
    const list = depthBuckets.get(depth) ?? [];
    list.push(name);
    depthBuckets.set(depth, list);
  });

  const orderedDepths = [...depthBuckets.keys()].sort((a, b) => a - b);

  const layoutNodes: LineageNode[] = [];
  orderedDepths.forEach((depth) => {
    const bucket = depthBuckets.get(depth) ?? [];
    bucket.sort();
    bucket.forEach((name, index) => {
      layoutNodes.push({
        id: name,
        type: "lineage",
        position: { x: depth * 220, y: index * 120 },
        data: { label: name },
      });
    });
  });

  return { nodes: layoutNodes, edges };
};

export const mockParticleNames = Object.keys(mockParticles);

export type RegistryFeatureSnapshot = {
  name: string;
  dimensions: MockFeatureDimension[];
};

export type RegistryTransformationSnapshot = {
  name: string;
  argc: number;
};

export type RegistryConditionSnapshot = {
  name: string;
  argc: number;
};

export type RegistryParticleSnapshot = {
  name: string;
  featureName: string;
  composites: Array<string | null>;
  conditionName?: string;
  conditionArgs?: number[];
};

export type MockRegistrySnapshot = {
  features: RegistryFeatureSnapshot[];
  transformations: RegistryTransformationSnapshot[];
  conditions: RegistryConditionSnapshot[];
  particles: RegistryParticleSnapshot[];
};

export const getMockRegistrySnapshot = (): MockRegistrySnapshot => {
  const features = Object.values(mockFeatures)
    .map((feature) => ({
      name: feature.name,
      dimensions: feature.dimensions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const transformations = Object.entries(mockTransformations)
    .map(([name, def]) => ({ name, argc: def.argc }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const conditions = Object.entries(mockConditions)
    .map(([name, def]) => ({ name, argc: def.argc }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const particles = Object.values(mockParticles)
    .map((particle) => ({
      name: particle.name,
      featureName: particle.featureName,
      composites: [...particle.composites],
      conditionName: particle.conditionName,
      conditionArgs: particle.conditionArgs ? [...particle.conditionArgs] : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { features, transformations, conditions, particles };
};

export const mockRegistrySnapshot = getMockRegistrySnapshot();

export const mockTransformationRegistry = mockTransformations;
export const mockConditionRegistry = mockConditions;
