export type RuntimeRunningInstance = {
  startPoint?: number;
  transformShift?: number;
};

export type RuntimeRunConfig = {
  samplesCount?: number;
  runningInstances?: RuntimeRunningInstance[];
};

export type RunDescriptor = {
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

export type RuntimeTransformationRef = {
  name: string;
  args: number[];
};

export type RuntimeFeatureDimension = {
  label: string;
  transformations: RuntimeTransformationRef[];
};

export type RuntimeFeatureDef = {
  name: string;
  dimensions: RuntimeFeatureDimension[];
};

export type RuntimeParticleDef = {
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
