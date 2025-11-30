import type { Node, Edge } from "@xyflow/svelte";

// ---- Data payloads on nodes ----
export type FeatureData = { label: string };

// ---- XYFlow Node types (these are *types*, not components) ----
export type FeatureNodeType = Node<FeatureData, "feature">;

// Union of all node types in editor
export type FlowNode = FeatureNodeType | Node;

// ---- Data payloads on edges ----

export type TransformationDef = {
  id: string;
  name: string;
  args : number[];
};

export type DimensionData = {
  defs: TransformationDef[];
};

// ---- Typed custom edge ----
export type DimensionEdgeType = Edge<DimensionData, "dimension">;

// Union of all possible edges in editor
export type FlowEdge = DimensionEdgeType;